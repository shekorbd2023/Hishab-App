import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { recordPayment, refreshDocStatus } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { money } from "@/lib/util";

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const bid = ctx.business.id;
  const kind: "in" | "out" = body.kind === "out" ? "out" : "in";

  if (body.op === "create") {
    const amount = Number(body.amount) || 0;
    if (amount <= 0) return NextResponse.json({ error: "Enter an amount." }, { status: 400 });
    const res = recordPayment({
      businessId: bid, kind, partyId: body.party_id || null, accountId: body.account_id || null,
      documentId: body.document_id || null, amount, date: body.date, mode: body.mode ?? undefined,
      note: body.note ?? undefined, number: Number(body.number) > 0 ? Number(body.number) : null,
      images: Array.isArray(body.images) ? body.images : undefined, createdBy: ctx.user.name,
    });
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: "payment", entityId: res.id, summary: `${kind === "out" ? "Payment Out" : "Payment In"} #${res.number} ${money(amount)}`, after: body });
    return NextResponse.json({ ok: true, ...res });
  }

  if (body.op === "update") {
    const before = get<{ document_id: string | null }>("SELECT * FROM payments WHERE id=? AND business_id=?", [body.id, bid]);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const acc = body.account_id ? get<{ name: string }>("SELECT name FROM accounts WHERE id=?", [body.account_id]) : null;
    run("UPDATE payments SET party_id=?, account_id=?, amount=?, date=?, mode=?, note=?, number=COALESCE(?, number) WHERE id=? AND business_id=?",
      [body.party_id || null, body.account_id || null, Number(body.amount) || 0, body.date, acc?.name ?? body.mode ?? null, body.note ?? null,
       Number(body.number) > 0 ? Number(body.number) : null, body.id, bid]);
    if (before.document_id) {
      const d = get<{ total: number; kind: string }>("SELECT total, kind FROM documents WHERE id=?", [before.document_id]);
      if (d) refreshDocStatus(before.document_id, d.total, d.kind);
    }
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "payment", entityId: body.id, summary: "Edited payment", before, after: body });
    return NextResponse.json({ ok: true });
  }

  if (body.op === "delete") {
    const before = get<{ document_id: string | null }>("SELECT * FROM payments WHERE id=? AND business_id=?", [body.id, bid]);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    run("DELETE FROM payments WHERE id=? AND business_id=?", [body.id, bid]);
    if (before.document_id) {
      const d = get<{ total: number; kind: string }>("SELECT total, kind FROM documents WHERE id=?", [before.document_id]);
      if (d) refreshDocStatus(before.document_id, d.total, d.kind);
    }
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "delete", entity: "payment", entityId: body.id, summary: "Deleted payment", before });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
