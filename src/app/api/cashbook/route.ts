import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { uid, nowIso } from "@/lib/util";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bid = ctx.business.id;
  const body = await req.json();
  const table = body.kind === "income" ? "incomes" : "expenses";
  const op = body.op as string;

  if (op === "create") {
    const id = uid();
    run(`INSERT INTO ${table} (id, business_id, category, account_id, amount, date, note, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, bid, body.category ?? null, body.account_id ?? null, Number(body.amount) || 0, body.date, body.note ?? null, ctx.user.name, nowIso()]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: body.kind, entityId: id, summary: `${body.kind} ${body.amount}`, after: body });
    return NextResponse.json({ ok: true, id });
  }
  if (op === "delete") {
    const before = get(`SELECT * FROM ${table} WHERE id=? AND business_id=?`, [body.id, bid]);
    run(`DELETE FROM ${table} WHERE id=? AND business_id=?`, [body.id, bid]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "delete", entity: body.kind, entityId: body.id, summary: `Deleted ${body.kind}`, before });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
