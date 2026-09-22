// Server-side loaders for the printable documents (invoice preview, money receipt) and the
// payment screens. Shared by /doc/[id], /receipt/[id], /payment-in and /payment-out.
import { all, get } from "@/lib/db";
import { docPaid, partyBalances, partyLedger } from "@/lib/domain";
import { getSettings, type BizSettings } from "@/lib/settings";
import type { Letterhead, InvoiceData, InvoiceLine } from "@/components/InvoiceDocument";
import type { ReceiptData } from "@/components/ReceiptDocument";

export function loadLetterhead(bid: string, s: BizSettings): Letterhead {
  const b = get<{ name: string; logo: string | null; phone: string | null; email: string | null; address: string | null; district: string | null; reg_no: string | null }>(
    "SELECT name, logo, phone, email, address, district, reg_no FROM businesses WHERE id = ?", [bid]
  );
  let bank: string | null = null;
  if (s.show_bank_account) {
    if (s.bank_account_text?.trim()) bank = s.bank_account_text.trim();
    else {
      const acc = get<{ name: string; bank_name: string | null; holder: string | null; account_no: string | null }>(
        "SELECT name, bank_name, holder, account_no FROM accounts WHERE business_id = ? AND type = 'bank' AND account_no IS NOT NULL AND account_no != '' ORDER BY created_at LIMIT 1", [bid]
      );
      if (acc) bank = [acc.bank_name || acc.name, acc.holder ? `A/C Name: ${acc.holder}` : "", `A/C No: ${acc.account_no}`].filter(Boolean).join("\n");
    }
  }
  return {
    name: b?.name || "",
    logo: s.show_business_logo ? b?.logo || null : null,
    showLogo: s.show_business_logo,
    phone: s.show_phone ? b?.phone || null : null,
    email: s.show_email ? b?.email || null : null,
    address: s.show_address ? [b?.address, b?.district].filter(Boolean).join(", ") || null : null,
    regNo: s.show_reg_no ? b?.reg_no || null : null,
    bank,
    bankQr: s.show_bank_qr ? s.bank_qr : null,
    signature: s.signature,
    terms: s.terms || "",
    color: s.invoice_color || "#1f9d6f",
    hideBranding: s.hide_branding,
  };
}

function prefixFor(s: BizSettings, kind: string): string {
  if (!s.prefixes_enabled) return "";
  if (kind === "sales_invoice") return s.prefix_sales || "";
  if (kind === "sales_return") return s.prefix_sales_return || "";
  if (kind === "quotation") return s.prefix_quotation || "";
  if (kind === "payment_in" || kind === "in") return s.prefix_payment_in || "";
  return "";
}

/** Balance of a party just before and right after one ledger entry (doc or payment). */
function balanceAround(bid: string, partyId: string, key: string, relatedKeys: string[] = []): { before: number; after: number } | null {
  const rows = partyLedger(bid, partyId);
  const idx = rows.findIndex((r) => r.key === key);
  if (idx < 0) return null;
  const keys = new Set([key, ...relatedKeys]);
  // balance before = running balance at the entry minus the entry itself and any related rows sorted before it
  let before = rows[idx].balance - rows[idx].delta;
  for (let i = 0; i < idx; i++) if (keys.has(rows[i].key)) before -= rows[i].delta;
  let after = before;
  for (const r of rows) if (keys.has(r.key)) after += r.delta;
  return { before: Math.round(before * 100) / 100, after: Math.round(after * 100) / 100 };
}

export function loadInvoice(bid: string, id: string): { data: InvoiceData; settings: BizSettings; letterhead: Letterhead; partyPhone: string | null; partyId: string | null } | null {
  const d = get<{
    id: string; kind: string; number: number; date: string; due_date: string | null; notes: string | null; subtotal: number;
    discount_total: number; tax_total: number; total: number; status: string; payment_mode: string | null; party_id: string | null;
    charges: string | null; round_off: number; doc_discount: number; account_id: string | null; created_at: string;
  }>("SELECT * FROM documents WHERE id = ? AND business_id = ?", [id, bid]);
  if (!d) return null;
  const s = getSettings(bid);
  const letterhead = loadLetterhead(bid, s);
  const party = d.party_id
    ? get<{ name: string; phone: string | null; address: string | null; email: string | null; vat: string | null }>("SELECT name, phone, address, email, vat FROM parties WHERE id = ?", [d.party_id])
    : null;
  const rows = all<{ name: string; qty: number; rate: number; discount_type: string; discount_value: number; tax_rate: number; amount: number; unit: string | null }>(
    "SELECT name, qty, rate, discount_type, discount_value, tax_rate, amount, unit FROM doc_items WHERE document_id = ? ORDER BY rowid", [id]
  );
  const lines: InvoiceLine[] = rows.map((r) => {
    const base = r.qty * r.rate;
    const disc = r.discount_type === "percent" ? (base * (r.discount_value || 0)) / 100 : r.discount_value || 0;
    return {
      name: r.name, qty: r.qty, rate: r.rate, unit: r.unit || null, discount: Math.round(disc * 100) / 100,
      discountPct: base > 0 ? Math.round((disc / base) * 10000) / 100 : 0, taxRate: r.tax_rate || 0, amount: r.amount,
    };
  });
  let charges: { title: string; amount: number }[] = [];
  try { charges = d.charges ? (JSON.parse(d.charges) as { title: string; amount: number }[]).filter((c) => c && c.title && Number(c.amount)) : []; } catch { charges = []; }
  const subTotal = lines.reduce((a, l) => a + l.amount, 0);
  const received = d.kind === "quotation" ? 0 : docPaid(id);
  const account = d.account_id ? get<{ name: string }>("SELECT name FROM accounts WHERE id = ?", [d.account_id]) : null;

  let prevBalance: number | null = null;
  let currentBalance: number | null = null;
  if (s.show_party_balance && d.party_id && d.kind !== "quotation") {
    const pays = all<{ id: string }>("SELECT id FROM payments WHERE document_id = ?", [id]).map((p) => "p" + p.id);
    const b = balanceAround(bid, d.party_id, "d" + id, pays);
    if (b) { prevBalance = b.before; currentBalance = b.after; }
    else { currentBalance = partyBalances(bid)[d.party_id] ?? 0; }
  }

  const data: InvoiceData = {
    kind: d.kind,
    number: `${prefixFor(s, d.kind)}${d.number}`,
    date: d.date,
    time: d.created_at,
    dueDate: d.due_date,
    paymentMode: received > 0 ? d.payment_mode || account?.name || null : null,
    party: party ? { name: party.name, phone: party.phone, address: party.address, email: party.email, vat: party.vat } : null,
    lines,
    subTotal: Math.round(subTotal * 100) / 100,
    taxTotal: d.tax_total || 0,
    charges,
    docDiscount: d.doc_discount || 0,
    roundOff: d.round_off || 0,
    total: d.total,
    received,
    prevBalance,
    currentBalance,
    notes: d.notes,
    status: d.status,
  };
  return { data, settings: s, letterhead, partyPhone: party?.phone || null, partyId: d.party_id };
}

export function loadReceipt(bid: string, id: string): { data: ReceiptData; settings: BizSettings; letterhead: Letterhead; raw: PaymentRow } | null {
  const p = get<PaymentRow & { created_at: string }>(
    "SELECT id, kind, number, party_id, account_id, document_id, amount, date, mode, note, images, is_auto, created_at FROM payments WHERE id = ? AND business_id = ?", [id, bid]
  );
  if (!p) return null;
  const s = getSettings(bid);
  const letterhead = loadLetterhead(bid, s);
  const party = p.party_id ? get<{ name: string; phone: string | null; address: string | null }>("SELECT name, phone, address FROM parties WHERE id = ?", [p.party_id]) : null;
  const account = p.account_id ? get<{ name: string }>("SELECT name FROM accounts WHERE id = ?", [p.account_id]) : null;
  const doc = p.document_id ? get<{ kind: string; number: number }>("SELECT kind, number FROM documents WHERE id = ?", [p.document_id]) : null;
  let before: number | null = null, after: number | null = null;
  if (s.show_party_balance && p.party_id) {
    const b = balanceAround(bid, p.party_id, "p" + p.id);
    if (b) { before = b.before; after = b.after; }
  }
  const data: ReceiptData = {
    kind: p.kind === "out" ? "out" : "in",
    number: p.kind === "in" ? `${prefixFor(s, "in")}${p.number}` : String(p.number),
    date: p.date,
    time: p.created_at,
    amount: p.amount,
    mode: account?.name || p.mode || null,
    party: party ? { name: party.name, phone: party.phone, address: party.address } : null,
    note: p.note,
    against: doc ? { kind: doc.kind, number: String(doc.number) } : null,
    prevBalance: before,
    currentBalance: after,
  };
  return { data, settings: s, letterhead, raw: p };
}

export type PaymentRow = {
  id: string; kind: string; number: number; party_id: string | null; account_id: string | null; document_id: string | null;
  amount: number; date: string; mode: string | null; note: string | null; images: string | null; is_auto: number;
};

/** Parties (with live balance) and accounts for the PaymentDialog pickers. */
export function paymentPickers(bid: string) {
  const bal = partyBalances(bid);
  const parties = all<{ id: string; name: string; phone: string | null; type: string }>(
    "SELECT id, name, phone, type FROM parties WHERE business_id = ? ORDER BY name COLLATE NOCASE", [bid]
  ).map((p) => ({ ...p, balance: Math.round((bal[p.id] ?? 0) * 100) / 100 }));
  const accounts = all<{ id: string; name: string; type: string }>(
    "SELECT id, name, type FROM accounts WHERE business_id = ? ORDER BY created_at", [bid]
  );
  return { parties, accounts };
}
