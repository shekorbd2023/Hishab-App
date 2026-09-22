import { NextResponse } from "next/server";
import { requireCtx, can, getMember } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { uid, nowIso, parseCsv } from "@/lib/util";
import { logAudit } from "@/lib/audit";

async function guard(action: string) {
  const ctx = await requireCtx();
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const m = getMember(ctx.business.id, ctx.user.id);
  if (!can(ctx.role, m?.permissions ?? null, "inventory", action)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ctx };
}

const NUM = (v: unknown) => Number(v) || 0;

export async function POST(req: Request) {
  const body = await req.json();
  const op = body.op as string;
  const { ctx, error } = await guard(op === "delete" ? "delete" : op === "update" ? "edit" : "create");
  if (error) return error;
  const bid = ctx!.business.id;

  if (op === "create" || op === "update") {
    const cols = {
      name: body.name, category: body.category ?? null, type: body.type ?? "Product", code: body.code ?? null,
      sales_price: NUM(body.sales_price), purchase_price: NUM(body.purchase_price), mrp_price: NUM(body.mrp_price),
      wholesale_price: NUM(body.wholesale_price), min_wholesale_qty: NUM(body.min_wholesale_qty),
      unit: body.unit ?? "pcs", opening_stock: NUM(body.opening_stock), low_stock_alert: NUM(body.low_stock_alert),
    };
    // Newer columns (Karbar "Others" tab + measuring-unit dialog) — only touched when sent.
    const saveExtras = (id: string) => {
      for (const k of ["location", "description", "image", "secondary_unit"] as const) {
        if (k in body) run(`UPDATE items SET ${k}=? WHERE id=? AND business_id=?`, [body[k] || null, id, bid]);
      }
      if ("conversion_rate" in body) run("UPDATE items SET conversion_rate=? WHERE id=? AND business_id=?", [NUM(body.conversion_rate), id, bid]);
    };
    if (op === "create") {
      const id = uid();
      run(`INSERT INTO items (id, business_id, name, category, type, code, sales_price, purchase_price, mrp_price, wholesale_price, min_wholesale_qty, unit, opening_stock, low_stock_alert, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, bid, cols.name, cols.category, cols.type, cols.code, cols.sales_price, cols.purchase_price, cols.mrp_price, cols.wholesale_price, cols.min_wholesale_qty, cols.unit, cols.opening_stock, cols.low_stock_alert, nowIso()]);
      logAudit({ businessId: bid, userId: ctx!.user.id, userName: ctx!.user.name, action: "create", entity: "item", entityId: id, summary: `Added item ${cols.name}`, after: cols });
      saveExtras(id);
      return NextResponse.json({ ok: true, id });
    } else {
      const before = get<Record<string, unknown>>("SELECT * FROM items WHERE id = ? AND business_id = ?", [body.id, bid]);
      run(`UPDATE items SET name=?, category=?, type=?, code=?, sales_price=?, purchase_price=?, mrp_price=?, wholesale_price=?, min_wholesale_qty=?, unit=?, opening_stock=?, low_stock_alert=? WHERE id=? AND business_id=?`,
        [cols.name, cols.category, cols.type, cols.code, cols.sales_price, cols.purchase_price, cols.mrp_price, cols.wholesale_price, cols.min_wholesale_qty, cols.unit, cols.opening_stock, cols.low_stock_alert, body.id, bid]);
      saveExtras(body.id);
      logAudit({ businessId: bid, userId: ctx!.user.id, userName: ctx!.user.name, action: "update", entity: "item", entityId: body.id, summary: `Updated item ${cols.name}`, before: before ? { ...before, image: before.image ? "[image]" : null } : before, after: cols });
      return NextResponse.json({ ok: true });
    }
  }

  if (op === "delete") {
    const before = get("SELECT * FROM items WHERE id = ? AND business_id = ?", [body.id, bid]);
    run("DELETE FROM items WHERE id = ? AND business_id = ?", [body.id, bid]);
    logAudit({ businessId: bid, userId: ctx!.user.id, userName: ctx!.user.name, action: "delete", entity: "item", entityId: body.id, summary: "Deleted item", before });
    return NextResponse.json({ ok: true });
  }

  if (op === "adjust") {
    const delta = NUM(body.qty_delta);
    if (!delta) return NextResponse.json({ error: "Enter a non-zero quantity." }, { status: 400 });
    run(
      "INSERT INTO stock_adjustments (id, business_id, item_id, qty_delta, reason, date, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [uid(), bid, body.id, delta, body.reason ?? null, body.date || nowIso().slice(0, 10), ctx!.user.name, nowIso()]
    );
    logAudit({ businessId: bid, userId: ctx!.user.id, userName: ctx!.user.name, action: "update", entity: "item", entityId: body.id, summary: `Stock adjusted by ${delta}` });
    return NextResponse.json({ ok: true });
  }

  if (op === "add_category") {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Enter a name." }, { status: 400 });
    if (!get("SELECT id FROM categories WHERE business_id=? AND kind='item' AND name=?", [bid, name]))
      run("INSERT INTO categories (id, business_id, kind, name) VALUES (?,?,?,?)", [uid(), bid, "item", name]);
    return NextResponse.json({ ok: true, name });
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
      run(`INSERT INTO items (id, business_id, name, category, type, code, sales_price, purchase_price, mrp_price, wholesale_price, min_wholesale_qty, unit, opening_stock, low_stock_alert, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [uid(), bid, name, r[idx("category")] ?? null, (r[idx("type")] || "Product").trim(), r[idx("code")] ?? null,
         NUM(r[idx("sales_price")]), NUM(r[idx("purchase_price")]), NUM(r[idx("mrp_price")]), NUM(r[idx("wholesale_price")]),
         NUM(r[idx("min_wholesale_qty")]), (r[idx("unit")] || "pcs").trim(), NUM(r[idx("opening_stock")]), NUM(r[idx("low_stock_alert")]), nowIso()]);
      count++;
    }
    logAudit({ businessId: bid, userId: ctx!.user.id, userName: ctx!.user.name, action: "create", entity: "item", summary: `Imported ${count} items` });
    return NextResponse.json({ ok: true, count });
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
