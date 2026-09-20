import { all } from "./db";
import { partyBalances, itemStocks, sumDocuments, sumExpenses, sumIncomes } from "./domain";

export type Report = {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  summary?: { label: string; value: string }[];
};

function cogsFor(bid: string, from?: string, to?: string): number {
  // COGS ≈ sum(qty * item.purchase_price) for sold items in range
  let sql = `SELECT COALESCE(SUM(di.qty * i.purchase_price),0) s
             FROM doc_items di JOIN documents d ON d.id = di.document_id
             JOIN items i ON i.id = di.item_id
             WHERE d.business_id = ? AND d.kind = 'sales_invoice'`;
  const p: unknown[] = [bid];
  if (from) { sql += " AND d.date >= ?"; p.push(from); }
  if (to) { sql += " AND d.date <= ?"; p.push(to); }
  return (all<{ s: number }>(sql, p)[0]?.s) ?? 0;
}

export function buildReport(bid: string, type: string, from: string, to: string, sym: string): Report {
  const m = (n: number) => `${sym} ${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  if (type === "sales" || type === "purchase") {
    const kind = type === "sales" ? "sales_invoice" : "purchase_bill";
    const rows = all<{ number: number; date: string; total: number; status: string; pname: string | null }>(
      `SELECT d.number, d.date, d.total, d.status, p.name pname FROM documents d
       LEFT JOIN parties p ON p.id = d.party_id
       WHERE d.business_id=? AND d.kind=? AND d.date>=? AND d.date<=? ORDER BY d.date`, [bid, kind, from, to]
    );
    const total = rows.reduce((a, r) => a + r.total, 0);
    return {
      title: type === "sales" ? "Sales Report" : "Purchase Report",
      headers: ["No.", "Date", "Party", "Status", "Total"],
      rows: rows.map((r) => [r.number, r.date, r.pname || "Cash Sale", r.status, r.total.toFixed(2)]),
      summary: [{ label: "Total", value: m(total) }, { label: "Count", value: String(rows.length) }],
    };
  }

  if (type === "day-book") {
    const sales = all<{ date: string; total: number; n: number }>(`SELECT date, total, number n FROM documents WHERE business_id=? AND kind='sales_invoice' AND date>=? AND date<=?`, [bid, from, to]);
    const purch = all<{ date: string; total: number; n: number }>(`SELECT date, total, number n FROM documents WHERE business_id=? AND kind='purchase_bill' AND date>=? AND date<=?`, [bid, from, to]);
    const exp = all<{ date: string; amount: number }>(`SELECT date, amount FROM expenses WHERE business_id=? AND date>=? AND date<=?`, [bid, from, to]);
    const inc = all<{ date: string; amount: number }>(`SELECT date, amount FROM incomes WHERE business_id=? AND date>=? AND date<=?`, [bid, from, to]);
    const rows: (string | number)[][] = [
      ...sales.map((s) => [s.date, "Sales Invoice #" + s.n, "IN", s.total.toFixed(2)]),
      ...inc.map((s) => [s.date, "Other Income", "IN", s.amount.toFixed(2)]),
      ...purch.map((s) => [s.date, "Purchase Bill #" + s.n, "OUT", s.total.toFixed(2)]),
      ...exp.map((s) => [s.date, "Expense", "OUT", s.amount.toFixed(2)]),
    ].sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1));
    return { title: "Day Book", headers: ["Date", "Description", "Direction", "Amount"], rows };
  }

  if (type === "profit-loss") {
    const revenue = sumDocuments(bid, "sales_invoice", from, to) - sumDocuments(bid, "sales_return", from, to);
    const cogs = cogsFor(bid, from, to);
    const grossProfit = revenue - cogs;
    const expenses = sumExpenses(bid, from, to);
    const otherIncome = sumIncomes(bid, from, to);
    const netProfit = grossProfit - expenses + otherIncome;
    return {
      title: "Profit & Loss",
      headers: ["Line", "Amount"],
      rows: [
        ["Revenue (net of returns)", revenue.toFixed(2)],
        ["Cost of Goods Sold", cogs.toFixed(2)],
        ["Gross Profit", grossProfit.toFixed(2)],
        ["Operating Expenses", expenses.toFixed(2)],
        ["Other Income", otherIncome.toFixed(2)],
        ["Net Profit", netProfit.toFixed(2)],
      ],
      summary: [{ label: "Net Profit", value: m(netProfit) }, { label: "Gross Profit", value: m(grossProfit) }],
    };
  }

  if (type === "all-parties") {
    const bal = partyBalances(bid);
    const parties = all<{ id: string; name: string; phone: string | null }>("SELECT id, name, phone FROM parties WHERE business_id=? ORDER BY name COLLATE NOCASE", [bid]);
    let recv = 0, pay = 0;
    const rows = parties.map((p) => {
      const b = bal[p.id] ?? 0;
      if (b > 0) recv += b; else pay += -b;
      return [p.name, p.phone || "", b > 0 ? "Receivable" : b < 0 ? "Payable" : "Settled", Math.abs(b).toFixed(2)];
    });
    return {
      title: "All Party Report",
      headers: ["Party", "Phone", "Type", "Balance"],
      rows,
      summary: [{ label: "Total Receivable", value: m(recv) }, { label: "Total Payable", value: m(pay) }],
    };
  }

  if (type === "stock" || type === "low-stock") {
    const stocks = itemStocks(bid);
    const items = all<{ id: string; name: string; unit: string | null; purchase_price: number; sales_price: number; low_stock_alert: number }>(
      "SELECT id, name, unit, purchase_price, sales_price, low_stock_alert FROM items WHERE business_id=? ORDER BY name COLLATE NOCASE", [bid]
    );
    let value = 0;
    let rows = items.map((it) => {
      const qty = stocks[it.id] ?? 0;
      const val = qty * it.purchase_price;
      value += val;
      return { it, qty, val };
    });
    if (type === "low-stock") rows = rows.filter((r) => r.qty <= r.it.low_stock_alert);
    return {
      title: type === "low-stock" ? "Low Stock Summary" : "Stock & Valuation",
      headers: ["Item", "Qty", "Unit", "Purchase Price", "Stock Value"],
      rows: rows.map((r) => [r.it.name, r.qty, r.it.unit || "", r.it.purchase_price.toFixed(2), r.val.toFixed(2)]),
      summary: type === "stock" ? [{ label: "Total Stock Value", value: m(value) }] : [{ label: "Low-stock items", value: String(rows.length) }],
    };
  }

  if (type === "income-expense") {
    const expCat = all<{ category: string | null; s: number }>("SELECT category, SUM(amount) s FROM expenses WHERE business_id=? AND date>=? AND date<=? GROUP BY category", [bid, from, to]);
    const incCat = all<{ category: string | null; s: number }>("SELECT category, SUM(amount) s FROM incomes WHERE business_id=? AND date>=? AND date<=? GROUP BY category", [bid, from, to]);
    const rows: (string | number)[][] = [
      ...incCat.map((r) => ["Income", r.category || "Uncategorized", r.s.toFixed(2)]),
      ...expCat.map((r) => ["Expense", r.category || "Uncategorized", r.s.toFixed(2)]),
    ];
    const totInc = incCat.reduce((a, r) => a + r.s, 0);
    const totExp = expCat.reduce((a, r) => a + r.s, 0);
    return {
      title: "Income vs Expense",
      headers: ["Type", "Category", "Amount"],
      rows,
      summary: [{ label: "Total Income", value: m(totInc) }, { label: "Total Expense", value: m(totExp) }, { label: "Net", value: m(totInc - totExp) }],
    };
  }

  return { title: "Report", headers: ["—"], rows: [] };
}
