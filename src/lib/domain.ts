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
  const adj = all<{ account_id: string; kind: string; s: number }>(
    "SELECT account_id, kind, SUM(amount) s FROM account_adjustments WHERE business_id = ? GROUP BY account_id, kind",
    [businessId]
  );
  for (const a of adj) if (bal[a.account_id] !== undefined) bal[a.account_id] += a.kind === "add" ? a.s : -a.s;
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
  const adj = all<{ item_id: string; q: number }>(
    "SELECT item_id, SUM(qty_delta) q FROM stock_adjustments WHERE business_id = ? GROUP BY item_id",
    [businessId]
  );
  for (const a of adj) {
    if (stock[a.item_id] === undefined) stock[a.item_id] = 0;
    stock[a.item_id] += a.q;
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


// ---------- Ledgers with running balance (Karbar two-pane detail screens) ----------
export type LedgerRow = {
  key: string; date: string; created: string; type: string; label: string; party: string | null;
  amount: number; delta: number; balance: number; remarks: string | null; ref: string | null; refKind: string | null;
};

const DOC_LABEL: Record<string, string> = {
  sales_invoice: "Sales Invoice", purchase_bill: "Purchase", sales_return: "Sales Return",
  purchase_return: "Purchase Return", quotation: "Quotation",
};
export function docLabel(kind: string, number: number | string): string {
  return `${DOC_LABEL[kind] || kind} #${number}`;
}

/** Every money movement through one account, oldest → newest, with running balance. */
export function accountLedger(businessId: string, accountId: string): LedgerRow[] {
  const acc = get<{ opening_balance: number; created_at: string }>("SELECT opening_balance, created_at FROM accounts WHERE id=? AND business_id=?", [accountId, businessId]);
  if (!acc) return [];
  const rows: Omit<LedgerRow, "balance">[] = [];
  for (const p of all<{ id: string; kind: string; amount: number; date: string; created_at: string; note: string | null; number: number; document_id: string | null; dkind: string | null; dnum: number | null; pname: string | null }>(
    `SELECT p.id, p.kind, p.amount, p.date, p.created_at, p.note, p.number, p.document_id, d.kind dkind, d.number dnum, pa.name pname
     FROM payments p LEFT JOIN documents d ON d.id=p.document_id LEFT JOIN parties pa ON pa.id=p.party_id
     WHERE p.business_id=? AND p.account_id=?`, [businessId, accountId])) {
    const label = p.dkind ? docLabel(p.dkind, p.dnum ?? "") : `${p.kind === "in" ? "Payment In" : "Payment Out"} #${p.number}`;
    rows.push({ key: "p" + p.id, date: p.date, created: p.created_at, type: p.dkind || (p.kind === "in" ? "payment_in" : "payment_out"), label, party: p.pname, amount: p.amount, delta: p.kind === "in" ? p.amount : -p.amount, remarks: p.note, ref: p.document_id || p.id, refKind: p.document_id ? "doc" : "payment" });
  }
  for (const e of all<{ id: string; amount: number; date: string; created_at: string; note: string | null; category: string | null; number: number }>(
    "SELECT id, amount, date, created_at, note, category, number FROM expenses WHERE business_id=? AND account_id=?", [businessId, accountId])) {
    rows.push({ key: "e" + e.id, date: e.date, created: e.created_at, type: "expense", label: `Expense #${e.number}`, party: e.category, amount: e.amount, delta: -e.amount, remarks: e.note, ref: e.id, refKind: "expense" });
  }
  for (const i of all<{ id: string; amount: number; date: string; created_at: string; note: string | null; category: string | null; number: number }>(
    "SELECT id, amount, date, created_at, note, category, number FROM incomes WHERE business_id=? AND account_id=?", [businessId, accountId])) {
    rows.push({ key: "i" + i.id, date: i.date, created: i.created_at, type: "income", label: `Income #${i.number}`, party: i.category, amount: i.amount, delta: i.amount, remarks: i.note, ref: i.id, refKind: "income" });
  }
  for (const t of all<{ id: string; amount: number; date: string; created_at: string; note: string | null; from_account_id: string; to_account_id: string; fname: string | null; tname: string | null }>(
    `SELECT t.id, t.amount, t.date, t.created_at, t.note, t.from_account_id, t.to_account_id, fa.name fname, ta.name tname
     FROM transfers t LEFT JOIN accounts fa ON fa.id=t.from_account_id LEFT JOIN accounts ta ON ta.id=t.to_account_id
     WHERE t.business_id=? AND (t.from_account_id=? OR t.to_account_id=?)`, [businessId, accountId, accountId])) {
    const out = t.from_account_id === accountId;
    rows.push({ key: "t" + t.id + (out ? "o" : "i"), date: t.date, created: t.created_at, type: "transfer", label: "Transfer Balance", party: out ? `To ${t.tname}` : `From ${t.fname}`, amount: t.amount, delta: out ? -t.amount : t.amount, remarks: t.note, ref: t.id, refKind: "transfer" });
  }
  for (const a of all<{ id: string; kind: string; amount: number; date: string; created_at: string; note: string | null }>(
    "SELECT id, kind, amount, date, created_at, note FROM account_adjustments WHERE business_id=? AND account_id=?", [businessId, accountId])) {
    rows.push({ key: "a" + a.id, date: a.date, created: a.created_at, type: a.kind === "add" ? "add_money" : "reduce_money", label: a.kind === "add" ? "Add Money" : "Reduce Money", party: null, amount: a.amount, delta: a.kind === "add" ? a.amount : -a.amount, remarks: a.note, ref: a.id, refKind: "adjustment" });
  }
  rows.sort((x, y) => (x.date === y.date ? (x.created < y.created ? -1 : 1) : x.date < y.date ? -1 : 1));
  let bal = acc.opening_balance || 0;
  return rows.map((r) => { bal += r.delta; return { ...r, balance: Math.round(bal * 100) / 100 }; });
}

/** Party ledger (debit = they owe more, credit = they owe less), oldest → newest with running balance. */
export function partyLedger(businessId: string, partyId: string): (LedgerRow & { debit: number; credit: number; status: string | null; total: number })[] {
  const party = get<{ opening_balance: number; created_at: string; as_of_date: string | null }>("SELECT opening_balance, created_at, as_of_date FROM parties WHERE id=? AND business_id=?", [partyId, businessId]);
  if (!party) return [];
  type R = LedgerRow & { debit: number; credit: number; status: string | null; total: number };
  const rows: Omit<R, "balance">[] = [];
  if (party.opening_balance) {
    const d = party.as_of_date || party.created_at.slice(0, 10);
    rows.push({ key: "open", date: d, created: "", type: "opening", label: "Opening Balance", party: null, amount: Math.abs(party.opening_balance), delta: party.opening_balance, debit: party.opening_balance > 0 ? party.opening_balance : 0, credit: party.opening_balance < 0 ? -party.opening_balance : 0, remarks: null, ref: null, refKind: null, status: null, total: Math.abs(party.opening_balance) });
  }
  for (const d of all<{ id: string; kind: string; number: number; date: string; created_at: string; total: number; status: string; notes: string | null }>(
    "SELECT id, kind, number, date, created_at, total, status, notes FROM documents WHERE business_id=? AND party_id=? AND kind!='quotation'", [businessId, partyId])) {
    const sign = d.kind === "sales_invoice" || d.kind === "purchase_return" ? 1 : -1;
    rows.push({ key: "d" + d.id, date: d.date, created: d.created_at, type: d.kind, label: docLabel(d.kind, d.number), party: null, amount: d.total, delta: sign * d.total, debit: sign > 0 ? d.total : 0, credit: sign < 0 ? d.total : 0, remarks: d.notes, ref: d.id, refKind: "doc", status: d.status, total: d.total });
  }
  for (const p of all<{ id: string; kind: string; amount: number; date: string; created_at: string; note: string | null; number: number; is_auto: number; document_id: string | null }>(
    "SELECT id, kind, amount, date, created_at, note, number, is_auto, document_id FROM payments WHERE business_id=? AND party_id=?", [businessId, partyId])) {
    const sign = p.kind === "in" ? -1 : 1;
    const label = p.is_auto ? (p.kind === "in" ? "Received with invoice" : "Paid with bill") : `${p.kind === "in" ? "Payment In" : "Payment Out"} #${p.number}`;
    rows.push({ key: "p" + p.id, date: p.date, created: p.created_at, type: p.kind === "in" ? "payment_in" : "payment_out", label, party: null, amount: p.amount, delta: sign * p.amount, debit: sign > 0 ? p.amount : 0, credit: sign < 0 ? p.amount : 0, remarks: p.note, ref: p.document_id || p.id, refKind: p.document_id ? "doc" : "payment", status: null, total: p.amount });
  }
  rows.sort((x, y) => (x.date === y.date ? (x.created < y.created ? -1 : 1) : x.date < y.date ? -1 : 1));
  let bal = 0;
  return rows.map((r) => { bal += r.delta; return { ...r, balance: Math.round(bal * 100) / 100 } as R; });
}

/** Item activity: stock movement per transaction with running quantity. */
export function itemActivity(businessId: string, itemId: string): { key: string; date: string; label: string; party: string | null; change: number; qty: number; remarks: string | null; ref: string | null; kind: string }[] {
  const it = get<{ opening_stock: number; created_at: string }>("SELECT opening_stock, created_at FROM items WHERE id=? AND business_id=?", [itemId, businessId]);
  if (!it) return [];
  const rows: { key: string; date: string; created: string; label: string; party: string | null; change: number; remarks: string | null; ref: string | null; kind: string }[] = [];
  if (it.opening_stock) rows.push({ key: "open", date: it.created_at.slice(0, 10), created: "", label: "Opening Stock", party: null, change: it.opening_stock, remarks: null, ref: null, kind: "opening" });
  for (const r of all<{ id: string; kind: string; number: number; date: string; created_at: string; qty: number; pname: string | null; did: string }>(
    `SELECT di.id, d.kind, d.number, d.date, d.created_at, di.qty, p.name pname, d.id did FROM doc_items di
     JOIN documents d ON d.id=di.document_id LEFT JOIN parties p ON p.id=d.party_id
     WHERE d.business_id=? AND di.item_id=? AND d.kind!='quotation'`, [businessId, itemId])) {
    const sign = r.kind === "purchase_bill" || r.kind === "sales_return" ? 1 : -1;
    rows.push({ key: "d" + r.id, date: r.date, created: r.created_at, label: docLabel(r.kind, r.number), party: r.pname, change: sign * r.qty, remarks: null, ref: r.did, kind: r.kind });
  }
  for (const a of all<{ id: string; qty_delta: number; reason: string | null; date: string; created_at: string }>(
    "SELECT id, qty_delta, reason, date, created_at FROM stock_adjustments WHERE business_id=? AND item_id=?", [businessId, itemId])) {
    rows.push({ key: "a" + a.id, date: a.date, created: a.created_at, label: a.qty_delta >= 0 ? "Add Stock" : "Reduce Stock", party: null, change: a.qty_delta, remarks: a.reason, ref: null, kind: "adjust" });
  }
  rows.sort((x, y) => (x.date === y.date ? (x.created < y.created ? -1 : 1) : x.date < y.date ? -1 : 1));
  let q = 0;
  return rows.map((r) => { q += r.change; return { key: r.key, date: r.date, label: r.label, party: r.party, change: r.change, qty: Math.round(q * 1000) / 1000, remarks: r.remarks, ref: r.ref, kind: r.kind }; });
}
