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

export function buildReport(bid: string, type: string, from: string, to: string, sym: string, opts: { partyId?: string } = {}): Report {
  const m = (n: number) => `${sym} ${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const partyId = opts.partyId && opts.partyId !== "all" ? opts.partyId : undefined;

  if (type === "sales" || type === "purchase" || type === "sales-return" || type === "purchase-return") {
    const kind = type === "sales" ? "sales_invoice" : type === "purchase" ? "purchase_bill" : type === "sales-return" ? "sales_return" : "purchase_return";
    const params: unknown[] = [bid, kind, from, to];
    let where = "d.business_id=? AND d.kind=? AND d.date>=? AND d.date<=?";
    if (partyId) { where += " AND d.party_id=?"; params.push(partyId); }
    const rows = all<{ number: number; date: string; total: number; status: string; pname: string | null }>(
      `SELECT d.number, d.date, d.total, d.status, p.name pname FROM documents d
       LEFT JOIN parties p ON p.id = d.party_id WHERE ${where} ORDER BY d.date`, params
    );
    const total = rows.reduce((a, r) => a + r.total, 0);
    const titles: Record<string, string> = { sales: "Sales Report", purchase: "Purchase Report", "sales-return": "Sales Return Report", "purchase-return": "Purchase Return Report" };
    return {
      title: titles[type],
      headers: ["No.", "Date", "Party", "Status", "Total"],
      rows: rows.map((r) => [r.number, r.date, r.pname || "Cash Sale", r.status, r.total.toFixed(2)]),
      summary: [{ label: "Total", value: m(total) }, { label: "Count", value: String(rows.length) }],
    };
  }

  if (type === "party-statement") {
    if (!partyId) return { title: "Party Statement", headers: ["Info"], rows: [["Select a party above to view their statement."]] };
    const KIND: Record<string, [string, number]> = {
      sales_invoice: ["Sales Invoice", 1], sales_return: ["Sales Return", -1],
      purchase_bill: ["Purchase Bill", -1], purchase_return: ["Purchase Return", 1],
    };
    const docs = all<{ kind: string; number: number; date: string; total: number }>(
      `SELECT kind, number, date, total FROM documents WHERE business_id=? AND party_id=? AND date>=? AND date<=? AND kind!='quotation'`, [bid, partyId, from, to]
    );
    const pays = all<{ kind: string; amount: number; date: string }>(
      `SELECT kind, amount, date FROM payments WHERE business_id=? AND party_id=? AND date>=? AND date<=?`, [bid, partyId, from, to]
    );
    type E = { date: string; label: string; debit: number; credit: number };
    const entries: E[] = [
      ...docs.map((d) => { const [lbl, sgn] = KIND[d.kind] || [d.kind, 1]; return { date: d.date, label: `${lbl} #${d.number}`, debit: sgn > 0 ? d.total : 0, credit: sgn < 0 ? d.total : 0 }; }),
      ...pays.map((p) => ({ date: p.date, label: p.kind === "in" ? "Payment In" : "Payment Out", debit: p.kind === "out" ? p.amount : 0, credit: p.kind === "in" ? p.amount : 0 })),
    ].sort((a, b) => (a.date < b.date ? -1 : 1));
    let bal = 0;
    const rows = entries.map((e) => { bal += e.debit - e.credit; return [e.date, e.label, e.debit ? e.debit.toFixed(2) : "", e.credit ? e.credit.toFixed(2) : "", bal.toFixed(2)]; });
    return {
      title: "Party Statement",
      headers: ["Date", "Particulars", "Debit", "Credit", "Balance"],
      rows,
      summary: [{ label: "Closing balance", value: `${bal >= 0 ? "Receivable " : "Payable "}${m(Math.abs(bal))}` }],
    };
  }

  if (type === "discount") {
    const rows = all<{ pname: string | null; kind: string; d: number }>(
      `SELECT p.name pname, d.kind, SUM(d.discount_total) d FROM documents d LEFT JOIN parties p ON p.id=d.party_id
       WHERE d.business_id=? AND d.date>=? AND d.date<=? AND d.discount_total>0 GROUP BY d.party_id, d.kind ORDER BY d DESC`, [bid, from, to]
    );
    const total = rows.reduce((a, r) => a + r.d, 0);
    return {
      title: "Discount Report",
      headers: ["Party", "Type", "Discount"],
      rows: rows.map((r) => [r.pname || "Cash Sale", r.kind.replace("_", " "), r.d.toFixed(2)]),
      summary: [{ label: "Total discount", value: m(total) }],
    };
  }

  if (type === "tax") {
    const rows = all<{ number: number; date: string; kind: string; tax_total: number; total: number; pname: string | null }>(
      `SELECT d.number, d.date, d.kind, d.tax_total, d.total, p.name pname FROM documents d LEFT JOIN parties p ON p.id=d.party_id
       WHERE d.business_id=? AND d.date>=? AND d.date<=? AND d.tax_total>0 ORDER BY d.date`, [bid, from, to]
    );
    const total = rows.reduce((a, r) => a + r.tax_total, 0);
    return {
      title: "Tax Report",
      headers: ["No.", "Date", "Type", "Party", "Tax"],
      rows: rows.map((r) => [r.number, r.date, r.kind.replace("_", " "), r.pname || "Cash Sale", r.tax_total.toFixed(2)]),
      summary: [{ label: "Total tax", value: m(total) }],
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
