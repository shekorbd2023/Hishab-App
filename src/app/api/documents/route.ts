import { NextResponse } from "next/server";
import { requireCtx, can, getMember } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { createDocument, updateDocument, cloneDocument, type LineInput, type Charge, type DocKind } from "@/lib/actions";
import { logAudit } from "@/lib/audit";

const KIND_MODULE: Record<string, string> = {
  sales_invoice: "sales", quotation: "sales", sales_return: "sales",
  purchase_bill: "purchase", purchase_return: "purchase",
};
const KINDS = ["sales_invoice", "purchase_bill", "quotation", "sales_return", "purchase_return"];

function parseLines(raw: unknown): LineInput[] {
  return ((raw as LineInput[]) || [])
    .filter((l) => l && l.name && Number(l.qty) > 0)
    .map((l) => ({
      itemId: l.itemId ?? null, name: String(l.name), qty: Number(l.qty) || 0, rate: Number(l.rate) || 0,
      discountType: l.discountType === "percent" ? "percent" : "flat", discountValue: Number(l.discountValue) || 0,
      taxRate: Number(l.taxRate) || 0, unit: l.unit ?? null,
    }));
}
function parseCharges(raw: unknown): Charge[] {
  return ((raw as Charge[]) || [])
    .map((c) => ({ title: String(c?.title || "").trim(), amount: Number(c?.amount) || 0 }))
    .filter((c) => c.title && c.amount);
}

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bid = ctx.business.id;
  const body = await req.json();
  const op = body.op as string;
  const m = getMember(bid, ctx.user.id);
  const allow = (kind: string, action: string) => can(ctx.role, m?.permissions ?? null, KIND_MODULE[kind] || "sales", action);

  if (op === "create" || op === "update") {
    let kind = body.kind as string;
    if (op === "update") {
      const cur = get<{ kind: string }>("SELECT kind FROM documents WHERE id=? AND business_id=?", [body.id, bid]);
      if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });
      kind = cur.kind;
    }
    if (!KINDS.includes(kind)) return NextResponse.json({ error: "Bad kind" }, { status: 400 });
    if (!allow(kind, op === "create" ? "create" : "edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const lines = parseLines(body.lines);
    if (lines.length === 0) return NextResponse.json({ error: "Add at least one item." }, { status: 400 });
    const manual = Number(body.number) > 0 ? Math.floor(Number(body.number)) : null;
    if (manual) {
      const clash = get<{ id: string }>("SELECT id FROM documents WHERE business_id=? AND kind=? AND number=?", [bid, kind, manual]);
      if (clash && clash.id !== body.id) return NextResponse.json({ error: `Number ${manual} is already used.` }, { status: 400 });
    }
    const input = {
      businessId: bid, kind: kind as DocKind, partyId: body.party_id || null, date: body.date,
      number: manual, notes: body.notes ?? null, images: Array.isArray(body.images) ? body.images : undefined,
      lines, charges: parseCharges(body.charges), docDiscount: Number(body.doc_discount) || 0, roundOff: Number(body.round_off) || 0,
      dueDate: body.due_date || null, paidAmount: Number(body.paid_amount) || 0, accountId: body.account_id || null,
      createdBy: ctx.user.name,
    };
    const res = op === "create" ? createDocument(input) : updateDocument(body.id, input);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: op, entity: kind, entityId: res.id, summary: `${op === "create" ? "Created" : "Edited"} ${kind} #${res.number} — ${res.total}` });
    return NextResponse.json({ ok: true, ...res });
  }

  if (op === "duplicate" || op === "convert") {
    const src = get<{ kind: string; number: number }>("SELECT kind, number FROM documents WHERE id=? AND business_id=?", [body.id, bid]);
    if (!src) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const target = (op === "duplicate" ? src.kind : body.to) as DocKind;
    if (!KINDS.includes(target)) return NextResponse.json({ error: "Bad target" }, { status: 400 });
    if (!allow(target, "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const res = cloneDocument(bid, body.id, target, ctx.user.name);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: target, entityId: res.id, summary: `${op === "duplicate" ? "Duplicated" : "Converted"} ${src.kind} #${src.number} → ${target} #${res.number}` });
    return NextResponse.json({ ok: true, ...res });
  }

  if (op === "delete") {
    const before = get<{ kind: string; number: number }>("SELECT kind, number FROM documents WHERE id=? AND business_id=?", [body.id, bid]);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!allow(before.kind, "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    run("DELETE FROM payments WHERE document_id=? AND is_auto=1", [body.id]);
    run("DELETE FROM documents WHERE id=? AND business_id=?", [body.id, bid]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "delete", entity: before.kind, entityId: body.id, summary: `Deleted ${before.kind} #${before.number}`, before });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
