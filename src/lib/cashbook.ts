// Server loader shared by /expense and /income (Karbar list + dialog).
import { all, get } from "./db";

export type CashRow = {
  id: string; number: number; category: string | null; amount: number; date: string; note: string | null;
  account_id: string | null; aname: string | null; lines: { name: string; qty: number; rate: number }[]; created_at: string;
};

export function cashbookData(bid: string, kind: "expense" | "income") {
  const table = kind === "income" ? "incomes" : "expenses";
  const rows: CashRow[] = all<Omit<CashRow, "lines"> & { lines: string | null }>(
    `SELECT e.id, e.number, e.category, e.amount, e.date, e.note, e.account_id, a.name aname, e.lines, e.created_at
     FROM ${table} e LEFT JOIN accounts a ON a.id = e.account_id WHERE e.business_id = ? ORDER BY e.date DESC, e.number DESC`, [bid]
  ).map((r) => {
    let lines: CashRow["lines"] = [];
    try { lines = r.lines ? JSON.parse(r.lines) : []; } catch { lines = []; }
    return { ...r, lines };
  });
  const accounts = all<{ id: string; name: string }>("SELECT id, name FROM accounts WHERE business_id = ? ORDER BY created_at", [bid]);
  const categories = all<{ name: string }>(
    `SELECT name FROM categories WHERE business_id=? AND kind=? UNION SELECT category AS name FROM ${table} WHERE business_id=? AND category IS NOT NULL AND category != ''`,
    [bid, kind, bid]
  ).map((r) => r.name).sort((a, b) => a.localeCompare(b));
  const c = get<{ value: number }>("SELECT value FROM counters WHERE business_id=? AND kind=?", [bid, kind]);
  const maxNo = rows.reduce((m, r) => Math.max(m, r.number || 0), 0);
  return { rows, accounts, categories, nextNo: Math.max(c?.value ?? 0, maxNo) + 1 };
}
