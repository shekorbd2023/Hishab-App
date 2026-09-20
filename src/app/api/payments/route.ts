import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";
import { recordPayment } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { money } from "@/lib/util";

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.op !== "create") return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  const bid = ctx.business.id;
  const id = recordPayment({
    businessId: bid,
    kind: body.kind === "out" ? "out" : "in",
    partyId: body.party_id ?? null,
    accountId: body.account_id ?? null,
    documentId: body.document_id ?? null,
    amount: Number(body.amount) || 0,
    date: body.date,
    mode: body.mode ?? null,
    note: body.note ?? null,
    createdBy: ctx.user.name,
  });
  logAudit({
    businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create",
    entity: "payment", entityId: id, summary: `${body.kind === "out" ? "Payment out" : "Payment in"} ${money(Number(body.amount) || 0)}`, after: body,
  });
  return NextResponse.json({ ok: true, id });
}
