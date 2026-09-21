import { get, run, tx } from "./db";
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
};

export function lineAmount(l: LineInput): number {
  const base = l.qty * l.rate;
  const disc = l.discountType === "percent" ? (base * (l.discountValue || 0)) / 100 : l.discountValue || 0;
  const afterDisc = Math.max(0, base - disc);
  const tax = (afterDisc * (l.taxRate || 0)) / 100;
  return afterDisc + tax;
}

export function computeTotals(lines: LineInput[]) {
  let subtotal = 0;
  let discount_total = 0;
  let tax_total = 0;
  for (const l of lines) {
    const base = l.qty * l.rate;
    const disc = l.discountType === "percent" ? (base * (l.discountValue || 0)) / 100 : l.discountValue || 0;
    const afterDisc = Math.max(0, base - disc);
    subtotal += base;
    discount_total += disc;
    tax_total += (afterDisc * (l.taxRate || 0)) / 100;
  }
  const total = subtotal - discount_total + tax_total;
  return { subtotal, discount_total, tax_total, total };
}

export type CreateDocInput = {
  businessId: string;
  kind: "sales_invoice" | "purchase_bill" | "quotation" | "sales_return" | "purchase_return";
  partyId?: string | null;
  date: string;
  notes?: string;
  paymentMode?: string;
  images?: string[];
  lines: LineInput[];
  paidAmount?: number; // records a payment in/out immediately
  accountId?: string | null;
  createdBy?: string;
};

export function createDocument(input: CreateDocInput): { id: string; number: number; total: number } {
  return tx(() => {
    const id = uid();
    const number = nextDocNumber(input.businessId, input.kind);
    const t = computeTotals(input.lines);
    const now = nowIso();
    run(
      `INSERT INTO documents (id, business_id, kind, number, party_id, date, notes, subtotal, discount_total, tax_total, total, status, payment_mode, images, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, input.businessId, input.kind, number, input.partyId ?? null, input.date,
        input.notes ?? null, t.subtotal, t.discount_total, t.tax_total, t.total,
        input.kind === "quotation" ? "n/a" : "unpaid", input.paymentMode ?? null,
        input.images ? JSON.stringify(input.images) : null, input.createdBy ?? null, now,
      ]
    );
    for (const l of input.lines) {
      run(
        `INSERT INTO doc_items (id, document_id, item_id, name, qty, rate, discount_type, discount_value, tax_rate, amount)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          uid(), id, l.itemId ?? null, l.name, l.qty, l.rate,
          l.discountType ?? "flat", l.discountValue ?? 0, l.taxRate ?? 0, lineAmount(l),
        ]
      );
    }
    // Optional immediate payment
    if (input.paidAmount && input.paidAmount > 0 && input.kind !== "quotation") {
      const payKind = input.kind === "sales_invoice" || input.kind === "purchase_return" ? "in" : "out";
      run(
        `INSERT INTO payments (id, business_id, kind, party_id, account_id, document_id, amount, date, mode, note, created_by, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          uid(), input.businessId, payKind, input.partyId ?? null, input.accountId ?? null, id,
          input.paidAmount, input.date, input.paymentMode ?? null, "Auto payment on document", input.createdBy ?? null, now,
        ]
      );
    }
    refreshDocStatus(id, t.total, input.kind);
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
  createdBy?: string;
}) {
  const id = uid();
  run(
    `INSERT INTO payments (id, business_id, kind, party_id, account_id, document_id, amount, date, mode, note, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, input.businessId, input.kind, input.partyId ?? null, input.accountId ?? null,
      input.documentId ?? null, input.amount, input.date, input.mode ?? null, input.note ?? null,
      input.createdBy ?? null, nowIso(),
    ]
  );
  if (input.documentId) {
    const d = get<{ total: number; kind: string }>(
      "SELECT total, kind FROM documents WHERE id = ?",
      [input.documentId]
    );
    if (d) refreshDocStatus(input.documentId, d.total, d.kind);
  }
  return id;
}
