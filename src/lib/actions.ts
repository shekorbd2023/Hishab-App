import { get, run, tx, all } from "./db";
import { uid, nowIso } from "./util";
import { nextDocNumber } from "./auth";
import { docPaid } from "./domain";

export type LineInput = {
  itemId?: string | null;
  name: string;
  qty: number;
  rate: number;
  discountType?: "flat" | "percent";
  discountValue?: number;
  taxRate?: number;
  unit?: string | null;
};

export type Charge = { title: string; amount: number };

export function lineAmount(l: LineInput): number {
  const base = l.qty * l.rate;
  const disc = l.discountType === "percent" ? (base * (l.discountValue || 0)) / 100 : l.discountValue || 0;
  const afterDisc = Math.max(0, base - disc);
  const tax = (afterDisc * (l.taxRate || 0)) / 100;
  return round2(afterDisc + tax);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Document totals, Karbar style:
 *   subtotal       = Σ qty × rate                      (before line discounts)
 *   discount_total = Σ line discounts + bill discount
 *   tax_total      = Σ line tax
 *   total          = subtotal − discount_total + tax_total + Σ additional charges + round_off
 */
export function computeTotals(
  lines: LineInput[],
  extras: { docDiscount?: number; charges?: Charge[]; roundOff?: number } = {}
) {
  let subtotal = 0;
  let line_discount = 0;
  let tax_total = 0;
  for (const l of lines) {
    const base = l.qty * l.rate;
    const disc = l.discountType === "percent" ? (base * (l.discountValue || 0)) / 100 : l.discountValue || 0;
    const afterDisc = Math.max(0, base - disc);
    subtotal += base;
    line_discount += disc;
    tax_total += (afterDisc * (l.taxRate || 0)) / 100;
  }
  const docDiscount = Number(extras.docDiscount) || 0;
  const charges_total = (extras.charges || []).reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const round_off = Number(extras.roundOff) || 0;
  const discount_total = line_discount + docDiscount;
  const billing_total = subtotal - line_discount + tax_total; // "Sub Total" shown on the invoice
  const total = round2(billing_total - docDiscount + charges_total + round_off);
  return {
    subtotal: round2(subtotal),
    line_discount: round2(line_discount),
    discount_total: round2(discount_total),
    tax_total: round2(tax_total),
    billing_total: round2(billing_total),
    charges_total: round2(charges_total),
    round_off: round2(round_off),
    total,
  };
}

export type DocKind = "sales_invoice" | "purchase_bill" | "quotation" | "sales_return" | "purchase_return";

export type CreateDocInput = {
  businessId: string;
  kind: DocKind;
  partyId?: string | null;
  date: string;
  number?: number | null; // manual number; auto when omitted
  notes?: string | null;
  paymentMode?: string | null;
  images?: string[];
  lines: LineInput[];
  charges?: Charge[];
  docDiscount?: number;
  roundOff?: number;
  dueDate?: string | null;
  paidAmount?: number; // records a payment in/out linked to the document
  accountId?: string | null;
  sourceId?: string | null;
  createdBy?: string;
};

/** Sales & purchase-return bring money IN; purchase & sales-return send money OUT. */
export function payKindFor(kind: string): "in" | "out" {
  return kind === "sales_invoice" || kind === "purchase_return" ? "in" : "out";
}

function accountName(accountId?: string | null): string | null {
  if (!accountId) return null;
  return get<{ name: string }>("SELECT name FROM accounts WHERE id = ?", [accountId])?.name ?? null;
}

function bumpCounter(businessId: string, kind: string, n: number) {
  const c = get<{ value: number }>("SELECT value FROM counters WHERE business_id=? AND kind=?", [businessId, kind]);
  if (!c) run("INSERT INTO counters (business_id, kind, value) VALUES (?,?,?)", [businessId, kind, n]);
  else if (n > c.value) run("UPDATE counters SET value=? WHERE business_id=? AND kind=?", [n, businessId, kind]);
}

/** Peek (without consuming) the next number for a counter kind. */
export function peekNumber(businessId: string, kind: string): number {
  const c = get<{ value: number }>("SELECT value FROM counters WHERE business_id=? AND kind=?", [businessId, kind]);
  return (c?.value ?? 0) + 1;
}

/** Take a number: explicit (manual) numbers bump the counter so auto numbering continues after them. */
export function takeNumber(businessId: string, kind: string, manual?: number | null): number {
  if (manual && manual > 0) {
    bumpCounter(businessId, kind, manual);
    return manual;
  }
  return nextDocNumber(businessId, kind);
}

function insertLines(documentId: string, lines: LineInput[]) {
  for (const l of lines) {
    run(
      `INSERT INTO doc_items (id, document_id, item_id, name, qty, rate, discount_type, discount_value, tax_rate, amount, unit)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uid(), documentId, l.itemId ?? null, l.name, l.qty, l.rate,
        l.discountType ?? "flat", l.discountValue ?? 0, l.taxRate ?? 0, lineAmount(l), l.unit ?? null,
      ]
    );
  }
}

function insertAutoPayment(input: CreateDocInput, documentId: string, amount: number) {
  if (!amount || amount <= 0 || input.kind === "quotation") return;
  const kind = payKindFor(input.kind);
  run(
    `INSERT INTO payments (id, business_id, kind, party_id, account_id, document_id, amount, date, mode, note, number, is_auto, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      uid(), input.businessId, kind, input.partyId ?? null, input.accountId ?? null, documentId,
      amount, input.date, input.paymentMode ?? accountName(input.accountId), null, 0, 1, input.createdBy ?? null, nowIso(),
    ]
  );
}

export function createDocument(input: CreateDocInput): { id: string; number: number; total: number } {
  return tx(() => {
    const id = uid();
    const number = takeNumber(input.businessId, input.kind, input.number);
    const t = computeTotals(input.lines, { docDiscount: input.docDiscount, charges: input.charges, roundOff: input.roundOff });
    const now = nowIso();
    run(
      `INSERT INTO documents (id, business_id, kind, number, party_id, date, notes, subtotal, discount_total, tax_total, total, status,
         payment_mode, images, charges, round_off, doc_discount, account_id, due_date, manual_number, source_id, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, input.businessId, input.kind, number, input.partyId ?? null, input.date, input.notes ?? null,
        t.subtotal, t.discount_total, t.tax_total, t.total, input.kind === "quotation" ? "n/a" : "unpaid",
        input.paymentMode ?? accountName(input.accountId), input.images && input.images.length ? JSON.stringify(input.images) : null,
        input.charges && input.charges.length ? JSON.stringify(input.charges.filter((c) => c.title && Number(c.amount))) : null,
        t.round_off, Number(input.docDiscount) || 0, input.accountId ?? null, input.dueDate ?? null,
        input.number ? String(input.number) : null, input.sourceId ?? null, input.createdBy ?? null, now,
      ]
    );
    insertLines(id, input.lines);
    insertAutoPayment(input, id, Math.min(Number(input.paidAmount) || 0, t.total || Number(input.paidAmount) || 0));
    refreshDocStatus(id, t.total, input.kind);
    return { id, number, total: t.total };
  });
}

/** Edit an existing document: replaces its lines, charges and the payment made with it. */
export function updateDocument(id: string, input: CreateDocInput): { id: string; number: number; total: number } {
  return tx(() => {
    const cur = get<{ number: number; kind: string }>("SELECT number, kind FROM documents WHERE id=? AND business_id=?", [id, input.businessId]);
    if (!cur) throw new Error("Document not found");
    const number = input.number && input.number > 0 ? input.number : cur.number;
    if (number !== cur.number) bumpCounter(input.businessId, cur.kind, number);
    const t = computeTotals(input.lines, { docDiscount: input.docDiscount, charges: input.charges, roundOff: input.roundOff });
    run(
      `UPDATE documents SET number=?, party_id=?, date=?, notes=?, subtotal=?, discount_total=?, tax_total=?, total=?,
         payment_mode=?, images=?, charges=?, round_off=?, doc_discount=?, account_id=?, due_date=? WHERE id=?`,
      [
        number, input.partyId ?? null, input.date, input.notes ?? null, t.subtotal, t.discount_total, t.tax_total, t.total,
        input.paymentMode ?? accountName(input.accountId), input.images && input.images.length ? JSON.stringify(input.images) : null,
        input.charges && input.charges.length ? JSON.stringify(input.charges.filter((c) => c.title && Number(c.amount))) : null,
        t.round_off, Number(input.docDiscount) || 0, input.accountId ?? null, input.dueDate ?? null, id,
      ]
    );
    run("DELETE FROM doc_items WHERE document_id=?", [id]);
    insertLines(id, input.lines);
    run("DELETE FROM payments WHERE document_id=? AND is_auto=1", [id]);
    insertAutoPayment({ ...input, kind: cur.kind as DocKind }, id, Number(input.paidAmount) || 0);
    // keep party on any other linked payments in sync
    run("UPDATE payments SET party_id=? WHERE document_id=?", [input.partyId ?? null, id]);
    refreshDocStatus(id, t.total, cur.kind);
    return { id, number, total: t.total };
  });
}

export function refreshDocStatus(documentId: string, total: number, kind: string) {
  if (kind === "quotation") return;
  const paid = docPaid(documentId);
  let status = "unpaid";
  if (paid >= total - 1e-6 && total > 0) status = "paid";
  else if (paid > 0) status = "partial";
  else if (total === 0) status = "paid";
  run("UPDATE documents SET status = ? WHERE id = ?", [status, documentId]);
}

export function recordPayment(input: {
  businessId: string;
  kind: "in" | "out";
  partyId?: string | null;
  accountId?: string | null;
  documentId?: string | null;
  amount: number;
  date: string;
  mode?: string;
  note?: string;
  number?: number | null;
  images?: string[];
  createdBy?: string;
}) {
  const id = uid();
  const number = takeNumber(input.businessId, input.kind === "in" ? "payment_in" : "payment_out", input.number);
  run(
    `INSERT INTO payments (id, business_id, kind, party_id, account_id, document_id, amount, date, mode, note, number, is_auto, images, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, input.businessId, input.kind, input.partyId ?? null, input.accountId ?? null,
      input.documentId ?? null, input.amount, input.date, input.mode ?? accountName(input.accountId), input.note ?? null,
      number, 0, input.images && input.images.length ? JSON.stringify(input.images) : null, input.createdBy ?? null, nowIso(),
    ]
  );
  if (input.documentId) {
    const d = get<{ total: number; kind: string }>("SELECT total, kind FROM documents WHERE id = ?", [input.documentId]);
    if (d) refreshDocStatus(input.documentId, d.total, d.kind);
  }
  return { id, number };
}

/** Add Money / Reduce Money on an account (owner capital, drawings, corrections). */
export function adjustAccount(input: {
  businessId: string; accountId: string; kind: "add" | "reduce"; amount: number; date: string; note?: string | null; createdBy?: string;
}) {
  const id = uid();
  run(
    `INSERT INTO account_adjustments (id, business_id, account_id, kind, amount, date, note, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, input.businessId, input.accountId, input.kind, input.amount, input.date, input.note ?? null, input.createdBy ?? null, nowIso()]
  );
  return id;
}

/** Duplicate a document (Karbar: "Duplicate Transaction") or convert it (e.g. sale → sales return, quotation → invoice). */
export function cloneDocument(businessId: string, sourceId: string, targetKind: DocKind, createdBy?: string) {
  const d = get<{
    kind: string; party_id: string | null; notes: string | null; charges: string | null; doc_discount: number;
    round_off: number; account_id: string | null; payment_mode: string | null;
  }>("SELECT * FROM documents WHERE id=? AND business_id=?", [sourceId, businessId]);
  if (!d) throw new Error("Not found");
  const lines = all<{ item_id: string | null; name: string; qty: number; rate: number; discount_type: string; discount_value: number; tax_rate: number; unit: string | null }>(
    "SELECT item_id, name, qty, rate, discount_type, discount_value, tax_rate, unit FROM doc_items WHERE document_id=?", [sourceId]
  );
  return createDocument({
    businessId, kind: targetKind, partyId: d.party_id, date: new Date().toISOString().slice(0, 10), notes: d.notes,
    lines: lines.map((l) => ({ itemId: l.item_id, name: l.name, qty: l.qty, rate: l.rate, discountType: l.discount_type as "flat" | "percent", discountValue: l.discount_value, taxRate: l.tax_rate, unit: l.unit })),
    charges: d.charges ? JSON.parse(d.charges) : [], docDiscount: d.doc_discount, roundOff: d.round_off,
    accountId: d.account_id, paymentMode: d.payment_mode, sourceId, createdBy,
  });
}
