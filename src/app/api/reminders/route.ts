import { NextResponse } from "next/server";
import { requireCtx, allowed, belongs } from "@/lib/auth";
import { run } from "@/lib/db";
import { uid, nowIso } from "@/lib/util";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bid = ctx.business.id;
  const body = await req.json();
  const op = body.op as string;
  if (!allowed(ctx, "parties", op === "delete" ? "delete" : op === "done" ? "edit" : "create"))
    return NextResponse.json({ error: "You don't have permission for this." }, { status: 403 });
  if (op === "create" && (!body.due_date || !belongs("parties", body.party_id, bid)))
    return NextResponse.json({ error: "Pick a party and a date." }, { status: 400 });

  if (op === "create") {
    const id = uid();
    run("INSERT INTO reminders (id, business_id, party_id, due_date, note, done, created_at) VALUES (?,?,?,?,?,0,?)",
      [id, bid, body.party_id ?? null, body.due_date, body.note ?? null, nowIso()]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: "reminder", entityId: id, summary: "Added reminder" });
    return NextResponse.json({ ok: true, id });
  }
  if (op === "done") {
    run("UPDATE reminders SET done = ? WHERE id = ? AND business_id = ?", [body.done ? 1 : 0, body.id, bid]);
    return NextResponse.json({ ok: true });
  }
  if (op === "delete") {
    run("DELETE FROM reminders WHERE id = ? AND business_id = ?", [body.id, bid]);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
