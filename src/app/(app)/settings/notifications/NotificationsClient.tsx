"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post, useToast } from "@/components/ui";
import { PageTitle, Section, Row, ToggleRow } from "../SettingsKit";

type Cfg = Record<string, string | number | boolean>;
type Log = { id: string; channel: string; recipient: string; subject: string | null; status: string; error: string | null; created_at: string };

const field = (label: string, el: React.ReactNode, hint?: string) => (
  <div className="field"><label className="label">{label}</label>{el}{hint && <div className="sub" style={{ fontSize: ".75rem", marginTop: ".2rem" }}>{hint}</div>}</div>
);

export default function NotificationsClient({ manager, initial, logs, userEmail }: { manager: boolean; initial: Cfg; logs: Log[]; userEmail: string }) {
  const router = useRouter();
  const { toast, node } = useToast();
  const [c, setC] = useState<Cfg>(initial);
  const [testTo, setTestTo] = useState(String(initial.owner_email || userEmail));
  const [testPhone, setTestPhone] = useState("");
  const set = (k: string, v: string | number | boolean) => setC((o) => ({ ...o, [k]: v }));
  const inp = (k: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) =>
    <input className="input" value={String(c[k] ?? "")} onChange={(e) => set(k, e.target.value)} disabled={!manager} {...props} />;
  const secret = (k: string, placeholder: string) =>
    <input className="input" type="password" autoComplete="new-password" value={String(c[k] ?? "")} onChange={(e) => set(k, e.target.value)} disabled={!manager}
      placeholder={c[k + "_set"] ? "•••••••• saved — leave blank to keep" : placeholder} />;

  async function save(patch?: Cfg, msg = "Saved") {
    const body = patch ?? c;
    const { ok, data } = await post<{ config: Cfg }>("/api/notify", { op: "save", patch: body });
    if (!ok) { toast(data.error || "Could not save"); return false; }
    setC(data.config); toast(msg); router.refresh(); return true;
  }
  const toggle = (k: string) => async (v: boolean) => { set(k, v); await save({ [k]: v }, v ? "Turned on" : "Turned off"); };
  async function test(op: "test_email" | "test_sms") {
    if (!(await save(undefined, "Saved, sending test…"))) return;
    const { ok, data } = await post<{ to?: string }>("/api/notify", { op, to: op === "test_email" ? testTo : testPhone });
    toast(ok ? (op === "test_email" ? `Test email sent to ${data.to}` : "Test SMS sent") : data.error || "Failed"); router.refresh();
  }

  const ep = String(c.email_provider), sp = String(c.sms_provider);
  return (
    <div>
      <PageTitle>Email &amp; SMS</PageTitle>
      {!manager && <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>Only the Owner or an Admin can change these settings.</div>}

      <Section title="Automatic messages" hint="Sent to the customer's phone / email saved on the party. গ্রাহকের ফোন/ইমেইলে নিজে থেকে যাবে।">
        <ToggleRow title="SMS on new sales invoice" desc="ধন্যবাদ + ইনভয়েস নম্বর, মোট আর বাকি" on={!!c.invoice_sms} onChange={toggle("invoice_sms")} />
        <ToggleRow title="Email on new sales invoice" desc="Invoice summary with the customer's balance" on={!!c.invoice_email} onChange={toggle("invoice_email")} />
        <ToggleRow title="SMS when payment is received" desc="টাকা পাওয়ার রসিদ আর বাকি টাকা" on={!!c.payment_sms} onChange={toggle("payment_sms")} />
        <ToggleRow title="Email when payment is received" on={!!c.payment_email} onChange={toggle("payment_email")} />
        <ToggleRow title="Daily summary email to me (9:40 pm)" desc="Today's sales, purchases, money in/out, expenses and total dues" on={!!c.daily_summary} onChange={toggle("daily_summary")} />
        <Row title="My email for the daily summary">{inp("owner_email", { type: "email", placeholder: userEmail, style: { width: 260 }, onBlur: () => manager && save({ owner_email: c.owner_email }) })}</Row>
      </Section>

      <Section title="Email setup" hint="Free option: your Gmail with an App Password (Google Account → Security → 2-Step Verification → App passwords).">
        <div className="form-grid" style={{ padding: "1rem" }}>
          {field("Send email with", <select className="input" value={ep} onChange={(e) => set("email_provider", e.target.value)} disabled={!manager}>
            <option value="none">Off</option><option value="smtp">Gmail / SMTP</option><option value="brevo">Brevo (API key)</option></select>)}
          {field("Sender name", inp("from_name", { placeholder: "Shekor" }))}
          {ep === "smtp" && <>
            {field("SMTP server", inp("smtp_host", { placeholder: "smtp.gmail.com" }))}
            {field("Port (TLS)", inp("smtp_port", { inputMode: "numeric", placeholder: "465" }), "465 = SSL/TLS")}
            {field("Email / username", inp("smtp_user", { placeholder: "you@gmail.com" }))}
            {field("App Password", secret("smtp_pass", "16-letter app password"), "Not your normal Gmail password")}
          </>}
          {ep === "brevo" && <>
            {field("Sender email (verified in Brevo)", inp("from_email", { placeholder: "you@yourshop.com" }))}
            {field("Brevo API key", secret("brevo_key", "xkeysib-…"))}
          </>}
        </div>
        {ep !== "none" && manager && (
          <div className="set-row">
            <div className="row" style={{ gap: ".5rem", flexWrap: "wrap" }}>
              <input className="input" style={{ width: 240 }} value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="test@email.com" />
              <button className="btn" onClick={() => test("test_email")}>Save &amp; send test email</button>
            </div>
          </div>
        )}
      </Section>

      <Section title="SMS setup" hint="Choose the SMS company later — only its API key is needed. SMS কোম্পানি পরে ঠিক করলেও চলবে; শুধু API key বসালেই চালু।">
        <div className="form-grid" style={{ padding: "1rem" }}>
          {field("SMS company", <select className="input" value={sp} onChange={(e) => set("sms_provider", e.target.value)} disabled={!manager}>
            <option value="none">Off</option><option value="bulksmsbd">BulkSMSBD</option><option value="alphasms">Alpha SMS (sms.net.bd)</option><option value="custom">Other (custom URL)</option></select>)}
          {sp !== "none" && field("API key", secret("sms_api_key", "API key from the SMS company"))}
          {sp !== "none" && field("Sender ID / Masking (optional)", inp("sms_sender_id", { placeholder: "e.g. 8809617xxxxxx or SHEKOR" }))}
          {sp === "custom" && field("Send URL", inp("sms_custom_url", { placeholder: "https://…?key={api_key}&to={to}&msg={message}" }), "Use {to}, {message}, {api_key}, {sender_id}")}
        </div>
        {sp !== "none" && manager && (
          <div className="set-row">
            <div className="row" style={{ gap: ".5rem", flexWrap: "wrap" }}>
              <input className="input" style={{ width: 200 }} value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" />
              <button className="btn" onClick={() => test("test_sms")}>Save &amp; send test SMS</button>
            </div>
          </div>
        )}
      </Section>

      {manager && <div className="row" style={{ justifyContent: "flex-end", marginBottom: "1.2rem" }}><button className="btn btn-primary btn-lg" onClick={() => save()}>Save Changes</button></div>}

      <Section title="Recently sent">
        {logs.length === 0 ? <Row title="Nothing sent yet" /> : logs.map((l) => (
          <Row key={l.id} title={`${l.channel === "sms" ? "SMS" : "Email"} → ${l.recipient}`} desc={`${new Date(l.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} · ${l.subject || ""}${l.error ? " · " + l.error : ""}`}>
            <span className={l.status === "sent" ? "text-pos" : "text-neg"} style={{ fontWeight: 600 }}>{l.status === "sent" ? "Sent" : "Failed"}</span>
          </Row>
        ))}
      </Section>
      {node}
    </div>
  );
}
