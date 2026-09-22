import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { uid, nowIso } from "@/lib/util";
import { logAudit } from "@/lib/audit";
import { adjustAccount } from "@/lib/actions";

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bid = ctx.business.id;
  const body = await req.json();
  const op = body.op as string;

  if (op === "create") {
    const id = uid();
    run("INSERT INTO accounts (id, business_id, name, type, opening_balance, bank_name, holder, account_no, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      [id, bid, body.name || body.bank_name, body.type ?? "cash", Number(body.opening_balance) || 0, body.bank_name ?? null, body.holder ?? null, body.account_no ?? null, nowIso()]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: "account", entityId: id, summary: `Added account ${body.name}`, after: body });
    return NextResponse.json({ ok: true, id });
  }
  if (op === "update") {
    const before = get("SELECT * FROM accounts WHERE id=? AND business_id=?", [body.id, bid]);
    run("UPDATE accounts SET name=?, type=?, opening_balance=?, bank_name=?, holder=?, account_no=? WHERE id=? AND business_id=?",
      [body.name, body.type ?? "cash", Number(body.opening_balance) || 0, body.bank_name ?? null, body.holder ?? null, body.account_no ?? null, body.id, bid]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "account", entityId: body.id, summary: `Updated account ${body.name}`, before, after: body });
    return NextResponse.json({ ok: true });
  }
  if (op === "delete") {
    const before = get("SELECT * FROM accounts WHERE id=? AND business_id=?", [body.id, bid]);
    run("DELETE FROM accounts WHERE id=? AND business_id=?", [body.id, bid]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "delete", entity: "account", entityId: body.id, summary: "Deleted account", before });
    return NextResponse.json({ ok: true });
  }
  if (op === "transfer") {
    const id = uid();
    run("INSERT INTO transfers (id, business_id, from_account_id, to_account_id, amount, date, note, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [id, bid, body.from_account_id, body.to_account_id, Number(body.amount) || 0, body.date, body.note ?? null, nowIso()]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: "transfer", entityId: id, summary: `Transfer ${body.amount}`, after: body });
    return NextResponse.json({ ok: true, id });
  }
  if (op === "adjust") {
    const amount = Number(body.amount) || 0;
    if (amount <= 0) return NextResponse.json({ error: "Enter an amount." }, { status: 400 });
    const id = adjustAccount({ businessId: bid, accountId: body.account_id, kind: body.kind === "reduce" ? "reduce" : "add", amount, date: body.date, note: body.note ?? null, createdBy: ctx.user.name });
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: "account_adjustment", entityId: id, summary: `${body.kind === "reduce" ? "Reduce" : "Add"} money ${amount}`, after: body });
    return NextResponse.json({ ok: true, id });
  }
  if (op === "delete_adjustment") {
    run("DELETE FROM account_adjustments WHERE id=? AND business_id=?", [body.id, bid]);
    return NextResponse.json({ ok: true });
  }
  if (op === "delete_transfer") {
    run("DELETE FROM transfers WHERE id=? AND business_id=?", [body.id, bid]);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
