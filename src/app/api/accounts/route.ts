import { NextResponse } from "next/server";
import { requireCtx, allowed, belongs } from "@/lib/auth";
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
  const action = op === "update" ? "edit" : op === "delete" || op === "delete_adjustment" || op === "delete_transfer" ? "delete" : "create";
  if (!(await allowed(ctx, "accounts", action))) return NextResponse.json({ error: "You don't have permission for this." }, { status: 403 });

  if (op === "create") {
    if (!String(body.name || body.bank_name || "").trim()) return NextResponse.json({ error: "Enter an account name." }, { status: 400 });
    const id = uid();
    (await run("INSERT INTO accounts (id, business_id, name, type, opening_balance, bank_name, holder, account_no, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            [id, bid, body.name || body.bank_name, body.type ?? "cash", Number(body.opening_balance) || 0, body.bank_name ?? null, body.holder ?? null, body.account_no ?? null, nowIso()]));
    (await logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: "account", entityId: id, summary: `Added account ${body.name}`, after: body }));
    return NextResponse.json({ ok: true, id });
  }
  if (op === "update") {
    const before = (await get("SELECT * FROM accounts WHERE id=? AND business_id=?", [body.id, bid]));
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    (await run("UPDATE accounts SET name=?, type=?, opening_balance=?, bank_name=?, holder=?, account_no=? WHERE id=? AND business_id=?",
            [body.name, body.type ?? "cash", Number(body.opening_balance) || 0, body.bank_name ?? null, body.holder ?? null, body.account_no ?? null, body.id, bid]));
    (await logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "account", entityId: body.id, summary: `Updated account ${body.name}`, before, after: body }));
    return NextResponse.json({ ok: true });
  }
  if (op === "delete") {
    const before = (await get("SELECT * FROM accounts WHERE id=? AND business_id=?", [body.id, bid]));
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const used = (await get<{ n: number }>(
          `SELECT (SELECT COUNT(*) FROM payments WHERE business_id=? AND account_id=?) +
              (SELECT COUNT(*) FROM expenses WHERE business_id=? AND account_id=?) +
              (SELECT COUNT(*) FROM incomes WHERE business_id=? AND account_id=?) +
              (SELECT COUNT(*) FROM transfers WHERE business_id=? AND (from_account_id=? OR to_account_id=?)) +
              (SELECT COUNT(*) FROM account_adjustments WHERE business_id=? AND account_id=?) n`,
          [bid, body.id, bid, body.id, bid, body.id, bid, body.id, body.id, bid, body.id]))?.n ?? 0;
    if (used > 0) return NextResponse.json({ error: `This account has ${used} transaction(s). Deleting it would change your cash/bank balance, so it is blocked.` }, { status: 409 });
    (await run("DELETE FROM accounts WHERE id=? AND business_id=?", [body.id, bid]));
    (await logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "delete", entity: "account", entityId: body.id, summary: "Deleted account", before }));
    return NextResponse.json({ ok: true });
  }
  if (op === "transfer") {
    const amt = Number(body.amount) || 0;
    if (amt <= 0) return NextResponse.json({ error: "Enter an amount." }, { status: 400 });
    if (!body.from_account_id || !body.to_account_id || body.from_account_id === body.to_account_id)
      return NextResponse.json({ error: "Pick two different accounts." }, { status: 400 });
    if (!(await belongs("accounts", body.from_account_id, bid)) || !(await belongs("accounts", body.to_account_id, bid)))
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    const id = uid();
    (await run("INSERT INTO transfers (id, business_id, from_account_id, to_account_id, amount, date, note, created_at) VALUES (?,?,?,?,?,?,?,?)",
            [id, bid, body.from_account_id, body.to_account_id, Number(body.amount) || 0, body.date, body.note ?? null, nowIso()]));
    (await logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: "transfer", entityId: id, summary: `Transfer ${body.amount}`, after: body }));
    return NextResponse.json({ ok: true, id });
  }
  if (op === "adjust") {
    const amount = Number(body.amount) || 0;
    if (amount <= 0) return NextResponse.json({ error: "Enter an amount." }, { status: 400 });
    if (!body.account_id || !(await belongs("accounts", body.account_id, bid))) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    const id = (await adjustAccount({ businessId: bid, accountId: body.account_id, kind: body.kind === "reduce" ? "reduce" : "add", amount, date: body.date, note: body.note ?? null, createdBy: ctx.user.name }));
    (await logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: "account_adjustment", entityId: id, summary: `${body.kind === "reduce" ? "Reduce" : "Add"} money ${amount}`, after: body }));
    return NextResponse.json({ ok: true, id });
  }
  if (op === "delete_adjustment") {
    const before = (await get("SELECT * FROM account_adjustments WHERE id=? AND business_id=?", [body.id, bid]));
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    (await run("DELETE FROM account_adjustments WHERE id=? AND business_id=?", [body.id, bid]));
    (await logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "delete", entity: "account_adjustment", entityId: body.id, summary: "Deleted add/reduce money entry", before }));
    return NextResponse.json({ ok: true });
  }
  if (op === "delete_transfer") {
    const before = (await get("SELECT * FROM transfers WHERE id=? AND business_id=?", [body.id, bid]));
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    (await run("DELETE FROM transfers WHERE id=? AND business_id=?", [body.id, bid]));
    (await logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "delete", entity: "transfer", entityId: body.id, summary: "Deleted transfer", before }));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
