import { NextResponse } from "next/server";
import { requireCtx, can, getMember } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { uid, nowIso, parseCsv } from "@/lib/util";
import { logAudit } from "@/lib/audit";

async function guard(action: string) {
  const ctx = await requireCtx();
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const m = getMember(ctx.business.id, ctx.user.id);
  if (!can(ctx.role, m?.permissions ?? null, "parties", action)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ctx };
}

export async function POST(req: Request) {
  const body = await req.json();
  const op = body.op as string;
  const { ctx, error } = await guard(op === "delete" ? "delete" : op === "update" ? "edit" : "create");
  if (error) return error;
  const bid = ctx!.business.id;

  if (op === "create") {
    const id = uid();
    run(
      `INSERT INTO parties (id, business_id, name, phone, address, type, category, opening_balance, note, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, bid, body.name, body.phone ?? null, body.address ?? null, body.type ?? "customer",
       body.category ?? null, Number(body.opening_balance) || 0, body.note ?? null, nowIso()]
    );
    logAudit({ businessId: bid, userId: ctx!.user.id, userName: ctx!.user.name, action: "create", entity: "party", entityId: id, summary: `Added party ${body.name}`, after: body });
    return NextResponse.json({ ok: true, id });
  }

  if (op === "update") {
    const before = get("SELECT * FROM parties WHERE id = ? AND business_id = ?", [body.id, bid]);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    run(
      `UPDATE parties SET name=?, phone=?, address=?, type=?, category=?, opening_balance=?, note=? WHERE id=? AND business_id=?`,
      [body.name, body.phone ?? null, body.address ?? null, body.type ?? "customer", body.category ?? null,
       Number(body.opening_balance) || 0, body.note ?? null, body.id, bid]
    );
    logAudit({ businessId: bid, userId: ctx!.user.id, userName: ctx!.user.name, action: "update", entity: "party", entityId: body.id, summary: `Updated party ${body.name}`, before, after: body });
    return NextResponse.json({ ok: true });
  }

  if (op === "delete") {
    const before = get("SELECT * FROM parties WHERE id = ? AND business_id = ?", [body.id, bid]);
    run("DELETE FROM parties WHERE id = ? AND business_id = ?", [body.id, bid]);
    logAudit({ businessId: bid, userId: ctx!.user.id, userName: ctx!.user.name, action: "delete", entity: "party", entityId: body.id, summary: `Deleted party`, before });
    return NextResponse.json({ ok: true });
  }

  if (op === "import") {
    const rows = parseCsv(String(body.csv || ""));
    if (rows.length < 2) return NextResponse.json({ error: "No rows" }, { status: 400 });
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (n: string) => header.indexOf(n);
    let count = 0;
    for (const r of rows.slice(1)) {
      const name = r[idx("name")]?.trim();
      if (!name) continue;
      run(
        `INSERT INTO parties (id, business_id, name, phone, address, type, category, opening_balance, note, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [uid(), bid, name, r[idx("phone")] ?? null, r[idx("address")] ?? null,
         (r[idx("type")] || "customer").trim(), r[idx("category")] ?? null,
         Number(r[idx("opening_balance")]) || 0, null, nowIso()]
      );
      count++;
    }
    logAudit({ businessId: bid, userId: ctx!.user.id, userName: ctx!.user.name, action: "create", entity: "party", summary: `Imported ${count} parties` });
    return NextResponse.json({ ok: true, count });
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
