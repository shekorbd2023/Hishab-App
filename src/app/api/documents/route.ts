import { NextResponse } from "next/server";
import { requireCtx, can, getMember } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { createDocument, type LineInput } from "@/lib/actions";
import { logAudit } from "@/lib/audit";

const KIND_MODULE: Record<string, string> = {
  sales_invoice: "sales", quotation: "sales", sales_return: "sales",
  purchase_bill: "purchase", purchase_return: "purchase",
};

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bid = ctx.business.id;
  const body = await req.json();
  const op = body.op as string;

  if (op === "create") {
    const kind = body.kind as string;
    const mod = KIND_MODULE[kind] || "sales";
    const m = getMember(bid, ctx.user.id);
    if (!can(ctx.role, m?.permissions ?? null, mod, "create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const lines: LineInput[] = (body.lines || []).filter((l: LineInput) => l.name && Number(l.qty) > 0).map((l: LineInput) => ({
      itemId: l.itemId ?? null, name: l.name, qty: Number(l.qty) || 0, rate: Number(l.rate) || 0,
      discountType: l.discountType === "percent" ? "percent" : "flat", discountValue: Number(l.discountValue) || 0,
      taxRate: Number(l.taxRate) || 0,
    }));
    if (lines.length === 0) return NextResponse.json({ error: "Add at least one item." }, { status: 400 });
    const res = createDocument({
      businessId: bid, kind: kind as never, partyId: body.party_id ?? null, date: body.date,
      notes: body.notes ?? null, paymentMode: body.payment_mode ?? null, images: body.images ?? undefined,
      lines, paidAmount: Number(body.paid_amount) || 0, accountId: body.account_id ?? null, createdBy: ctx.user.name,
    });
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: kind, entityId: res.id, summary: `${kind} #${res.number} — ${res.total}` });
    return NextResponse.json({ ok: true, ...res });
  }

  if (op === "delete") {
    const before = get<{ kind: string; number: number }>("SELECT kind, number FROM documents WHERE id=? AND business_id=?", [body.id, bid]);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    run("DELETE FROM documents WHERE id=? AND business_id=?", [body.id, bid]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "delete", entity: before.kind, entityId: body.id, summary: `Deleted ${before.kind} #${before.number}`, before });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
