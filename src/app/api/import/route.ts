import { NextResponse } from "next/server";
import { requireCtx, can, getMember } from "@/lib/auth";
import { all, run, tx } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { uid, nowIso } from "@/lib/util";
import fs from "node:fs";
import path from "node:path";

const TABLES = [
  "parties", "items", "accounts", "documents", "payments",
  "expenses", "incomes", "transfers", "account_adjustments", "stock_adjustments", "reminders", "categories", "units", "counters",
];

const MAX_ROWS = 500;
const NUM = (v: unknown) => { const n = Number(String(v ?? "").replace(/[,\s]/g, "").replace(/^Tk\.?/i, "")); return Number.isFinite(n) ? n : 0; };
const STR = (v: unknown) => { const s = String(v ?? "").trim(); return s ? s : null; };
const DATE = (v: unknown) => { const s = String(v ?? "").trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };

type Row = Record<string, unknown>;

/** Adds categories / units that don't exist yet (case-insensitive). */
function ensureNames(bid: string, table: "categories" | "units", names: (string | null)[], kind?: string) {
  const existing = new Set(
    (table === "categories"
      ? all<{ name: string }>("SELECT name FROM categories WHERE business_id=? AND kind=?", [bid, kind!])
      : all<{ name: string }>("SELECT name FROM units WHERE business_id=?", [bid])
    ).map((r) => r.name.toLowerCase())
  );
  for (const n of names) {
    if (!n || existing.has(n.toLowerCase())) continue;
    existing.add(n.toLowerCase());
    if (table === "categories") run("INSERT INTO categories (id, business_id, kind, name) VALUES (?,?,?,?)", [uid(), bid, kind!, n]);
    else run("INSERT INTO units (id, business_id, name) VALUES (?,?,?)", [uid(), bid, n]);
  }
}

// POST { op: "parties" | "items", rows: [...], skipExisting? }  → bulk import from the 3-step wizard
// POST { payload }                                             → restore a full JSON backup (Owner/Admin; replaces data)
export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bid = ctx.business.id;
  const body = await req.json();

  if (body.op === "parties" || body.op === "items") {
    const mod = body.op as "parties" | "items";
    const m = getMember(bid, ctx.user.id);
    if (!can(ctx.role, m?.permissions ?? null, mod === "items" ? "inventory" : mod, "create")) return NextResponse.json({ error: "You don't have permission to add " + mod + "." }, { status: 403 });
    const rows = (Array.isArray(body.rows) ? body.rows : []) as Row[];
    if (!rows.length) return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    if (rows.length > MAX_ROWS) return NextResponse.json({ error: `You can import up to ${MAX_ROWS} entries at a time.` }, { status: 400 });
    const tbl = mod === "parties" ? "parties" : "items";
    const existing = new Set(all<{ name: string }>(`SELECT name FROM ${tbl} WHERE business_id=?`, [bid]).map((r) => r.name.trim().toLowerCase()));
    let count = 0, skipped = 0;
    const errors: string[] = [];
    try {
      tx(() => {
        rows.forEach((r, i) => {
          const name = STR(r.name);
          if (!name) { errors.push(`Row ${i + 1}: name is required`); return; }
          if (body.skipExisting && existing.has(name.toLowerCase())) { skipped++; return; }
          existing.add(name.toLowerCase());
          if (mod === "parties") {
            const t = String(r.type ?? "").toLowerCase();
            const type = t.startsWith("s") ? "supplier" : t === "both" ? "both" : "customer";
            const amt = Math.abs(NUM(r.opening_balance));
            const give = /give|pay|supplier|cr/i.test(String(r.balance_type ?? ""));
            run(
              `INSERT INTO parties (id, business_id, name, phone, address, type, category, opening_balance, note, email, vat, as_of_date, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
              [uid(), bid, name, STR(r.phone), STR(r.address), type, STR(r.category), give ? -amt : amt, null, STR(r.email), STR(r.vat), DATE(r.as_of_date), nowIso()]
            );
          } else {
            const type = /serv/i.test(String(r.type ?? "")) ? "Service" : "Product";
            run(
              `INSERT INTO items (id, business_id, name, category, type, code, sales_price, purchase_price, mrp_price, wholesale_price, min_wholesale_qty, unit, opening_stock, low_stock_alert, location, description, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
              [uid(), bid, name, STR(r.category) || "General", type, STR(r.code), NUM(r.sales_price), NUM(r.purchase_price), NUM(r.mrp_price), NUM(r.wholesale_price),
               NUM(r.min_wholesale_qty), STR(r.unit) || "pcs", NUM(r.opening_stock), NUM(r.low_stock_alert), STR(r.location), STR(r.description), nowIso()]
            );
          }
          count++;
        });
        if (mod === "parties") ensureNames(bid, "categories", rows.map((r) => STR(r.category)), "party");
        else {
          ensureNames(bid, "categories", rows.map((r) => STR(r.category)), "item");
          ensureNames(bid, "units", rows.map((r) => STR(r.unit)));
        }
      });
    } catch (e) {
      return NextResponse.json({ error: "Import failed: " + (e as Error).message }, { status: 500 });
    }
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: mod === "parties" ? "party" : "item", summary: `Imported ${count} ${mod}${skipped ? ` (${skipped} skipped as duplicates)` : ""}` });
    return NextResponse.json({ ok: true, count, skipped, errors });
  }

  // ---------- Full restore (existing behaviour) ----------
  if (ctx.role !== "Owner" && ctx.role !== "Admin") return NextResponse.json({ error: "Only Owner/Admin can restore." }, { status: 403 });
  const payload = body.payload;
  if (!payload || payload.format !== "hishab-business-export" || !payload.data) {
    return NextResponse.json({ error: "Not a valid Hishab export file." }, { status: 400 });
  }
  const data = payload.data as Record<string, Record<string, unknown>[]>;

  // Only real columns of each table may be written (a crafted backup can't inject SQL through key names).
  const colsOf = (tbl: string) => new Set(all<{ name: string }>(`PRAGMA table_info(${tbl})`).map((c) => c.name));
  // Backups from another business (or a copy of this one restored elsewhere) would clash on primary keys,
  // so every row id is re-mapped to a fresh id and every *_id reference is rewritten through the same map.
  const srcBiz = String((payload.business as { id?: string } | undefined)?.id || "");
  const remap = srcBiz !== bid;
  const idMap = new Map<string, string>();
  if (remap) {
    for (const tbl of [...TABLES, "doc_items"]) for (const r of data[tbl] || []) if (r && typeof r.id === "string") idMap.set(r.id, uid());
  }
  const REF_COLS = ["party_id", "item_id", "account_id", "document_id", "from_account_id", "to_account_id", "source_id"];

  // Safety net: snapshot the current data to disk before wiping it.
  try {
    const snap: Record<string, unknown[]> = {};
    for (const tbl of TABLES) snap[tbl] = all(`SELECT * FROM ${tbl} WHERE business_id = ?`, [bid]);
    snap.doc_items = all("SELECT di.* FROM doc_items di JOIN documents d ON d.id = di.document_id WHERE d.business_id = ?", [bid]);
    const dir = path.join(process.env.SMS_DATA_DIR || path.join(process.cwd(), "data"), "backups");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `before-restore_${bid}_${Date.now()}.json`),
      JSON.stringify({ format: "hishab-business-export", version: 1, exported_at: nowIso(), business: { id: bid, name: ctx.business.name }, data: snap }));
  } catch { /* best effort */ }

  try {
    tx(() => {
      // Clear existing domain data for this business
      run("DELETE FROM doc_items WHERE document_id IN (SELECT id FROM documents WHERE business_id = ?)", [bid]);
      for (const tbl of TABLES) run(`DELETE FROM ${tbl} WHERE business_id = ?`, [bid]);

      const insertRows = (tbl: string, rows: Record<string, unknown>[]) => {
        const valid = colsOf(tbl);
        for (const row of rows || []) {
          if (!row || typeof row !== "object") continue;
          const r: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) if (valid.has(k)) r[k] = v;
          if (valid.has("business_id")) r.business_id = bid;
          if (remap) {
            if (typeof r.id === "string") r.id = idMap.get(r.id) ?? uid();
            for (const c of REF_COLS) if (typeof r[c] === "string") r[c] = idMap.get(r[c] as string) ?? null;
          }
          const cols = Object.keys(r);
          if (cols.length === 0) continue;
          run(`INSERT INTO ${tbl} (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`, cols.map((c) => r[c]));
        }
      };
      for (const tbl of TABLES) insertRows(tbl, data[tbl] || []);
      // doc_items may only point at documents that now belong to this business
      const docIds = new Set(all<{ id: string }>("SELECT id FROM documents WHERE business_id = ?", [bid]).map((d) => d.id));
      const lines = (data["doc_items"] || []).filter((l) => l && docIds.has(String(remap ? idMap.get(String(l.document_id)) : l.document_id)));
      insertRows("doc_items", lines);
    });
  } catch (e) {
    return NextResponse.json({ error: "Restore failed (your data was not changed): " + (e as Error).message }, { status: 500 });
  }

  logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: "restore", summary: "Restored business from JSON backup" });
  return NextResponse.json({ ok: true });
}
