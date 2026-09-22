// Server-side loaders for transaction lists, the document editor and Quick POS.
import { all, get } from "./db";
import { partyBalances, itemStocks } from "./domain";
import { getSettings } from "./settings";

export type EdParty = { id: string; name: string; phone: string | null; type: string; balance: number };
export type EdItem = {
  id: string; name: string; category: string | null; type: string; code: string | null; unit: string | null;
  sales_price: number; purchase_price: number; mrp_price: number; wholesale_price: number; low_stock_alert: number; stock: number;
};
export type EdAccount = { id: string; name: string; type: string };
export type EdSettings = {
  cash_sale_default: boolean; due_date_reminder: boolean; additional_charges_enabled: boolean; charge_presets: string[];
  round_off_enabled: boolean; low_stock_dialog: boolean; prevent_out_of_stock: boolean; barcode_scan: boolean;
  print_type: "regular" | "thermal"; privacy_mode: boolean; prefix: string; qty_decimals: number;
};

export function editorSettings(bid: string, kind: string): EdSettings {
  const s = getSettings(bid);
  const prefixKey = kind === "sales_invoice" ? "prefix_sales" : kind === "sales_return" ? "prefix_sales_return" : kind === "quotation" ? "prefix_quotation" : null;
  return {
    cash_sale_default: s.cash_sale_default, due_date_reminder: s.due_date_reminder,
    additional_charges_enabled: s.additional_charges_enabled, charge_presets: s.charge_presets || [],
    round_off_enabled: s.round_off_enabled, low_stock_dialog: s.low_stock_dialog, prevent_out_of_stock: s.prevent_out_of_stock,
    barcode_scan: s.barcode_scan, print_type: s.print_type, privacy_mode: s.privacy_mode,
    prefix: s.prefixes_enabled && prefixKey ? String(s[prefixKey] || "") : "", qty_decimals: s.qty_decimals,
  };
}

export function editorData(bid: string) {
  const bal = partyBalances(bid);
  const parties: EdParty[] = all<{ id: string; name: string; phone: string | null; type: string }>(
    "SELECT id, name, phone, type FROM parties WHERE business_id = ? ORDER BY name COLLATE NOCASE", [bid]
  ).map((p) => ({ ...p, balance: Math.round((bal[p.id] || 0) * 100) / 100 }));
  const stocks = itemStocks(bid);
  const items: EdItem[] = all<Omit<EdItem, "stock">>(
    `SELECT id, name, category, type, code, unit, sales_price, purchase_price, mrp_price, wholesale_price, low_stock_alert
     FROM items WHERE business_id = ? ORDER BY name COLLATE NOCASE`, [bid]
  ).map((it) => ({ ...it, stock: Math.round((stocks[it.id] || 0) * 1000) / 1000 }));
  const accounts = all<EdAccount>("SELECT id, name, type FROM accounts WHERE business_id = ? ORDER BY created_at", [bid]);
  return { parties, items, accounts };
}

export function peekNextNumber(bid: string, kind: string): number {
  const c = get<{ value: number }>("SELECT value FROM counters WHERE business_id = ? AND kind = ?", [bid, kind]);
  return (c?.value ?? 0) + 1;
}

export type DocRow = {
  id: string; number: number; date: string; party: string | null; party_id: string | null; total: number; paid: number;
  unpaid: number; status: string; created_at: string;
};

/** All documents of one kind with paid/unpaid in two queries (fast for hundreds of rows). */
export function listDocs(bid: string, kind: string): DocRow[] {
  const rows = all<{ id: string; number: number; date: string; party: string | null; party_id: string | null; total: number; status: string; created_at: string }>(
    `SELECT d.id, d.number, d.date, p.name party, d.party_id, d.total, d.status, d.created_at
     FROM documents d LEFT JOIN parties p ON p.id = d.party_id
     WHERE d.business_id = ? AND d.kind = ? ORDER BY d.date DESC, d.number DESC`, [bid, kind]
  );
  const paid: Record<string, number> = {};
  for (const r of all<{ document_id: string; s: number }>(
    `SELECT pay.document_id, SUM(pay.amount) s FROM payments pay JOIN documents d ON d.id = pay.document_id
     WHERE d.business_id = ? AND d.kind = ? GROUP BY pay.document_id`, [bid, kind]
  )) paid[r.document_id] = r.s;
  return rows.map((r) => {
    const p = paid[r.id] || 0;
    const unpaid = kind === "quotation" ? 0 : Math.max(0, Math.round((r.total - p) * 100) / 100);
    return { ...r, paid: p, unpaid };
  });
}

export type EditDoc = {
  id: string; kind: string; number: number; party_id: string | null; date: string; notes: string | null; due_date: string | null;
  account_id: string | null; doc_discount: number; round_off: number; charges: { title: string; amount: number }[]; images: string[];
  received: number; lines: { itemId: string | null; name: string; qty: number; rate: number; discountType: "flat" | "percent"; discountValue: number; taxRate: number; unit: string | null }[];
};

export function loadDocForEdit(bid: string, id: string): EditDoc | null {
  const d = get<{
    id: string; kind: string; number: number; party_id: string | null; date: string; notes: string | null; due_date: string | null;
    account_id: string | null; doc_discount: number; round_off: number; charges: string | null; images: string | null; payment_mode: string | null;
  }>("SELECT * FROM documents WHERE id = ? AND business_id = ?", [id, bid]);
  if (!d) return null;
  const lines = all<{ item_id: string | null; name: string; qty: number; rate: number; discount_type: string; discount_value: number; tax_rate: number; unit: string | null }>(
    "SELECT item_id, name, qty, rate, discount_type, discount_value, tax_rate, unit FROM doc_items WHERE document_id = ? ORDER BY rowid", [id]
  );
  const auto = get<{ s: number; acc: string | null }>(
    "SELECT COALESCE(SUM(amount),0) s, MAX(account_id) acc FROM payments WHERE document_id = ? AND is_auto = 1", [id]
  );
  let accountId = d.account_id || auto?.acc || null;
  if (!accountId && d.payment_mode) accountId = get<{ id: string }>("SELECT id FROM accounts WHERE business_id=? AND name=?", [bid, d.payment_mode])?.id ?? null;
  const parse = <T,>(s: string | null, f: T): T => { try { return s ? (JSON.parse(s) as T) : f; } catch { return f; } };
  return {
    id: d.id, kind: d.kind, number: d.number, party_id: d.party_id, date: d.date, notes: d.notes, due_date: d.due_date,
    account_id: accountId, doc_discount: d.doc_discount || 0, round_off: d.round_off || 0,
    charges: parse(d.charges, [] as { title: string; amount: number }[]).map((c) => ({ title: String(c.title), amount: Number(c.amount) || 0 })),
    images: parse(d.images, [] as string[]), received: auto?.s || 0,
    lines: lines.map((l) => ({
      itemId: l.item_id, name: l.name, qty: l.qty, rate: l.rate, discountType: l.discount_type === "percent" ? "percent" : "flat",
      discountValue: l.discount_value || 0, taxRate: l.tax_rate || 0, unit: l.unit,
    })),
  };
}
