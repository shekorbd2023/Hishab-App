// Email + SMS notifications. Server only, no dependencies.
//
// Email: any SMTP server over TLS (Gmail with an App Password works: smtp.gmail.com:465),
//        or the Brevo HTTP API.
// SMS:   pluggable gateway — BulkSMSBD, Alpha SMS (sms.net.bd), or a custom HTTP URL
//        template, so the provider can be chosen later without code changes.
//
// Credentials live in `notify_config` (per business) and are never sent back to the browser.
// Every attempt is written to `notify_log`. Sending never throws into the caller.
import tls from "node:tls";
import { all, get, run } from "./db";
import { uid, nowIso, todayIso } from "./util";
import { tk, fmtDate } from "./format";
import { partyBalances } from "./domain";

/* ============================== Config ============================== */
export type EmailProvider = "none" | "smtp" | "brevo";
export type SmsProvider = "none" | "bulksmsbd" | "alphasms" | "custom";
export type NotifyConfig = {
  email_provider: EmailProvider;
  from_name: string;
  from_email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;          // secret
  brevo_key: string;          // secret
  sms_provider: SmsProvider;
  sms_api_key: string;        // secret
  sms_sender_id: string;
  sms_custom_url: string;     // e.g. https://api.example.com/send?key={api_key}&to={to}&msg={message}
  // what to send
  invoice_sms: boolean;
  invoice_email: boolean;
  payment_sms: boolean;
  payment_email: boolean;
  daily_summary: boolean;
  owner_email: string;
};
export const NOTIFY_DEFAULTS: NotifyConfig = {
  email_provider: "none", from_name: "", from_email: "", smtp_host: "smtp.gmail.com", smtp_port: 465, smtp_user: "", smtp_pass: "", brevo_key: "",
  sms_provider: "none", sms_api_key: "", sms_sender_id: "", sms_custom_url: "",
  invoice_sms: false, invoice_email: false, payment_sms: false, payment_email: false, daily_summary: false, owner_email: "",
};
export const SECRET_FIELDS = ["smtp_pass", "brevo_key", "sms_api_key"] as const;

export async function getNotifyConfig(bid: string): Promise<NotifyConfig> {
  const row = await get<{ json: string }>("SELECT json FROM notify_config WHERE business_id=?", [bid]);
  try { return { ...NOTIFY_DEFAULTS, ...(row ? JSON.parse(row.json) : {}) }; } catch { return { ...NOTIFY_DEFAULTS }; }
}
/** Safe for the browser: secrets replaced by a flag. */
export function publicConfig(c: NotifyConfig) {
  const out: Record<string, string | number | boolean> = { ...c };
  for (const k of SECRET_FIELDS) { out[k] = ""; out[k + "_set"] = Boolean(c[k]); }
  return out as Record<string, string | number | boolean>;
}
export async function saveNotifyConfig(bid: string, patch: Partial<NotifyConfig>) {
  const cur = await getNotifyConfig(bid);
  const next: NotifyConfig = { ...cur };
  for (const k of Object.keys(NOTIFY_DEFAULTS) as (keyof NotifyConfig)[]) {
    if (!(k in patch)) continue;
    const v = patch[k];
    if ((SECRET_FIELDS as readonly string[]).includes(k) && (v === "" || v === undefined)) continue; // blank = keep the saved secret
    const d = NOTIFY_DEFAULTS[k];
    (next as Record<string, unknown>)[k] = typeof d === "boolean" ? Boolean(v) : typeof d === "number" ? Number(v) || d : String(v ?? "").trim().slice(0, 500);
  }
  await run(`INSERT INTO notify_config (business_id, json) VALUES (?,?) ON CONFLICT(business_id) DO UPDATE SET json=excluded.json`, [bid, JSON.stringify(next)]);
  return next;
}
export const emailReady = (c: NotifyConfig) =>
  (c.email_provider === "smtp" && !!c.smtp_host && !!c.smtp_user && !!c.smtp_pass) || (c.email_provider === "brevo" && !!c.brevo_key && !!c.from_email);
export const smsReady = (c: NotifyConfig) =>
  c.sms_provider !== "none" && (c.sms_provider === "custom" ? !!c.sms_custom_url : !!c.sms_api_key);

async function log(bid: string, channel: string, to: string, subject: string, status: "sent" | "failed", error?: string) {
  try {
    await run("INSERT INTO notify_log (id, business_id, channel, recipient, subject, status, error, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [uid(), bid, channel, to.slice(0, 120), subject.slice(0, 200), status, error?.slice(0, 300) ?? null, nowIso()]);
  } catch { /* logging must not fail a send */ }
}

/* ============================== SMTP (TLS, AUTH LOGIN) ============================== */
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const encWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const wrap76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");

function smtpSend(c: NotifyConfig, to: string, subject: string, html: string, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host: c.smtp_host, port: c.smtp_port || 465, servername: c.smtp_host });
    const from = c.from_email || c.smtp_user;
    const boundary = "hb" + uid().replace(/-/g, "");
    const msg = [
      `From: ${encWord(c.from_name || from)} <${from}>`, `To: <${to}>`, `Subject: ${encWord(subject)}`,
      `Date: ${new Date().toUTCString()}`, `Message-ID: <${uid()}@hishab>`, "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`, "",
      `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrap76(b64(text)),
      `--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrap76(b64(html)),
      `--${boundary}--`, "",
    ].join("\r\n");
    const steps: [string | null, number][] = [
      [null, 220], [`EHLO hishab`, 250], ["AUTH LOGIN", 334], [b64(c.smtp_user), 334], [b64(c.smtp_pass), 235],
      [`MAIL FROM:<${from}>`, 250], [`RCPT TO:<${to}>`, 250], ["DATA", 354], [msg + "\r\n.", 250], ["QUIT", 221],
    ];
    let i = 0, buf = "";
    const timer = setTimeout(() => { sock.destroy(); reject(new Error("SMTP timeout")); }, 20000);
    const fail = (e: Error) => { clearTimeout(timer); sock.destroy(); reject(e); };
    sock.on("error", fail);
    sock.on("data", (d) => {
      buf += d.toString("utf8");
      // a reply is complete when its last line is "NNN text" (not "NNN-text")
      const lines = buf.split("\r\n").filter(Boolean);
      const last = lines[lines.length - 1] || "";
      if (!/^\d{3} /.test(last) || !buf.endsWith("\r\n")) return;
      const code = Number(last.slice(0, 3));
      buf = "";
      const want = steps[i][1];
      if (code !== want) {
        if (i === steps.length - 1) { clearTimeout(timer); sock.end(); resolve(); return; } // QUIT reply is irrelevant
        return fail(new Error(code === 535 ? "Email login failed — check the username and App Password" : `SMTP error ${last.slice(0, 160)}`));
      }
      i++;
      if (i >= steps.length) { clearTimeout(timer); sock.end(); resolve(); return; }
      sock.write(steps[i][0] + "\r\n");
    });
  });
}

async function brevoSend(c: NotifyConfig, to: string, subject: string, html: string, text: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": c.brevo_key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: c.from_name || c.from_email, email: c.from_email }, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 160)}`);
}

export async function sendEmail(bid: string, c: NotifyConfig, to: string, subject: string, html: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!emailReady(c)) return { ok: false, error: "Email is not set up" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, error: "Invalid email address" };
  try {
    if (c.email_provider === "smtp") await smtpSend(c, to, subject, html, text); else await brevoSend(c, to, subject, html, text);
    await log(bid, "email", to, subject, "sent");
    return { ok: true };
  } catch (e) {
    const error = (e as Error).message || String(e);
    await log(bid, "email", to, subject, "failed", error);
    return { ok: false, error };
  }
}

/* ============================== SMS ============================== */
/** Bangladeshi mobile → 8801XXXXXXXXX, or null. */
export function bdMsisdn(phone: string | null | undefined): string | null {
  const d = (phone || "").replace(/[০-৯]/g, (x) => String("০১২৩৪৫৬৭৮৯".indexOf(x))).replace(/\D/g, "");
  const m = /^(?:00)?(?:88)?(01[3-9]\d{8})$/.exec(d);
  return m ? "88" + m[1] : null;
}

export async function sendSms(bid: string, c: NotifyConfig, phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!smsReady(c)) return { ok: false, error: "SMS is not set up" };
  const to = bdMsisdn(phone);
  if (!to) return { ok: false, error: "Not a Bangladeshi mobile number" };
  try {
    let res: Response;
    if (c.sms_provider === "bulksmsbd") {
      const q = new URLSearchParams({ api_key: c.sms_api_key, type: "text", number: to, senderid: c.sms_sender_id, message });
      res = await fetch(`https://bulksmsbd.net/api/smsapi?${q}`, { signal: AbortSignal.timeout(15000) });
      const body = await res.text();
      // BulkSMSBD answers 200 with {"response_code":202,...} on success
      if (!res.ok || !/"response_code"\s*:\s*202/.test(body)) throw new Error(`BulkSMSBD: ${body.slice(0, 160)}`);
    } else if (c.sms_provider === "alphasms") {
      const form = new URLSearchParams({ api_key: c.sms_api_key, msg: message, to, ...(c.sms_sender_id ? { sender_id: c.sms_sender_id } : {}) });
      res = await fetch("https://api.sms.net.bd/sendsms", { method: "POST", body: form, signal: AbortSignal.timeout(15000) });
      const body = await res.text();
      if (!res.ok || !/"error"\s*:\s*0/.test(body)) throw new Error(`Alpha SMS: ${body.slice(0, 160)}`);
    } else {
      const url = c.sms_custom_url
        .replaceAll("{api_key}", encodeURIComponent(c.sms_api_key)).replaceAll("{sender_id}", encodeURIComponent(c.sms_sender_id))
        .replaceAll("{to}", encodeURIComponent(to)).replaceAll("{message}", encodeURIComponent(message));
      if (!/^https:\/\//.test(url)) throw new Error("Custom SMS URL must start with https://");
      res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`SMS gateway replied ${res.status}: ${(await res.text()).slice(0, 120)}`);
    }
    await log(bid, "sms", to, message.slice(0, 60), "sent");
    return { ok: true };
  } catch (e) {
    const error = (e as Error).message || String(e);
    await log(bid, "sms", to, message.slice(0, 60), "failed", error);
    return { ok: false, error };
  }
}

/* ============================== Templates ============================== */
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
function mailHtml(biz: string, title: string, rows: [string, string][], footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f5;font-family:Segoe UI,Arial,sans-serif;color:#1f2a24">
<div style="max-width:520px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e3e8e5">
<div style="background:#1f9d6b;color:#fff;padding:16px 20px;font-size:18px;font-weight:700">${esc(biz)}</div>
<div style="padding:20px"><div style="font-size:16px;font-weight:600;margin-bottom:12px">${esc(title)}</div>
<table style="width:100%;border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#5b6b63">${esc(k)}</td><td style="padding:6px 0;text-align:right;font-weight:600">${esc(v)}</td></tr>`).join("")}</table>
<div style="margin-top:16px;font-size:13px;color:#5b6b63">${esc(footer)}</div></div>
<div style="padding:10px 20px;font-size:11px;color:#8a9a92;border-top:1px solid #eef2f0">Sent by Hishab</div></div></body></html>`;
}
const textOf = (title: string, rows: [string, string][], footer: string) => [title, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", footer].join("\n");

type BizRow = { name: string; phone: string | null };
const bizOf = async (bid: string) => (await get<BizRow>("SELECT name, phone FROM businesses WHERE id=?", [bid])) || { name: "Hishab", phone: null };

/* ============================== Triggers ============================== */
/** After a sales invoice is created: SMS / email to the customer, per the business's switches. */
export async function notifyInvoice(bid: string, docId: string): Promise<void> {
  try {
    const c = await getNotifyConfig(bid);
    if (!(c.invoice_sms && smsReady(c)) && !(c.invoice_email && emailReady(c))) return;
    const d = await get<{ kind: string; number: number; date: string; total: number; party_id: string | null; pname: string | null; phone: string | null; email: string | null; paid: number }>(
      `SELECT d.kind, d.number, d.date, d.total, d.party_id, p.name pname, p.phone, p.email,
              (SELECT COALESCE(SUM(amount),0) FROM payments WHERE document_id=d.id) paid
         FROM documents d LEFT JOIN parties p ON p.id=d.party_id WHERE d.id=? AND d.business_id=?`, [docId, bid]);
    if (!d || d.kind !== "sales_invoice" || !d.party_id) return;
    const biz = await bizOf(bid);
    const due = Math.max(0, d.total - d.paid);
    const bal = (await partyBalances(bid))[d.party_id] || 0;
    if (c.invoice_sms && smsReady(c) && d.phone) {
      const msg = `${biz.name}: ধন্যবাদ ${d.pname || ""}! ইনভয়েস #${d.number}, মোট ${tk(d.total)}${due > 0 ? `, বাকি ${tk(due)}` : ", পরিশোধিত"}।${biz.phone ? ` ${biz.phone}` : ""}`;
      await sendSms(bid, c, d.phone, msg);
    }
    if (c.invoice_email && emailReady(c) && d.email) {
      const rows: [string, string][] = [["Invoice", `#${d.number}`], ["Date", fmtDate(d.date)], ["Total", tk(d.total)], ["Paid", tk(Math.min(d.paid, d.total))], ["Due on this invoice", tk(due)], [bal >= 0 ? "Your total balance (to pay)" : "Your advance", tk(Math.abs(bal))]];
      const title = `Invoice #${d.number} — thank you, ${d.pname || "customer"}!`;
      const footer = `ধন্যবাদ আমাদের সাথে থাকার জন্য।${biz.phone ? ` যোগাযোগ: ${biz.phone}` : ""}`;
      await sendEmail(bid, c, d.email, `${biz.name} — Invoice #${d.number}`, mailHtml(biz.name, title, rows, footer), textOf(title, rows, footer));
    }
  } catch (e) { console.error("[notify] invoice", e); }
}

/** After a Payment In is recorded (not the automatic one made with an invoice). */
export async function notifyPayment(bid: string, paymentId: string): Promise<void> {
  try {
    const c = await getNotifyConfig(bid);
    if (!(c.payment_sms && smsReady(c)) && !(c.payment_email && emailReady(c))) return;
    const p = await get<{ kind: string; number: number; amount: number; date: string; party_id: string | null; pname: string | null; phone: string | null; email: string | null }>(
      `SELECT y.kind, y.number, y.amount, y.date, y.party_id, p.name pname, p.phone, p.email FROM payments y LEFT JOIN parties p ON p.id=y.party_id WHERE y.id=? AND y.business_id=?`, [paymentId, bid]);
    if (!p || p.kind !== "in" || !p.party_id) return;
    const biz = await bizOf(bid);
    const bal = (await partyBalances(bid))[p.party_id] || 0;
    const balTxt = bal > 0 ? `বাকি ${tk(bal)}` : bal < 0 ? `অগ্রিম ${tk(-bal)}` : "কোনো বাকি নেই";
    if (c.payment_sms && smsReady(c) && p.phone)
      await sendSms(bid, c, p.phone, `${biz.name}: ${tk(p.amount)} পেয়েছি, ধন্যবাদ ${p.pname || ""}! রসিদ #${p.number}। ${balTxt}।`);
    if (c.payment_email && emailReady(c) && p.email) {
      const rows: [string, string][] = [["Receipt", `#${p.number}`], ["Date", fmtDate(p.date)], ["Amount received", tk(p.amount)], [bal >= 0 ? "Balance to pay" : "Advance", tk(Math.abs(bal))]];
      const title = `Payment received — thank you, ${p.pname || "customer"}!`;
      await sendEmail(bid, c, p.email, `${biz.name} — Payment receipt #${p.number}`, mailHtml(biz.name, title, rows, "ধন্যবাদ!"), textOf(title, rows, "ধন্যবাদ!"));
    }
  } catch (e) { console.error("[notify] payment", e); }
}

/** Due reminder to one party (button on the party page). */
export async function remindParty(bid: string, partyId: string, channel: "sms" | "email"): Promise<{ ok: boolean; error?: string }> {
  const c = await getNotifyConfig(bid);
  const p = await get<{ name: string; phone: string | null; email: string | null }>("SELECT name, phone, email FROM parties WHERE id=? AND business_id=?", [partyId, bid]);
  if (!p) return { ok: false, error: "Party not found" };
  const bal = (await partyBalances(bid))[partyId] || 0;
  if (bal <= 0) return { ok: false, error: "This party has nothing to pay" };
  const biz = await bizOf(bid);
  if (channel === "sms") {
    if (!p.phone) return { ok: false, error: "No phone number for this party" };
    return sendSms(bid, c, p.phone, `${biz.name}: প্রিয় ${p.name}, আপনার বাকি ${tk(bal)}। সুবিধামতো সময়ে পরিশোধ করার অনুরোধ রইল। ধন্যবাদ।${biz.phone ? ` ${biz.phone}` : ""}`);
  }
  if (!p.email) return { ok: false, error: "No email for this party" };
  const rows: [string, string][] = [["Amount due", tk(bal)], ["As of", fmtDate(todayIso())]];
  const title = `Payment reminder for ${p.name}`;
  const footer = "সুবিধামতো সময়ে পরিশোধ করার অনুরোধ রইল। ধন্যবাদ।";
  return sendEmail(bid, c, p.email, `${biz.name} — Payment reminder`, mailHtml(biz.name, title, rows, footer), textOf(title, rows, footer));
}

/** Daily summary email to the owner (cron). Returns businesses emailed. */
export async function sendDailySummaries(): Promise<number> {
  let n = 0;
  for (const row of await all<{ business_id: string; json: string }>("SELECT business_id, json FROM notify_config")) {
    let c: NotifyConfig;
    try { c = { ...NOTIFY_DEFAULTS, ...JSON.parse(row.json) }; } catch { continue; }
    if (!c.daily_summary || !c.owner_email || !emailReady(c)) continue;
    const bid = row.business_id, day = todayIso();
    // At most one summary per business per day, however often the endpoint is called.
    const claimed = await run(
      "UPDATE notify_config SET json=json_set(json, '$.last_summary_day', ?) WHERE business_id=? AND COALESCE(json_extract(json, '$.last_summary_day'), '') != ?",
      [day, bid, day]);
    if (!claimed.changes) continue;
    const sum = async (sql: string) => (await get<{ s: number }>(sql, [bid, day]))?.s ?? 0;
    const sales = await sum("SELECT COALESCE(SUM(total),0) s FROM documents WHERE business_id=? AND kind='sales_invoice' AND date=?");
    const count = await sum("SELECT COUNT(*) s FROM documents WHERE business_id=? AND kind='sales_invoice' AND date=?");
    const purchase = await sum("SELECT COALESCE(SUM(total),0) s FROM documents WHERE business_id=? AND kind='purchase_bill' AND date=?");
    const pin = await sum("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE business_id=? AND kind='in' AND date=?");
    const pout = await sum("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE business_id=? AND kind='out' AND date=?");
    const exp = await sum("SELECT COALESCE(SUM(amount),0) s FROM expenses WHERE business_id=? AND date=?");
    const bal = Object.values(await partyBalances(bid));
    const recv = bal.filter((v) => v > 0).reduce((a, v) => a + v, 0);
    const biz = await bizOf(bid);
    const rows: [string, string][] = [
      ["Sales today", `${tk(sales)} (${count} invoice${count === 1 ? "" : "s"})`], ["Purchases today", tk(purchase)],
      ["Money received", tk(pin)], ["Money paid", tk(pout)], ["Expenses", tk(exp)], ["Total to receive (all customers)", tk(recv)],
    ];
    const title = `Today's summary — ${fmtDate(day)}`;
    const r = await sendEmail(bid, c, c.owner_email, `${biz.name} — ${title}`, mailHtml(biz.name, title, rows, "Open Hishab for the full reports."), textOf(title, rows, ""));
    if (r.ok) n++;
  }
  return n;
}
