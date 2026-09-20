import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";
import { run, tx } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const TABLES = [
  "parties", "items", "accounts", "documents", "payments",
  "expenses", "incomes", "transfers", "reminders", "categories", "units", "counters",
];

// Restore a business export into the ACTIVE business (owner only). Replaces existing data.
export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "Owner" && ctx.role !== "Admin") return NextResponse.json({ error: "Only Owner/Admin can restore." }, { status: 403 });
  const bid = ctx.business.id;
  const body = await req.json();
  const payload = body.payload;
  if (!payload || payload.format !== "hishab-business-export" || !payload.data) {
    return NextResponse.json({ error: "Not a valid Hishab export file." }, { status: 400 });
  }
  const data = payload.data as Record<string, Record<string, unknown>[]>;

  try {
    tx(() => {
      // Clear existing domain data for this business
      run("DELETE FROM doc_items WHERE document_id IN (SELECT id FROM documents WHERE business_id = ?)", [bid]);
      for (const tbl of TABLES) run(`DELETE FROM ${tbl} WHERE business_id = ?`, [bid]);

      const insertRows = (tbl: string, rows: Record<string, unknown>[], forceBiz = true) => {
        for (const row of rows || []) {
          const r = { ...row };
          if (forceBiz && "business_id" in r) r.business_id = bid;
          const cols = Object.keys(r);
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => "?").join(",");
          run(`INSERT INTO ${tbl} (${cols.join(",")}) VALUES (${placeholders})`, cols.map((c) => r[c] as unknown));
        }
      };
      for (const tbl of TABLES) insertRows(tbl, data[tbl] || []);
      // doc_items reference documents (which now belong to this business); keep as-is
      insertRows("doc_items", (data["doc_items"] || []) as Record<string, unknown>[], false);
    });
  } catch (e) {
    return NextResponse.json({ error: "Restore failed: " + (e as Error).message }, { status: 500 });
  }

  logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: "restore", summary: "Restored business from JSON backup" });
  return NextResponse.json({ ok: true });
}
