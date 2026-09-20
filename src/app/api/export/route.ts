import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";

const TABLES = [
  "parties", "items", "accounts", "documents", "doc_items", "payments",
  "expenses", "incomes", "transfers", "reminders", "categories", "units", "audit_log", "counters",
];

// Full-business JSON export — the entire dataset for the active business.
export async function GET() {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bid = ctx.business.id;
  const data: Record<string, unknown[]> = {};
  for (const tbl of TABLES) {
    if (tbl === "doc_items") {
      data[tbl] = all(
        "SELECT di.* FROM doc_items di JOIN documents d ON d.id = di.document_id WHERE d.business_id = ?",
        [bid]
      );
    } else {
      data[tbl] = all(`SELECT * FROM ${tbl} WHERE business_id = ?`, [bid]);
    }
  }
  const payload = {
    format: "hishab-business-export",
    version: 1,
    exported_at: new Date().toISOString(),
    business: { id: bid, name: ctx.business.name, currency: ctx.business.currency, currency_symbol: ctx.business.currency_symbol },
    data,
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="${ctx.business.name.replace(/[^a-z0-9]/gi, "_")}_backup.json"`,
    },
  });
}
