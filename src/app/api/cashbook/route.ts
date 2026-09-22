import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { uid, nowIso } from "@/lib/util";
import { logAudit } from "@/lib/audit";
import { takeNumber } from "@/lib/actions";

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bid = ctx.business.id;
  const body = await req.json();
  const table = body.kind === "income" ? "incomes" : "expenses";
  const op = body.op as string;

  // Optional itemised lines [{name, qty, rate}] → amount = Σ qty × rate
  const lines = Array.isArray(body.lines)
    ? (body.lines as { name: string; qty: number; rate: number }[]).filter((l) => l && l.name).map((l) => ({ name: String(l.name), qty: Number(l.qty) || 1, rate: Number(l.rate) || 0 }))
    : [];
  const amount = lines.length ? lines.reduce((a, l) => a + l.qty * l.rate, 0) : Number(body.amount) || 0;

  if (op === "add_category") {
    const name = String(body.name || "").trim();
    const ckind = body.kind === "income" ? "income" : "expense";
    if (!name) return NextResponse.json({ error: "Enter a name." }, { status: 400 });
    if (!get("SELECT id FROM categories WHERE business_id=? AND kind=? AND name=?", [bid, ckind, name]))
      run("INSERT INTO categories (id, business_id, kind, name) VALUES (?,?,?,?)", [uid(), bid, ckind, name]);
    return NextResponse.json({ ok: true, name });
  }

  if (op === "create") {
    const id = uid();
    const number = takeNumber(bid, table === "incomes" ? "income" : "expense", Number(body.number) > 0 ? Number(body.number) : null);
    run(`INSERT INTO ${table} (id, business_id, number, lines, category, account_id, amount, date, note, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, bid, number, lines.length ? JSON.stringify(lines) : null, body.category ?? null, body.account_id ?? null, amount, body.date, body.note ?? null, ctx.user.name, nowIso()]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: body.kind, entityId: id, summary: `${body.kind} #${number} ${amount}`, after: body });
    return NextResponse.json({ ok: true, id, number });
  }
  if (op === "update") {
    const before = get(`SELECT * FROM ${table} WHERE id=? AND business_id=?`, [body.id, bid]);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    run(`UPDATE ${table} SET category=?, account_id=?, amount=?, date=?, note=?, lines=?, number=COALESCE(?, number) WHERE id=? AND business_id=?`,
      [body.category ?? null, body.account_id ?? null, amount, body.date, body.note ?? null, lines.length ? JSON.stringify(lines) : null,
       Number(body.number) > 0 ? Number(body.number) : null, body.id, bid]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: body.kind, entityId: body.id, summary: `Edited ${body.kind}`, before, after: body });
    return NextResponse.json({ ok: true });
  }
  if (op === "delete") {
    const before = get(`SELECT * FROM ${table} WHERE id=? AND business_id=?`, [body.id, bid]);
    run(`DELETE FROM ${table} WHERE id=? AND business_id=?`, [body.id, bid]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "delete", entity: body.kind, entityId: body.id, summary: `Deleted ${body.kind}`, before });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
