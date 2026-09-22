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
  const { ctx, error } = await guard(op === "delete" ? "delete" : op === "update" || op === "adjust_balance" ? "edit" : "create");
  if (error) return error;
  const bid = ctx!.business.id;

  // Opening balance: signed number (legacy) or amount + payment_type ("receive" | "give") from the Add Party dialog.
  const opening = () => {
    const n = Number(body.opening_balance) || 0;
    if (body.payment_type === "give") return -Math.abs(n);
    if (body.payment_type === "receive") return Math.abs(n);
    return n;
  };

  if (op === "create") {
    const id = uid();
    run(
      `INSERT INTO parties (id, business_id, name, phone, address, type, category, opening_balance, note, email, vat, photo, as_of_date, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, bid, body.name, body.phone || null, body.address || null, body.type ?? "customer",
       body.category || null, opening(), body.note ?? null, body.email || null, body.vat || null, body.photo || null,
       body.as_of_date || null, nowIso()]
    );
    logAudit({ businessId: bid, userId: ctx!.user.id, userName: ctx!.user.name, action: "create", entity: "party", entityId: id, summary: `Added party ${body.name}`, after: { ...body, photo: body.photo ? "[image]" : null } });
    return NextResponse.json({ ok: true, id });
  }

  if (op === "update") {
    const before = get<Record<string, unknown>>("SELECT * FROM parties WHERE id = ? AND business_id = ?", [body.id, bid]);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    run(
      `UPDATE parties SET name=?, phone=?, address=?, type=?, category=?, opening_balance=?, note=? WHERE id=? AND business_id=?`,
      [body.name, body.phone || null, body.address || null, body.type ?? "customer", body.category || null,
       opening(), body.note ?? before.note ?? null, body.id, bid]
    );
    // Newer fields are only touched when the client sends them.
    for (const k of ["email", "vat", "photo", "as_of_date"] as const) {
      if (k in body) run(`UPDATE parties SET ${k}=? WHERE id=? AND business_id=?`, [body[k] || null, body.id, bid]);
    }
    logAudit({ businessId: bid, userId: ctx!.user.id, userName: ctx!.user.name, action: "update", entity: "party", entityId: body.id, summary: `Updated party ${body.name}`, before: { ...before, photo: before.photo ? "[image]" : null }, after: { ...body, photo: body.photo ? "[image]" : null } });
    return NextResponse.json({ ok: true });
  }

  // Adjust Balance: shifts the party's opening balance (+ = they owe us more, − = we owe them more).
  if (op === "adjust_balance") {
    const before = get<{ opening_balance: number; name: string }>("SELECT opening_balance, name FROM parties WHERE id = ? AND business_id = ?", [body.id, bid]);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const amt = Math.abs(Number(body.amount) || 0);
    if (!amt) return NextResponse.json({ error: "Enter an amount." }, { status: 400 });
    const delta = body.kind === "give" ? -amt : amt;
    run("UPDATE parties SET opening_balance = opening_balance + ? WHERE id=? AND business_id=?", [delta, body.id, bid]);
    logAudit({ businessId: bid, userId: ctx!.user.id, userName: ctx!.user.name, action: "update", entity: "party", entityId: body.id, summary: `Adjusted balance of ${before.name} by ${delta}${body.note ? " — " + body.note : ""}`, before: { opening_balance: before.opening_balance }, after: { opening_balance: before.opening_balance + delta, date: body.date, note: body.note } });
    return NextResponse.json({ ok: true });
  }

  if (op === "add_category") {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Enter a name." }, { status: 400 });
    if (!get("SELECT id FROM categories WHERE business_id=? AND kind='party' AND name=?", [bid, name]))
      run("INSERT INTO categories (id, business_id, kind, name) VALUES (?,?,?,?)", [uid(), bid, "party", name]);
    return NextResponse.json({ ok: true, name });
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
