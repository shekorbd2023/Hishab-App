import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";
import { partyBalances, accountBalances, itemStocks, sumDocuments, sumExpenses, sumIncomes } from "@/lib/domain";

const TABLES = [
  "parties", "items", "accounts", "documents", "doc_items", "payments",
  "expenses", "incomes", "transfers", "account_adjustments", "stock_adjustments",
  "reminders", "categories", "units", "audit_log", "counters",
];

const r2 = (n: number) => Math.round((n || 0) * 100) / 100;

/** Computed snapshot (balances, stock, totals) added to the "Full JSON Business Report". */
function computed(bid: string) {
  const pb = partyBalances(bid);
  const ab = accountBalances(bid);
  const st = itemStocks(bid);
  const parties = all<{ id: string; name: string; phone: string | null; type: string }>("SELECT id, name, phone, type FROM parties WHERE business_id=? ORDER BY name COLLATE NOCASE", [bid]);
  const accounts = all<{ id: string; name: string; type: string }>("SELECT id, name, type FROM accounts WHERE business_id=? ORDER BY created_at", [bid]);
  const items = all<{ id: string; name: string; unit: string | null; purchase_price: number; sales_price: number }>("SELECT id, name, unit, purchase_price, sales_price FROM items WHERE business_id=? ORDER BY name COLLATE NOCASE", [bid]);
  let receivable = 0, payable = 0;
  for (const v of Object.values(pb)) { if (v > 0) receivable += v; else payable -= v; }
  const sales = sumDocuments(bid, "sales_invoice") - sumDocuments(bid, "sales_return");
  const purchases = sumDocuments(bid, "purchase_bill") - sumDocuments(bid, "purchase_return");
  const expenses = sumExpenses(bid), income = sumIncomes(bid);
  const expenseByCategory = all<{ category: string | null; count: number; amount: number }>("SELECT category, COUNT(*) count, SUM(amount) amount FROM expenses WHERE business_id=? GROUP BY category ORDER BY amount DESC", [bid]);
  const monthly = all<{ month: string; sales: number; invoices: number }>(
    "SELECT substr(date,1,7) month, SUM(total) sales, COUNT(*) invoices FROM documents WHERE business_id=? AND kind='sales_invoice' GROUP BY month ORDER BY month", [bid]);
  return {
    totals: {
      receivable: r2(receivable), payable: r2(payable), cash_and_bank: r2(Object.values(ab).reduce((a, b) => a + b, 0)),
      sales_net_of_returns: r2(sales), purchases_net_of_returns: r2(purchases), expenses: r2(expenses), other_income: r2(income),
      stock_value_at_purchase_price: r2(items.reduce((a, i) => a + (st[i.id] || 0) * i.purchase_price, 0)),
    },
    party_balances: parties.map((p) => ({ id: p.id, name: p.name, phone: p.phone, type: p.type, balance: r2(pb[p.id] || 0), status: (pb[p.id] || 0) > 0.005 ? "To Receive" : (pb[p.id] || 0) < -0.005 ? "To Give" : "Settled" })),
    account_balances: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, balance: r2(ab[a.id] || 0) })),
    item_stock: items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, quantity: r2(st[i.id] || 0), stock_value: r2((st[i.id] || 0) * i.purchase_price) })),
    expense_by_category: expenseByCategory,
    monthly_sales: monthly,
  };
}

// Full-business JSON export — the entire dataset for the active business.
// ?report=1 adds a computed snapshot (balances, stock, totals) for the "Full JSON Business Report".
export async function GET(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bid = ctx.business.id;
  const withReport = new URL(req.url).searchParams.get("report") === "1";
  const data: Record<string, unknown[]> = {};
  for (const tbl of TABLES) {
    try {
      data[tbl] = tbl === "doc_items"
        ? all("SELECT di.* FROM doc_items di JOIN documents d ON d.id = di.document_id WHERE d.business_id = ?", [bid])
        : all(`SELECT * FROM ${tbl} WHERE business_id = ?`, [bid]);
    } catch { data[tbl] = []; }
  }
  const b = ctx.business as unknown as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    format: "hishab-business-export",
    version: 1,
    exported_at: new Date().toISOString(),
    business: { id: bid, name: ctx.business.name, currency: ctx.business.currency, currency_symbol: ctx.business.currency_symbol, phone: b.phone ?? null, address: b.address ?? null, email: b.email ?? null },
    ...(withReport ? { report: computed(bid) } : {}),
    data,
  };
  const base = ctx.business.name.replace(/[^a-z0-9]/gi, "_");
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="${base}_${withReport ? "full_report" : "backup"}_${day}.json"`,
    },
  });
}
