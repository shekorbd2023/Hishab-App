import { all, get } from "./db";

// ---------- Party balances (+ = receivable / To Receive) ----------------------
export function partyBalances(businessId: string): Record<string, number> {
  const bal: Record<string, number> = {};
  const parties = all<{ id: string; opening_balance: number }>(
    "SELECT id, opening_balance FROM parties WHERE business_id = ?",
    [businessId]
  );
  for (const p of parties) bal[p.id] = p.opening_balance || 0;

  const docAgg = all<{ party_id: string; kind: string; s: number }>(
    `SELECT party_id, kind, SUM(total) s FROM documents
     WHERE business_id = ? AND party_id IS NOT NULL GROUP BY party_id, kind`,
    [businessId]
  );
  for (const d of docAgg) {
    if (bal[d.party_id] === undefined) bal[d.party_id] = 0;
    if (d.kind === "sales_invoice") bal[d.party_id] += d.s;
    else if (d.kind === "sales_return") bal[d.party_id] -= d.s;
    else if (d.kind === "purchase_bill") bal[d.party_id] -= d.s;
    else if (d.kind === "purchase_return") bal[d.party_id] += d.s;
  }
  const payAgg = all<{ party_id: string; kind: string; s: number }>(
    `SELECT party_id, kind, SUM(amount) s FROM payments
     WHERE business_id = ? AND party_id IS NOT NULL GROUP BY party_id, kind`,
    [businessId]
  );
  for (const p of payAgg) {
    if (bal[p.party_id] === undefined) bal[p.party_id] = 0;
    if (p.kind === "in") bal[p.party_id] -= p.s;
    else if (p.kind === "out") bal[p.party_id] += p.s;
  }
  return bal;
}

export function partyBalance(businessId: string, partyId: string): number {
  return partyBalances(businessId)[partyId] ?? 0;
}

export function receivablePayableTotals(businessId: string): { receivable: number; payable: number } {
  let receivable = 0;
  let payable = 0;
  for (const v of Object.values(partyBalances(businessId))) {
    if (v > 0) receivable += v;
    else if (v < 0) payable += -v;
  }
  return { receivable, payable };
}

// ---------- Account balances --------------------------------------------------
export function accountBalances(businessId: string): Record<string, number> {
  const bal: Record<string, number> = {};
  const accts = all<{ id: string; opening_balance: number }>(
    "SELECT id, opening_balance FROM accounts WHERE business_id = ?",
    [businessId]
  );
  for (const a of accts) bal[a.id] = a.opening_balance || 0;

  const pay = all<{ account_id: string; kind: string; s: number }>(
    `SELECT account_id, kind, SUM(amount) s FROM payments
     WHERE business_id = ? AND account_id IS NOT NULL GROUP BY account_id, kind`,
    [businessId]
  );
  for (const p of pay) {
    if (bal[p.account_id] === undefined) continue;
    if (p.kind === "in") bal[p.account_id] += p.s;
    else bal[p.account_id] -= p.s;
  }
  const exp = all<{ account_id: string; s: number }>(
    "SELECT account_id, SUM(amount) s FROM expenses WHERE business_id = ? AND account_id IS NOT NULL GROUP BY account_id",
    [businessId]
  );
  for (const e of exp) if (bal[e.account_id] !== undefined) bal[e.account_id] -= e.s;
  const inc = all<{ account_id: string; s: number }>(
    "SELECT account_id, SUM(amount) s FROM incomes WHERE business_id = ? AND account_id IS NOT NULL GROUP BY account_id",
    [businessId]
  );
  for (const i of inc) if (bal[i.account_id] !== undefined) bal[i.account_id] += i.s;
  const tOut = all<{ from_account_id: string; s: number }>(
    "SELECT from_account_id, SUM(amount) s FROM transfers WHERE business_id = ? AND from_account_id IS NOT NULL GROUP BY from_account_id",
    [businessId]
  );
  for (const t of tOut) if (bal[t.from_account_id] !== undefined) bal[t.from_account_id] -= t.s;
  const tIn = all<{ to_account_id: string; s: number }>(
    "SELECT to_account_id, SUM(amount) s FROM transfers WHERE business_id = ? AND to_account_id IS NOT NULL GROUP BY to_account_id",
    [businessId]
  );
  for (const t of tIn) if (bal[t.to_account_id] !== undefined) bal[t.to_account_id] += t.s;
  return bal;
}

export function totalCashBank(businessId: string): number {
  return Object.values(accountBalances(businessId)).reduce((a, b) => a + b, 0);
}

// ---------- Item stock --------------------------------------------------------
export function itemStocks(businessId: string): Record<string, number> {
  const stock: Record<string, number> = {};
  const items = all<{ id: string; opening_stock: number }>(
    "SELECT id, opening_stock FROM items WHERE business_id = ?",
    [businessId]
  );
  for (const it of items) stock[it.id] = it.opening_stock || 0;

  const rows = all<{ item_id: string; kind: string; q: number }>(
    `SELECT di.item_id AS item_id, d.kind AS kind, SUM(di.qty) q
     FROM doc_items di JOIN documents d ON d.id = di.document_id
     WHERE d.business_id = ? AND di.item_id IS NOT NULL GROUP BY di.item_id, d.kind`,
    [businessId]
  );
  for (const r of rows) {
    if (stock[r.item_id] === undefined) stock[r.item_id] = 0;
    if (r.kind === "purchase_bill") stock[r.item_id] += r.q;
    else if (r.kind === "sales_return") stock[r.item_id] += r.q;
    else if (r.kind === "sales_invoice") stock[r.item_id] -= r.q;
    else if (r.kind === "purchase_return") stock[r.item_id] -= r.q;
  }
  return stock;
}

// ---------- Period sums -------------------------------------------------------
export function sumDocuments(businessId: string, kind: string, from?: string, to?: string): number {
  let sql = "SELECT COALESCE(SUM(total),0) s FROM documents WHERE business_id = ? AND kind = ?";
  const p: unknown[] = [businessId, kind];
  if (from) { sql += " AND date >= ?"; p.push(from); }
  if (to) { sql += " AND date <= ?"; p.push(to); }
  return get<{ s: number }>(sql, p)?.s ?? 0;
}

export function sumExpenses(businessId: string, from?: string, to?: string): number {
  let sql = "SELECT COALESCE(SUM(amount),0) s FROM expenses WHERE business_id = ?";
  const p: unknown[] = [businessId];
  if (from) { sql += " AND date >= ?"; p.push(from); }
  if (to) { sql += " AND date <= ?"; p.push(to); }
  return get<{ s: number }>(sql, p)?.s ?? 0;
}

export function sumIncomes(businessId: string, from?: string, to?: string): number {
  let sql = "SELECT COALESCE(SUM(amount),0) s FROM incomes WHERE business_id = ?";
  const p: unknown[] = [businessId];
  if (from) { sql += " AND date >= ?"; p.push(from); }
  if (to) { sql += " AND date <= ?"; p.push(to); }
  return get<{ s: number }>(sql, p)?.s ?? 0;
}

// ---------- Document status (from linked payments) ----------------------------
export function docPaid(documentId: string): number {
  return get<{ s: number }>(
    "SELECT COALESCE(SUM(amount),0) s FROM payments WHERE document_id = ?",
    [documentId]
  )?.s ?? 0;
}

export function monthRange(d = new Date()): { from: string; to: string; label: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const from = new Date(y, m, 1).toISOString().slice(0, 10);
  const to = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
  return { from, to, label };
}
