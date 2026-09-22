// Report engine — builds every Karbar-style report as plain JSON that <ReportView> renders.
// Server only (uses the DB). All numbers are derived from the transactions, never stored.
import { all, get } from "./db";
import { partyBalances, accountBalances, itemStocks, accountLedger, partyLedger, itemActivity, docLabel } from "./domain";
import { fmtDate, tk, qty as fq, TODAY } from "./format";

/* ============================== Types ============================== */
export type ColKind = "text" | "money" | "qty" | "date" | "status" | "signed";
export type Col = { key: string; label: string; kind?: ColKind; total?: boolean; tone?: "pos" | "neg"; minWidth?: number };
export type Cell = string | number | null;
export type RRow = {
  id: string;
  c: Record<string, Cell>;
  sub?: Record<string, string>;       // small secondary line under a cell
  suffix?: Record<string, string>;    // inline suffix after a value (e.g. "Dr")
  tone?: Record<string, "pos" | "neg">;
  href?: string;
  variant?: "bf" | "item" | "green" | "strong";
  children?: RRow[];                  // expandable rows (P&L drill-down)
  sort?: { d?: string; a?: number; n?: string; q?: number };
};
export type PickOpt = { id: string; label: string; sub?: string; right?: string; rightTone?: "pos" | "neg" };
export type Filter =
  | { kind: "picker"; param: string; value: string | null; placeholder: string; options: PickOpt[]; clearable?: boolean; width?: number }
  | { kind: "select"; param: string; value: string; options: { v: string; l: string }[] }
  | { kind: "switch"; param: string; value: boolean; label: string }
  | { kind: "check"; param: string; value: boolean; label: string }
  | { kind: "seg"; param: string; value: string; options: { v: string; l: string }[] };
export type Kpi = { v: string; l: string; tone?: "pos" | "neg" };
export type DateInfo = { key: string; from: string; to: string; label: string };
export type Report = {
  type: string;
  title: string;          // screen title
  fileTitle: string;      // used in the letterhead + download filename
  date: DateInfo | null;
  filters: Filter[];
  kpis: Kpi[];
  cols: Col[];
  rows: RRow[];
  totals?: boolean;
  sortOptions?: { v: string; l: string }[];
  defaultSort?: string;
  searchable?: string;    // search placeholder; absent = no search box
  empty?: { title: string; text: string; icon?: string };
  note?: string;
  compact?: boolean;      // narrow centred table (P&L)
};

export type SP = Record<string, string | undefined>;

/* ============================== Catalogue (hub + routing) ============================== */
export type ReportMeta = { type: string; title: string; desc: string; group: string; icon: string; href?: string };
export const REPORT_GROUPS: { key: string; title: string; chip: string }[] = [
  { key: "transactions", title: "Transaction Report", chip: "Transactions" },
  { key: "parties", title: "Party Report", chip: "Parties" },
  { key: "inventory", title: "Inventory Report", chip: "Inventory" },
  { key: "income", title: "Income Expense Report", chip: "Income Expense" },
  { key: "status", title: "Business Status", chip: "Business Status" },
  { key: "extras", title: "Hishab Extras", chip: "Hishab Extras" },
];
export const REPORTS: ReportMeta[] = [
  { type: "sales", title: "Sales", desc: "All sales invoices with received and unpaid amounts", group: "transactions", icon: "receipt" },
  { type: "purchase", title: "Purchase", desc: "All purchase bills with paid and unpaid amounts", group: "transactions", icon: "cart" },
  { type: "sales-return", title: "Sales Return", desc: "Items your customers returned in a period", group: "transactions", icon: "swap" },
  { type: "purchase-return", title: "Purchase Return", desc: "Items you returned to your suppliers", group: "transactions", icon: "swap" },
  { type: "day-book", title: "Day Book", desc: "Every transaction of the day with money in and out", group: "transactions", icon: "calendar" },
  { type: "all-transactions", title: "All Transactions", desc: "Sales, purchases, payments, income and expenses together", group: "transactions", icon: "statement" },
  { type: "profit-and-loss", title: "Profit And Loss", desc: "Net sales, cost of goods, expenses and net profit", group: "transactions", icon: "chart" },
  { type: "party-statement", title: "Party Statement", desc: "Debit, credit and running balance of one party", group: "parties", icon: "user" },
  { type: "all-party", title: "All Party Report", desc: "Receivable and payable balance of every party", group: "parties", icon: "users" },
  { type: "item-detail", title: "Item Details Report", desc: "Stock movement of one item with running quantity", group: "inventory", icon: "box" },
  { type: "item-list", title: "Item List Report", desc: "All items with sales, purchase, MRP and wholesale rates", group: "inventory", icon: "tag" },
  { type: "low-stock-summary", title: "Low Stock Summary Report", desc: "Items at or below their low stock level", group: "inventory", icon: "bell" },
  { type: "stock-quantity", title: "Stock Quantity Report", desc: "Opening stock, quantity in/out and closing stock", group: "inventory", icon: "grid" },
  { type: "income-expense", title: "Income Expense Report", desc: "Every income and expense entry with totals", group: "income", icon: "income" },
  { type: "expense-category", title: "Expense Category", desc: "Expenses grouped by category", group: "income", icon: "receipt" },
  { type: "income-category", title: "Income Category", desc: "Other income grouped by category", group: "income", icon: "income" },
  { type: "cash-in-hand-statement", title: "Cash In Hand Statement", desc: "Money in and out of your cash with balance", group: "status", icon: "cash" },
  { type: "bank-statement", title: "Bank Statement", desc: "Money in and out of bank and wallet accounts", group: "status", icon: "bank" },
  { type: "discount", title: "Discount Report", desc: "Sales and purchase discounts by party", group: "status", icon: "percent" },
  { type: "tax-sales", title: "Tax Sales", desc: "Sales invoices where tax was charged", group: "status", icon: "percent" },
  { type: "tax-purchase", title: "Tax Purchase", desc: "Purchase bills where tax was paid", group: "status", icon: "percent" },
  { type: "monthly", title: "Monthly Business Analysis", desc: "Month summary with growth, top items and narrative", group: "extras", icon: "sparkle" },
  { type: "json-report", title: "Full JSON Business Report", desc: "Download the whole business with computed balances", group: "extras", icon: "download" },
  { type: "audit", title: "Audit Log", desc: "Who created, edited or deleted what, and when", group: "extras", icon: "audit", href: "/audit" },
  { type: "backup", title: "Backup & Restore", desc: "Download a JSON backup or restore from one", group: "extras", icon: "backup", href: "/backup" },
];
export const REPORT_TYPES = new Set(REPORTS.filter((r) => !r.href && r.type !== "monthly" && r.type !== "json-report").map((r) => r.type));
export const LEGACY_TYPES: Record<string, string> = {
  "profit-loss": "profit-and-loss", "all-parties": "all-party", stock: "stock-quantity", "low-stock": "low-stock-summary", tax: "tax-sales",
};

/* ============================== Dates ============================== */
const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const RANGE_LABEL: Record<string, string> = {
  all: "All Date", today: "Today", yesterday: "Yesterday", week: "This Week", month: "This Month",
  last_month: "Last Month", fiscal: "This Fiscal Year", year: "This Year",
};
/** Same presets as the client DateFilter, computed on the Dhaka calendar. */
export function presetRange(key: string): DateInfo {
  const t = TODAY();
  const [y, m, d] = t.split("-").map(Number);
  const U = (yy: number, mm: number, dd: number) => isoOf(new Date(Date.UTC(yy, mm, dd)));
  const mk = (from: string, to: string): DateInfo => ({ key, from, to, label: RANGE_LABEL[key] });
  switch (key) {
    case "today": return mk(t, t);
    case "yesterday": { const s = U(y, m - 1, d - 1); return mk(s, s); }
    case "week": { const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; return mk(U(y, m - 1, d - dow), t); }
    case "month": return mk(U(y, m - 1, 1), U(y, m, 0));
    case "last_month": return mk(U(y, m - 2, 1), U(y, m - 1, 0));
    case "fiscal": { const fy = m >= 7 ? y : y - 1; return mk(U(fy, 6, 1), U(fy + 1, 5, 30)); }
    case "year": return mk(U(y, 0, 1), U(y, 11, 31));
    default: return { key: "all", from: "0000-01-01", to: "9999-12-31", label: "All Date" };
  }
}
export function resolveRange(sp: SP, def: string): DateInfo {
  const key = sp.range;
  const valid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (key && key !== "custom" && RANGE_LABEL[key]) return presetRange(key);
  if (valid(sp.from) && valid(sp.to)) {
    const from = sp.from! <= sp.to! ? sp.from! : sp.to!;
    const to = sp.from! <= sp.to! ? sp.to! : sp.from!;
    return { key: "custom", from, to, label: from === to ? fmtDate(from) : `${fmtDate(from)} - ${fmtDate(to)}` };
  }
  return presetRange(def);
}

/* ============================== Helpers ============================== */
const r2 = (n: number) => Math.round((n || 0) * 100) / 100;
const KIND_OF: Record<string, string> = { sales: "sales_invoice", purchase: "purchase_bill", "sales-return": "sales_return", "purchase-return": "purchase_return" };
const DOC_SORT = [
  { v: "latest", l: "Latest First" }, { v: "oldest", l: "Oldest First" },
  { v: "amount_desc", l: "Amount High → Low" }, { v: "amount_asc", l: "Amount Low → High" },
];
const docHref = (id: string) => `/doc/${id}`;
function refHref(refKind: string | null, ref: string | null): string | undefined {
  if (!ref) return undefined;
  if (refKind === "doc") return `/doc/${ref}`;
  if (refKind === "payment") return `/receipt/${ref}`;
  if (refKind === "expense") return `/expense`;
  if (refKind === "income") return `/income`;
  return undefined;
}
function splitLabel(label: string): { particular: string; no: string } {
  const m = label.match(/^(.*) #(\S+)$/);
  return m ? { particular: m[1], no: m[2] } : { particular: label, no: "" };
}
const partyOptions = (bid: string): PickOpt[] => {
  const bal = partyBalances(bid);
  return all<{ id: string; name: string; phone: string | null }>("SELECT id, name, phone FROM parties WHERE business_id=? ORDER BY name COLLATE NOCASE", [bid])
    .map((p) => { const b = bal[p.id] || 0; return { id: p.id, label: p.name, sub: p.phone || undefined, right: b ? tk(Math.abs(b)) : "Settled", rightTone: b > 0 ? "pos" : b < 0 ? "neg" : undefined }; });
};

/* ============================== Builder ============================== */
export function buildReport(bid: string, type: string, sp: SP): Report {
  switch (type) {
    case "sales": case "purchase": case "sales-return": case "purchase-return": return docReport(bid, type, sp);
    case "day-book": return dayBook(bid, sp);
    case "all-transactions": return allTransactions(bid, sp);
    case "profit-and-loss": return profitLoss(bid, sp);
    case "party-statement": return partyStatement(bid, sp);
    case "all-party": return allParty(bid, sp);
    case "item-detail": return itemDetail(bid, sp);
    case "item-list": return itemList(bid, sp);
    case "low-stock-summary": return lowStock(bid, sp);
    case "stock-quantity": return stockQuantity(bid, sp);
    case "income-expense": return incomeExpense(bid, sp);
    case "expense-category": case "income-category": return categoryReport(bid, type, sp);
    case "cash-in-hand-statement": case "bank-statement": return accountStatement(bid, type, sp);
    case "discount": return discountReport(bid, sp);
    case "tax-sales": case "tax-purchase": return taxReport(bid, type, sp);
  }
  throw new Error("Unknown report " + type);
}

/* ---------- Sales / Purchase / Returns ---------- */
function docReport(bid: string, type: string, sp: SP): Report {
  const kind = KIND_OF[type];
  const date = resolveRange(sp, "month");
  const status = ["paid", "unpaid", "partial"].includes(sp.status || "") ? sp.status! : "all";
  const params: unknown[] = [bid, kind, date.from, date.to];
  let where = "d.business_id=? AND d.kind=? AND d.date>=? AND d.date<=?";
  if (status !== "all") { where += " AND d.status=?"; params.push(status); }
  const docs = all<{ id: string; number: number; date: string; created_at: string; total: number; status: string; pname: string | null; pid: string | null; rec: number }>(
    `SELECT d.id, d.number, d.date, d.created_at, d.total, d.status, p.name pname, p.id pid,
       (SELECT COALESCE(SUM(amount),0) FROM payments WHERE document_id=d.id) rec
     FROM documents d LEFT JOIN parties p ON p.id=d.party_id WHERE ${where}
     ORDER BY d.date DESC, d.created_at DESC`, params);
  const inbound = type === "sales" || type === "purchase-return"; // money comes to us
  const recLabel = inbound ? "Received Amount" : "Paid Amount";
  const noun = { sales: "Sales", purchase: "Purchase", "sales-return": "Sales Return", "purchase-return": "Purchase Return" }[type]!;
  const noLabel = type === "sales" ? "Invoice No" : type === "purchase" ? "Bill No" : "Return No";
  const total = docs.reduce((a, d) => a + d.total, 0);
  const rec = docs.reduce((a, d) => a + Math.min(d.rec, d.total), 0);
  return {
    type, title: `${noun} Report`, fileTitle: `${noun} Report`, date,
    filters: [{ kind: "select", param: "status", value: status, options: [{ v: "all", l: "All Status" }, { v: "paid", l: "Paid" }, { v: "unpaid", l: "Unpaid" }, { v: "partial", l: "Partially Paid" }] }],
    kpis: [
      { v: `${docs.length} Entries`, l: `Total ${noun}` },
      { v: tk(total), l: `Total ${noun} Amount` },
      { v: tk(rec), l: recLabel, tone: "pos" },
      { v: tk(total - rec), l: "Unpaid Amount", tone: total - rec > 0 ? "neg" : undefined },
    ],
    cols: [
      { key: "no", label: noLabel }, { key: "party", label: "Party Name" }, { key: "date", label: "Date", kind: "date" },
      { key: "status", label: "Status", kind: "status" }, { key: "total", label: "Total Amount", kind: "money", total: true },
      { key: "rec", label: recLabel, kind: "money", total: true }, { key: "due", label: "Unpaid Amount", kind: "money", total: true },
    ],
    rows: docs.map((d) => ({
      id: d.id, href: docHref(d.id),
      c: { no: `#${d.number}`, party: d.pname || "Cash Sale", date: d.date, status: d.status, total: d.total, rec: Math.min(d.rec, d.total), due: r2(d.total - Math.min(d.rec, d.total)) },
      tone: d.total - d.rec > 0.009 ? { due: "neg" } : undefined,
      sort: { d: d.date + d.created_at, a: d.total, n: d.pname || "" },
    })),
    totals: true, sortOptions: DOC_SORT, defaultSort: "latest", searchable: `Search ${noun.toLowerCase()}…`,
    empty: { title: `No ${noun} Found`, text: `There are no ${noun.toLowerCase()} entries in this period.` },
  };
}

/* ---------- Unified transaction feed (Day Book + All Transactions) ---------- */
type Tx = { id: string; date: string; created: string; type: string; label: string; name: string; total: number; paid: number; moneyIn: number; moneyOut: number; href?: string; status?: string };
function transactions(bid: string, from: string, to: string): Tx[] {
  const out: Tx[] = [];
  const DOC_IN: Record<string, boolean> = { sales_invoice: true, purchase_return: true, sales_return: false, purchase_bill: false };
  for (const d of all<{ id: string; kind: string; number: number; date: string; created_at: string; total: number; status: string; pname: string | null; rec: number }>(
    `SELECT d.id, d.kind, d.number, d.date, d.created_at, d.total, d.status, p.name pname,
       (SELECT COALESCE(SUM(amount),0) FROM payments WHERE document_id=d.id) rec
     FROM documents d LEFT JOIN parties p ON p.id=d.party_id
     WHERE d.business_id=? AND d.kind!='quotation' AND d.date>=? AND d.date<=?`, [bid, from, to])) {
    const inb = DOC_IN[d.kind];
    const paid = Math.min(d.rec, d.total);
    out.push({ id: "d" + d.id, date: d.date, created: d.created_at, type: d.kind, label: docLabel(d.kind, d.number), name: d.pname || "Cash Sale", total: d.total, paid, moneyIn: inb ? paid : 0, moneyOut: inb ? 0 : paid, href: docHref(d.id), status: d.status });
  }
  // payments made with a document are already counted on the document row
  for (const p of all<{ id: string; kind: string; number: number; date: string; created_at: string; amount: number; pname: string | null }>(
    `SELECT p.id, p.kind, p.number, p.date, p.created_at, p.amount, pa.name pname FROM payments p LEFT JOIN parties pa ON pa.id=p.party_id
     WHERE p.business_id=? AND p.document_id IS NULL AND p.date>=? AND p.date<=?`, [bid, from, to])) {
    const inb = p.kind === "in";
    out.push({ id: "p" + p.id, date: p.date, created: p.created_at, type: inb ? "payment_in" : "payment_out", label: `${inb ? "Payment In" : "Payment Out"} #${p.number}`, name: p.pname || "--", total: p.amount, paid: p.amount, moneyIn: inb ? p.amount : 0, moneyOut: inb ? 0 : p.amount, href: `/receipt/${p.id}` });
  }
  for (const e of all<{ id: string; number: number; date: string; created_at: string; amount: number; category: string | null }>(
    "SELECT id, number, date, created_at, amount, category FROM expenses WHERE business_id=? AND date>=? AND date<=?", [bid, from, to]))
    out.push({ id: "e" + e.id, date: e.date, created: e.created_at, type: "expense", label: `Expense #${e.number}`, name: e.category || "Uncategorized", total: e.amount, paid: e.amount, moneyIn: 0, moneyOut: e.amount, href: "/expense" });
  for (const i of all<{ id: string; number: number; date: string; created_at: string; amount: number; category: string | null }>(
    "SELECT id, number, date, created_at, amount, category FROM incomes WHERE business_id=? AND date>=? AND date<=?", [bid, from, to]))
    out.push({ id: "i" + i.id, date: i.date, created: i.created_at, type: "income", label: `Income #${i.number}`, name: i.category || "Uncategorized", total: i.amount, paid: i.amount, moneyIn: i.amount, moneyOut: 0, href: "/income" });
  return out;
}
function extraMovements(bid: string, from: string, to: string): Tx[] {
  const out: Tx[] = [];
  for (const t of all<{ id: string; date: string; created_at: string; amount: number; fname: string | null; tname: string | null }>(
    `SELECT t.id, t.date, t.created_at, t.amount, fa.name fname, ta.name tname FROM transfers t
     LEFT JOIN accounts fa ON fa.id=t.from_account_id LEFT JOIN accounts ta ON ta.id=t.to_account_id
     WHERE t.business_id=? AND t.date>=? AND t.date<=?`, [bid, from, to]))
    out.push({ id: "t" + t.id, date: t.date, created: t.created_at, type: "transfer", label: "Transfer Balance", name: `${t.fname || "?"} → ${t.tname || "?"}`, total: t.amount, paid: t.amount, moneyIn: 0, moneyOut: 0 });
  for (const a of all<{ id: string; kind: string; date: string; created_at: string; amount: number; aname: string | null; note: string | null }>(
    `SELECT a.id, a.kind, a.date, a.created_at, a.amount, ac.name aname, a.note FROM account_adjustments a LEFT JOIN accounts ac ON ac.id=a.account_id
     WHERE a.business_id=? AND a.date>=? AND a.date<=?`, [bid, from, to])) {
    const add = a.kind === "add";
    out.push({ id: "a" + a.id, date: a.date, created: a.created_at, type: add ? "add_money" : "reduce_money", label: add ? "Add Money" : "Reduce Money", name: a.aname || "--", total: a.amount, paid: a.amount, moneyIn: add ? a.amount : 0, moneyOut: add ? 0 : a.amount });
  }
  return out;
}

function dayBook(bid: string, sp: SP): Report {
  const date = resolveRange(sp, "today");
  const list = [...transactions(bid, date.from, date.to), ...extraMovements(bid, date.from, date.to)];
  const mi = list.reduce((a, t) => a + t.moneyIn, 0), mo = list.reduce((a, t) => a + t.moneyOut, 0);
  return {
    type: "day-book", title: "Day Book", fileTitle: "Day Book", date, filters: [],
    kpis: [
      { v: `${list.length} Entries`, l: "Total Transactions" },
      { v: tk(mi), l: "Total Money In", tone: "pos" },
      { v: tk(mo), l: "Total Money Out", tone: "neg" },
      { v: tk(mi - mo), l: "Net Cash Flow", tone: mi - mo >= 0 ? "pos" : "neg" },
    ],
    cols: [
      { key: "date", label: "Date", kind: "date" }, { key: "tx", label: "Transaction" }, { key: "name", label: "Name" },
      { key: "total", label: "Total", kind: "money" }, { key: "in", label: "Money In", kind: "money", total: true, tone: "pos" },
      { key: "out", label: "Money Out", kind: "money", total: true, tone: "neg" },
    ],
    rows: list.map((t) => ({ id: t.id, href: t.href, c: { date: t.date, tx: t.label, name: t.name, total: t.total, in: t.moneyIn || null, out: t.moneyOut || null }, sort: { d: t.date + t.created, a: t.total, n: t.name } })),
    totals: true, sortOptions: DOC_SORT.slice(0, 2), defaultSort: "oldest", searchable: "Search transactions…",
    empty: { title: "No Transactions Found", text: "Nothing was recorded on this day. Pick another date to see its transactions.", icon: "calendar" },
  };
}

const TTYPE_OPTS = [
  { v: "all", l: "All Transactions" }, { v: "sales_invoice", l: "Sales" }, { v: "purchase_bill", l: "Purchase" },
  { v: "payment_in", l: "Payment In" }, { v: "payment_out", l: "Payment Out" }, { v: "sales_return", l: "Sales Return" },
  { v: "purchase_return", l: "Purchase Return" }, { v: "expense", l: "Expense" }, { v: "income", l: "Income" },
];
function allTransactions(bid: string, sp: SP): Report {
  const date = resolveRange(sp, "month");
  const ttype = TTYPE_OPTS.some((o) => o.v === sp.ttype) ? sp.ttype! : "all";
  const listAll = transactions(bid, date.from, date.to);
  const list = ttype === "all" ? listAll : listAll.filter((t) => t.type === ttype);
  const sum = (k: string) => listAll.filter((t) => t.type === k).reduce((a, t) => a + t.total, 0);
  return {
    type: "all-transactions", title: "All Transactions", fileTitle: "All Transactions Report", date,
    filters: [{ kind: "select", param: "ttype", value: ttype, options: TTYPE_OPTS }],
    kpis: [
      { v: tk(sum("sales_invoice")), l: "Total Sales" }, { v: tk(sum("purchase_bill")), l: "Total Purchases" },
      { v: tk(sum("payment_in")), l: "Payments In", tone: "pos" }, { v: tk(sum("payment_out")), l: "Payments Out", tone: "neg" },
      { v: tk(sum("income")), l: "Income", tone: "pos" }, { v: tk(sum("expense")), l: "Expense", tone: "neg" },
    ],
    cols: [
      { key: "date", label: "Date", kind: "date" }, { key: "tx", label: "Transaction Type" }, { key: "name", label: "Name" },
      { key: "total", label: "Total", kind: "money" }, { key: "paid", label: "Received/Paid", kind: "money" }, { key: "bal", label: "Balance", kind: "money" },
    ],
    rows: list.map((t) => ({ id: t.id, href: t.href, c: { date: t.date, tx: t.label, name: t.name, total: t.total, paid: t.paid, bal: r2(t.total - t.paid) }, tone: t.total - t.paid > 0.009 ? { bal: "neg" } : undefined, sort: { d: t.date + t.created, a: t.total, n: t.name } })),
    sortOptions: DOC_SORT, defaultSort: "latest", searchable: "Search transactions…",
    empty: { title: "No Transactions Found", text: "No transactions match this period and type." },
  };
}

/* ---------- Stock at a date (opening stock counts from the beginning) ---------- */
function stockMoves(bid: string, from: string, to: string) {
  // per item: qty before `from`, qty in / out within [from, to]
  const m: Record<string, { before: number; inQ: number; outQ: number }> = {};
  const g = (id: string) => (m[id] ||= { before: 0, inQ: 0, outQ: 0 });
  for (const r of all<{ item_id: string; kind: string; b: number; w: number }>(
    `SELECT di.item_id, d.kind, SUM(CASE WHEN d.date < ? THEN di.qty ELSE 0 END) b,
       SUM(CASE WHEN d.date >= ? AND d.date <= ? THEN di.qty ELSE 0 END) w
     FROM doc_items di JOIN documents d ON d.id=di.document_id
     WHERE d.business_id=? AND di.item_id IS NOT NULL AND d.kind IN ('sales_invoice','purchase_bill','sales_return','purchase_return')
     GROUP BY di.item_id, d.kind`, [from, from, to, bid])) {
    const sign = r.kind === "purchase_bill" || r.kind === "sales_return" ? 1 : -1;
    const x = g(r.item_id);
    x.before += sign * r.b;
    if (sign > 0) x.inQ += r.w; else x.outQ += r.w;
  }
  for (const a of all<{ item_id: string; b: number; pin: number; pout: number }>(
    `SELECT item_id, SUM(CASE WHEN date < ? THEN qty_delta ELSE 0 END) b,
       SUM(CASE WHEN date >= ? AND date <= ? AND qty_delta > 0 THEN qty_delta ELSE 0 END) pin,
       SUM(CASE WHEN date >= ? AND date <= ? AND qty_delta < 0 THEN -qty_delta ELSE 0 END) pout
     FROM stock_adjustments WHERE business_id=? GROUP BY item_id`, [from, from, to, from, to, bid])) {
    const x = g(a.item_id);
    x.before += a.b; x.inQ += a.pin; x.outQ += a.pout;
  }
  return m;
}

/* ---------- Profit & Loss ---------- */
function profitLoss(bid: string, sp: SP): Report {
  const date = resolveRange(sp, "month");
  const stockBased = sp.stock === "1";
  const lineSum = (kind: string) => get<{ s: number }>(
    `SELECT COALESCE(SUM(di.amount),0) s FROM doc_items di JOIN documents d ON d.id=di.document_id
     WHERE d.business_id=? AND d.kind=? AND d.date>=? AND d.date<=?`, [bid, kind, date.from, date.to])?.s ?? 0;
  const salesLines = lineSum("sales_invoice"), returnLines = lineSum("sales_return");
  const netSales = salesLines - returnLines;

  let cogs = 0;
  const cogsChildren: RRow[] = [];
  if (!stockBased) {
    const costOf = (kind: string) => get<{ s: number }>(
      `SELECT COALESCE(SUM(di.qty*i.purchase_price),0) s FROM doc_items di JOIN documents d ON d.id=di.document_id JOIN items i ON i.id=di.item_id
       WHERE d.business_id=? AND d.kind=? AND d.date>=? AND d.date<=?`, [bid, kind, date.from, date.to])?.s ?? 0;
    const sold = costOf("sales_invoice"), ret = costOf("sales_return");
    cogs = sold - ret;
    cogsChildren.push({ id: "c1", c: { p: "Cost of items sold (qty × purchase price)", a: r2(sold) } });
    if (ret) cogsChildren.push({ id: "c2", c: { p: "Less: cost of items returned", a: -r2(ret) } });
  } else {
    const items = all<{ id: string; opening_stock: number; purchase_price: number }>("SELECT id, opening_stock, purchase_price FROM items WHERE business_id=?", [bid]);
    const mv = stockMoves(bid, date.from, date.to);
    let open = 0, close = 0;
    for (const it of items) {
      const x = mv[it.id] || { before: 0, inQ: 0, outQ: 0 };
      const o = (it.opening_stock || 0) + x.before;
      open += o * it.purchase_price;
      close += (o + x.inQ - x.outQ) * it.purchase_price;
    }
    const purchases = lineSum("purchase_bill") - lineSum("purchase_return");
    cogs = open + purchases - close;
    cogsChildren.push(
      { id: "c1", c: { p: "Opening stock value", a: r2(open) } },
      { id: "c2", c: { p: "Add: net purchases", a: r2(purchases) } },
      { id: "c3", c: { p: "Less: closing stock value", a: -r2(close) } },
    );
  }
  const gross = netSales - cogs;

  const docAgg = get<{ ch: number; dd: number; ro: number }>(
    `SELECT COALESCE(SUM((SELECT COALESCE(SUM(json_extract(value,'$.amount')),0) FROM json_each(COALESCE(d.charges,'[]')))),0) ch,
       COALESCE(SUM(d.doc_discount),0) dd, COALESCE(SUM(d.round_off),0) ro
     FROM documents d WHERE d.business_id=? AND d.kind='sales_invoice' AND d.date>=? AND d.date<=?`, [bid, date.from, date.to]) || { ch: 0, dd: 0, ro: 0 };
  const incCats = all<{ category: string | null; s: number }>("SELECT category, SUM(amount) s FROM incomes WHERE business_id=? AND date>=? AND date<=? GROUP BY category ORDER BY s DESC", [bid, date.from, date.to]);
  const incChildren: RRow[] = [
    ...incCats.map((c, i) => ({ id: "i" + i, c: { p: c.category || "Uncategorized", a: r2(c.s) } as Record<string, Cell> })),
    ...(docAgg.ch ? [{ id: "ich", c: { p: "Additional charges on invoices", a: r2(docAgg.ch) } }] : []),
    ...(docAgg.dd ? [{ id: "idd", c: { p: "Less: bill discounts allowed", a: -r2(docAgg.dd) } }] : []),
    ...(docAgg.ro ? [{ id: "iro", c: { p: "Round off", a: r2(docAgg.ro) } }] : []),
  ];
  const otherIncome = incCats.reduce((a, c) => a + c.s, 0) + docAgg.ch - docAgg.dd + docAgg.ro;
  const expCats = all<{ category: string | null; s: number }>("SELECT category, SUM(amount) s FROM expenses WHERE business_id=? AND date>=? AND date<=? GROUP BY category ORDER BY s DESC", [bid, date.from, date.to]);
  const expenses = expCats.reduce((a, c) => a + c.s, 0);
  const net = gross + otherIncome - expenses;

  return {
    type: "profit-and-loss", title: "Profit And Loss", fileTitle: "Profit And Loss Report", date, compact: true,
    filters: [{ kind: "switch", param: "stock", value: stockBased, label: "Show Stock-Based Profit" }],
    kpis: [
      { v: tk(netSales), l: "Net Sales" }, { v: tk(gross), l: "Gross Profit", tone: gross >= 0 ? "pos" : "neg" },
      { v: tk(expenses), l: "Net Expenses", tone: "neg" }, { v: tk(net), l: "Net Profit", tone: net >= 0 ? "pos" : "neg" },
    ],
    cols: [{ key: "p", label: "Particulars" }, { key: "a", label: "Amount", kind: "money" }],
    rows: [
      { id: "ns", c: { p: "Net Sales (+)", a: r2(netSales) }, children: [
        { id: "ns1", c: { p: "Sales (item amounts after item discount)", a: r2(salesLines) } },
        ...(returnLines ? [{ id: "ns2", c: { p: "Less: sales returns", a: -r2(returnLines) } }] : []),
      ] },
      { id: "cg", c: { p: "Cost of Goods Sold (−)", a: r2(cogs) }, children: cogsChildren },
      { id: "gp", c: { p: "Gross Profit", a: r2(gross) }, variant: "green" },
      { id: "oi", c: { p: "Other Net Income (+)", a: r2(otherIncome) }, children: incChildren.length ? incChildren : [{ id: "i-", c: { p: "No other income in this period", a: 0 } }] },
      { id: "ex", c: { p: "Net Expenses (−)", a: r2(expenses) }, children: expCats.length ? expCats.map((c, i) => ({ id: "e" + i, c: { p: c.category || "Uncategorized", a: r2(c.s) } })) : [{ id: "e-", c: { p: "No expenses in this period", a: 0 } }] },
      { id: "np", c: { p: "Net Profit", a: r2(net) }, variant: "green" },
    ],
    note: stockBased
      ? "Stock-based: Cost of Goods Sold = opening stock value + net purchases − closing stock value (all at current purchase price)."
      : "Net Sales = item amounts on sales invoices (after item discounts) minus sales returns. Bill-level discounts, additional charges and round-off are shown under Other Net Income, so Net Profit reconciles with invoice totals. Cost of Goods Sold = quantity sold × item purchase price.",
  };
}

/* ---------- Party Statement ---------- */
function partyStatement(bid: string, sp: SP): Report {
  const date = resolveRange(sp, "month");
  const opts = partyOptions(bid);
  const pid = sp.party || sp.partyId || null;
  const party = pid ? get<{ id: string; name: string; phone: string | null }>("SELECT id, name, phone FROM parties WHERE id=? AND business_id=?", [pid, bid]) : undefined;
  const view = sp.view === "accounting" ? "accounting" : "normal";
  const withItems = sp.items === "1";
  const base: Report = {
    type: "party-statement", title: "Party Statement", fileTitle: party ? `Party Statement - ${party.name}` : "Party Statement", date,
    filters: [
      { kind: "picker", param: "party", value: party?.id || null, placeholder: "Select Party", options: opts, width: 260 },
      { kind: "check", param: "items", value: withItems, label: "PDF With Item" },
      { kind: "seg", param: "view", value: view, options: [{ v: "normal", l: "Normal View" }, { v: "accounting", l: "Accounting View" }] },
    ],
    kpis: [], cols: [], rows: [],
    empty: { title: "Party Not Selected", text: "Select a party above to see their statement for the chosen period.", icon: "user" },
  };
  if (!party) return base;

  const ledger = partyLedger(bid, party.id);
  // Normal view: fold "received with invoice" payments into their document row
  type L = { key: string; date: string; label: string; debit: number; credit: number; balance: number; href?: string; ref: string | null; refKind: string | null; type: string; remarks: string | null };
  let rows: L[] = ledger.map((r) => ({ key: r.key, date: r.date, label: r.label, debit: r.debit, credit: r.credit, balance: r.balance, href: refHref(r.refKind, r.ref), ref: r.ref, refKind: r.refKind, type: r.type, remarks: r.remarks }));
  if (view === "normal") {
    const folded: L[] = [];
    for (const r of rows) {
      const isAuto = r.refKind === "doc" && (r.label === "Received with invoice" || r.label === "Paid with bill");
      const host = isAuto ? [...folded].reverse().find((f) => f.refKind === "doc" && f.ref === r.ref && f.date === r.date && f.type !== "payment_in" && f.type !== "payment_out") : undefined;
      if (host) { host.debit += r.debit; host.credit += r.credit; host.balance = r.balance; continue; }
      folded.push({ ...r });
    }
    rows = folded;
  }
  const before = rows.filter((r) => r.date < date.from);
  const inRange = rows.filter((r) => r.date >= date.from && r.date <= date.to);
  const bf = before.length ? before[before.length - 1].balance : 0;
  const closing = inRange.length ? inRange[inRange.length - 1].balance : bf;
  const debit = inRange.reduce((a, r) => a + r.debit, 0), credit = inRange.reduce((a, r) => a + r.credit, 0);

  const itemsByDoc: Record<string, { name: string; qty: number; unit: string | null; rate: number; amount: number }[]> = {};
  if (withItems) {
    const ids = inRange.filter((r) => r.refKind === "doc" && r.type !== "payment_in" && r.type !== "payment_out").map((r) => r.ref!);
    if (ids.length) for (const it of all<{ document_id: string; name: string; qty: number; unit: string | null; rate: number; amount: number }>(
      `SELECT document_id, name, qty, unit, rate, amount FROM doc_items WHERE document_id IN (${ids.map(() => "?").join(",")}) ORDER BY rowid`, ids))
      (itemsByDoc[it.document_id] ||= []).push(it);
  }
  const balSuffix = (b: number) => (view === "accounting" ? (b > 0 ? " Dr" : b < 0 ? " Cr" : "") : "");
  const out: RRow[] = [];
  if (before.length) out.push({ id: "bf", variant: "bf", c: { date: date.from, tx: "Balance B/F", debit: null, credit: null, bal: Math.abs(bf) }, suffix: { bal: balSuffix(bf) }, tone: { bal: bf > 0 ? "pos" : bf < 0 ? "neg" : "pos" } });
  for (const r of inRange) {
    out.push({ id: r.key, href: r.href, c: { date: r.date, tx: r.label, debit: r.debit || null, credit: r.credit || null, bal: Math.abs(r.balance) }, sub: r.remarks ? { tx: r.remarks } : undefined, suffix: { bal: balSuffix(r.balance) }, tone: { bal: r.balance > 0 ? "pos" : r.balance < 0 ? "neg" : "pos" } });
    if (withItems && r.ref && itemsByDoc[r.ref] && r.type !== "payment_in" && r.type !== "payment_out")
      for (const [i, it] of itemsByDoc[r.ref].entries())
        out.push({ id: r.key + "-i" + i, variant: "item", c: { date: "", tx: `${it.name} — ${fq(it.qty)}${it.unit ? " " + it.unit : ""} × ${tk(it.rate)} = ${tk(it.amount)}`, debit: null, credit: null, bal: null } });
  }
  return {
    ...base,
    kpis: [
      { v: tk(Math.abs(closing)), l: closing > 0 ? "Net Balance (To Receive)" : closing < 0 ? "Net Balance (To Give)" : "Net Balance (Settled)", tone: closing > 0 ? "pos" : closing < 0 ? "neg" : undefined },
      { v: tk(debit), l: "Total Debit" }, { v: tk(credit), l: "Total Credit" }, { v: String(inRange.length), l: "Total Entries" },
    ],
    cols: [
      { key: "date", label: "Date", kind: "date" }, { key: "tx", label: "Transaction" },
      { key: "debit", label: "Debit", kind: "money", total: true }, { key: "credit", label: "Credit", kind: "money", total: true },
      { key: "bal", label: "Running Balance", kind: "money" },
    ],
    rows: out, totals: true,
    empty: { title: "No Transactions Found", text: `${party.name} has no transactions in this period.` },
    note: "Debit = amount the party owes you more (sales, payments you made). Credit = amount the party owes you less (purchases, payments received). Green balance = To Receive, red = To Give.",
  };
}

/* ---------- All Party ---------- */
function allParty(bid: string, sp: SP): Report {
  const bal = partyBalances(bid);
  const ptype = ["customer", "supplier"].includes(sp.ptype || "") ? sp.ptype! : "all";
  const pay = ["receivable", "payable", "settled"].includes(sp.pay || "") ? sp.pay! : "all";
  let parties = all<{ id: string; name: string; phone: string | null; type: string; category: string | null }>(
    "SELECT id, name, phone, type, category FROM parties WHERE business_id=? ORDER BY name COLLATE NOCASE", [bid]);
  const everyRecv = parties.reduce((a, p) => a + Math.max(bal[p.id] || 0, 0), 0);
  const everyPay = parties.reduce((a, p) => a + Math.max(-(bal[p.id] || 0), 0), 0);
  if (ptype !== "all") parties = parties.filter((p) => p.type === ptype || p.type === "both");
  if (pay !== "all") parties = parties.filter((p) => { const b = r2(bal[p.id] || 0); return pay === "receivable" ? b > 0 : pay === "payable" ? b < 0 : b === 0; });
  const recv = parties.reduce((a, p) => a + Math.max(bal[p.id] || 0, 0), 0);
  const payable = parties.reduce((a, p) => a + Math.max(-(bal[p.id] || 0), 0), 0);
  return {
    type: "all-party", title: "All Party Report", fileTitle: "All Party Report", date: null,
    filters: [
      { kind: "select", param: "ptype", value: ptype, options: [{ v: "all", l: "All Party" }, { v: "customer", l: "Customer" }, { v: "supplier", l: "Supplier" }] },
      { kind: "select", param: "pay", value: pay, options: [{ v: "all", l: "All Payment" }, { v: "receivable", l: "To Receive" }, { v: "payable", l: "To Give" }, { v: "settled", l: "Settled" }] },
    ],
    kpis: [
      { v: `${parties.length} Parties`, l: "Total Parties" },
      { v: tk(r2(recv)), l: "Total Receivable", tone: "pos" },
      { v: tk(r2(payable)), l: "Total Payable", tone: "neg" },
      { v: tk(r2(everyRecv - everyPay)), l: "Net Balance (all parties)" },
    ],
    cols: [
      { key: "name", label: "Party Name" }, { key: "contact", label: "Contact" },
      { key: "recv", label: "Receivable", kind: "money", total: true, tone: "pos" }, { key: "pay", label: "Payable", kind: "money", total: true, tone: "neg" },
    ],
    rows: parties.map((p) => { const b = r2(bal[p.id] || 0); return { id: p.id, href: `/parties/${p.id}`, c: { name: p.name, contact: p.phone || "---", recv: b > 0 ? b : null, pay: b < 0 ? -b : null }, sub: p.category ? { name: p.category } : undefined, sort: { n: p.name, a: Math.abs(b) } }; }),
    totals: true, searchable: "Search parties…",
    sortOptions: [{ v: "name_az", l: "Name A → Z" }, { v: "name_za", l: "Name Z → A" }, { v: "amount_desc", l: "Balance High → Low" }, { v: "amount_asc", l: "Balance Low → High" }],
    defaultSort: "name_az",
    empty: { title: "No Parties Found", text: "No party matches these filters." },
  };
}

/* ---------- Inventory ---------- */
type ItemRow = { id: string; name: string; category: string | null; unit: string | null; sales_price: number; purchase_price: number; mrp_price: number; wholesale_price: number; low_stock_alert: number; opening_stock: number; type: string; code: string | null };
const itemsOf = (bid: string) => all<ItemRow>("SELECT id, name, category, unit, sales_price, purchase_price, mrp_price, wholesale_price, low_stock_alert, opening_stock, type, code FROM items WHERE business_id=? ORDER BY name COLLATE NOCASE", [bid]);
function catFilter(items: ItemRow[], value: string): Filter {
  const cats = [...new Set(items.map((i) => i.category || "General"))].sort();
  return { kind: "select", param: "cat", value, options: [{ v: "all", l: "All Categories" }, ...cats.map((c) => ({ v: c, l: c }))] };
}
const ITEM_SORT = [{ v: "name_az", l: "Name A → Z" }, { v: "name_za", l: "Name Z → A" }, { v: "qty_desc", l: "Quantity High → Low" }, { v: "qty_asc", l: "Quantity Low → High" }];

function itemDetail(bid: string, sp: SP): Report {
  const date = resolveRange(sp, "month");
  const items = itemsOf(bid);
  const stocks = itemStocks(bid);
  const opts: PickOpt[] = items.map((i) => { const s = stocks[i.id] || 0; return { id: i.id, label: i.name, sub: i.category || undefined, right: `${fq(s)} ${i.unit || ""}`.trim(), rightTone: s < 0 ? "neg" : undefined }; });
  const it = items.find((i) => i.id === (sp.item || sp.itemId));
  const base: Report = {
    type: "item-detail", title: "Item Details Report", fileTitle: it ? `Item Details Report - ${it.name}` : "Item Details Report", date,
    filters: [{ kind: "picker", param: "item", value: it?.id || null, placeholder: "Select Item", options: opts, width: 260 }],
    kpis: [], cols: [], rows: [],
    empty: { title: "Item Not Selected", text: "Select an item above to see its stock activity.", icon: "box" },
  };
  if (!it) return base;
  const act = itemActivity(bid, it.id);
  const before = act.filter((a) => a.date < date.from);
  const inRange = act.filter((a) => a.date >= date.from && a.date <= date.to);
  const open = before.length ? before[before.length - 1].qty : 0;
  const inQ = inRange.filter((a) => a.change > 0).reduce((s, a) => s + a.change, 0);
  const outQ = inRange.filter((a) => a.change < 0).reduce((s, a) => s - a.change, 0);
  const close = open + inQ - outQ;
  const u = it.unit || "";
  const rows: RRow[] = [];
  if (before.length) rows.push({ id: "bf", variant: "bf", c: { date: date.from, tx: "Opening Quantity (B/F)", party: "", in: null, out: null, qty: open }, suffix: { qty: " " + u } });
  for (const a of inRange) rows.push({
    id: a.key, href: a.ref ? `/doc/${a.ref}` : undefined,
    c: { date: a.date, tx: a.label, party: a.party || "--", in: a.change > 0 ? a.change : null, out: a.change < 0 ? -a.change : null, qty: a.qty },
    sub: a.remarks ? { tx: a.remarks } : undefined, tone: a.qty < 0 ? { qty: "neg" } : undefined, suffix: { qty: " " + u },
  });
  return {
    ...base,
    kpis: [
      { v: `${fq(open)} ${u}`, l: "Opening Quantity" }, { v: `${fq(inQ)} ${u}`, l: "Quantity In", tone: "pos" },
      { v: `${fq(outQ)} ${u}`, l: "Quantity Out", tone: "neg" }, { v: `${fq(close)} ${u}`, l: "Closing Quantity", tone: close < 0 ? "neg" : undefined },
      { v: tk(r2(close * it.purchase_price)), l: "Closing Stock Value" },
    ],
    cols: [
      { key: "date", label: "Date", kind: "date" }, { key: "tx", label: "Transaction" }, { key: "party", label: "Party" },
      { key: "in", label: "Quantity In", kind: "qty", total: true, tone: "pos" }, { key: "out", label: "Quantity Out", kind: "qty", total: true, tone: "neg" },
      { key: "qty", label: "Running Quantity", kind: "qty" },
    ],
    rows, totals: true,
    empty: { title: "No Activity Found", text: `${it.name} has no stock movement in this period.` },
  };
}

function itemList(bid: string, sp: SP): Report {
  let items = itemsOf(bid);
  const stocks = itemStocks(bid);
  const cat = sp.cat || "all";
  const f = catFilter(items, cat);
  if (cat !== "all") items = items.filter((i) => (i.category || "General") === cat);
  const value = items.reduce((a, i) => a + (stocks[i.id] || 0) * i.purchase_price, 0);
  return {
    type: "item-list", title: "Item List Report", fileTitle: "Item List Report", date: null, filters: [f],
    kpis: [
      { v: `${items.length} Items`, l: "Total Items" },
      { v: tk(r2(value)), l: "Stock Value (purchase price)" },
      { v: tk(r2(items.reduce((a, i) => a + Math.max(stocks[i.id] || 0, 0) * i.sales_price, 0))), l: "Stock Value (sales price)" },
      { v: String(items.filter((i) => (stocks[i.id] || 0) <= 0 && i.type !== "Service").length), l: "Out of Stock Items", tone: "neg" },
    ],
    cols: [
      { key: "name", label: "Item Name" }, { key: "cat", label: "Category" }, { key: "sp", label: "Sales Price", kind: "money" },
      { key: "pp", label: "Purchase Price", kind: "money" }, { key: "mrp", label: "MRP", kind: "money" }, { key: "wp", label: "Wholesale Price", kind: "money" },
      { key: "stock", label: "Stock", kind: "qty" },
    ],
    rows: items.map((i) => { const s = stocks[i.id] || 0; return { id: i.id, href: `/inventory/${i.id}`, c: { name: i.name, cat: i.category || "General", sp: i.sales_price, pp: i.purchase_price, mrp: i.mrp_price || null, wp: i.wholesale_price || null, stock: s }, suffix: { stock: i.unit ? " " + i.unit : "" }, sub: i.code ? { name: i.code } : undefined, tone: s < 0 ? { stock: "neg" } : undefined, sort: { n: i.name, q: s } }; }),
    sortOptions: ITEM_SORT, defaultSort: "name_az", searchable: "Search items…",
    empty: { title: "No Items Found", text: "Add items in Inventory to see them here." },
  };
}

function lowStock(bid: string, sp: SP): Report {
  const all_ = itemsOf(bid).filter((i) => i.type !== "Service");
  const stocks = itemStocks(bid);
  const cat = sp.cat || "all";
  const f = catFilter(all_, cat);
  let items = all_.filter((i) => { const s = stocks[i.id] || 0; return s <= 0 || (i.low_stock_alert > 0 && s <= i.low_stock_alert); });
  if (cat !== "all") items = items.filter((i) => (i.category || "General") === cat);
  const out = items.filter((i) => (stocks[i.id] || 0) <= 0).length;
  return {
    type: "low-stock-summary", title: "Low Stock Summary Report", fileTitle: "Low Stock Summary Report", date: null, filters: [f],
    kpis: [
      { v: `${items.length} Items`, l: "Low Stock Items" },
      { v: String(out), l: "Out of Stock (≤ 0)", tone: "neg" },
      { v: String(items.length - out), l: "Below Low Stock Level" },
    ],
    cols: [
      { key: "name", label: "Item Name" }, { key: "cat", label: "Category" }, { key: "alert", label: "Low Stock Level", kind: "qty" },
      { key: "stock", label: "Stock Quantity", kind: "qty" }, { key: "val", label: "Stock Value", kind: "money", total: true },
    ],
    rows: items.map((i) => { const s = stocks[i.id] || 0; return { id: i.id, href: `/inventory/${i.id}`, c: { name: i.name, cat: i.category || "General", alert: i.low_stock_alert, stock: s, val: r2(s * i.purchase_price) }, suffix: { stock: i.unit ? " " + i.unit : "" }, tone: { stock: "neg" }, sort: { n: i.name, q: s } }; }),
    totals: true, sortOptions: ITEM_SORT, defaultSort: "qty_asc", searchable: "Search items…",
    empty: { title: "All Stocked Up", text: "No item is at or below its low stock level.", icon: "check" },
  };
}

function stockQuantity(bid: string, sp: SP): Report {
  const date = resolveRange(sp, "month");
  const all_ = itemsOf(bid).filter((i) => i.type !== "Service");
  const cat = sp.cat || "all";
  const f = catFilter(all_, cat);
  const items = cat === "all" ? all_ : all_.filter((i) => (i.category || "General") === cat);
  const mv = stockMoves(bid, date.from, date.to);
  const rows = items.map((i) => {
    const x = mv[i.id] || { before: 0, inQ: 0, outQ: 0 };
    const open = (i.opening_stock || 0) + x.before;
    const close = open + x.inQ - x.outQ;
    return { id: i.id, href: `/inventory/${i.id}`, c: { name: i.name, open: r2(open), unit: i.unit || "", inQ: r2(x.inQ), outQ: r2(x.outQ), close: r2(close) }, tone: close < 0 ? { close: "neg" as const } : undefined, sort: { n: i.name, q: close } } as RRow;
  });
  const val = items.reduce((a, i) => { const x = mv[i.id] || { before: 0, inQ: 0, outQ: 0 }; return a + ((i.opening_stock || 0) + x.before + x.inQ - x.outQ) * i.purchase_price; }, 0);
  return {
    type: "stock-quantity", title: "Stock Quantity Report", fileTitle: "Stock Quantity Report", date, filters: [f],
    kpis: [
      { v: `${items.length} Items`, l: "Total Items" },
      { v: fq(rows.reduce((a, r) => a + Number(r.c.inQ), 0)), l: "Total Quantity In", tone: "pos" },
      { v: fq(rows.reduce((a, r) => a + Number(r.c.outQ), 0)), l: "Total Quantity Out", tone: "neg" },
      { v: tk(r2(val)), l: "Closing Stock Value" },
    ],
    cols: [
      { key: "name", label: "Item Name" }, { key: "open", label: "Opening Stock", kind: "qty" }, { key: "unit", label: "Unit" },
      { key: "inQ", label: "Quantity In", kind: "qty", total: true, tone: "pos" }, { key: "outQ", label: "Quantity Out", kind: "qty", total: true, tone: "neg" },
      { key: "close", label: "Closing Stock", kind: "qty" },
    ],
    rows, totals: true, sortOptions: ITEM_SORT, defaultSort: "name_az", searchable: "Search items…",
    empty: { title: "No Items Found", text: "Add items in Inventory to see their stock here." },
  };
}

/* ---------- Income & Expense ---------- */
function incomeExpense(bid: string, sp: SP): Report {
  const date = resolveRange(sp, "month");
  const side = ["income", "expense"].includes(sp.side || "") ? sp.side! : "all";
  const q = (tbl: string) => all<{ id: string; number: number; date: string; created_at: string; category: string | null; amount: number; note: string | null; aname: string | null }>(
    `SELECT e.id, e.number, e.date, e.created_at, e.category, e.amount, e.note, a.name aname FROM ${tbl} e LEFT JOIN accounts a ON a.id=e.account_id
     WHERE e.business_id=? AND e.date>=? AND e.date<=?`, [bid, date.from, date.to]);
  const inc = q("incomes"), exp = q("expenses");
  const ti = inc.reduce((a, r) => a + r.amount, 0), te = exp.reduce((a, r) => a + r.amount, 0);
  const rows: RRow[] = [
    ...(side !== "expense" ? inc.map((r) => ({ id: "i" + r.id, href: "/income", c: { date: r.date, tx: `Income #${r.number}`, cat: r.category || "Uncategorized", mode: r.aname || "--", inc: r.amount, exp: null }, sub: r.note ? { tx: r.note } : undefined, sort: { d: r.date + r.created_at, a: r.amount, n: r.category || "" } })) : []),
    ...(side !== "income" ? exp.map((r) => ({ id: "e" + r.id, href: "/expense", c: { date: r.date, tx: `Expense #${r.number}`, cat: r.category || "Uncategorized", mode: r.aname || "--", inc: null, exp: r.amount }, sub: r.note ? { tx: r.note } : undefined, sort: { d: r.date + r.created_at, a: r.amount, n: r.category || "" } })) : []),
  ];
  return {
    type: "income-expense", title: "Income Expense Report", fileTitle: "Income Expense Report", date,
    filters: [{ kind: "select", param: "side", value: side, options: [{ v: "all", l: "Income & Expense" }, { v: "income", l: "Income Only" }, { v: "expense", l: "Expense Only" }] }],
    kpis: [
      { v: tk(ti), l: `Total Income (${inc.length})`, tone: "pos" }, { v: tk(te), l: `Total Expense (${exp.length})`, tone: "neg" },
      { v: tk(ti - te), l: "Net (Income − Expense)", tone: ti - te >= 0 ? "pos" : "neg" },
    ],
    cols: [
      { key: "date", label: "Date", kind: "date" }, { key: "tx", label: "Transaction" }, { key: "cat", label: "Category" }, { key: "mode", label: "Payment Mode" },
      { key: "inc", label: "Income", kind: "money", total: true, tone: "pos" }, { key: "exp", label: "Expense", kind: "money", total: true, tone: "neg" },
    ],
    rows, totals: true, sortOptions: DOC_SORT, defaultSort: "latest", searchable: "Search income or expense…",
    empty: { title: "No Income or Expense Found", text: "Nothing was recorded in this period." },
  };
}

function categoryReport(bid: string, type: string, sp: SP): Report {
  const date = resolveRange(sp, "month");
  const isExp = type === "expense-category";
  const tbl = isExp ? "expenses" : "incomes";
  const rows = all<{ category: string | null; n: number; s: number }>(
    `SELECT category, COUNT(*) n, SUM(amount) s FROM ${tbl} WHERE business_id=? AND date>=? AND date<=? GROUP BY category ORDER BY s DESC`, [bid, date.from, date.to]);
  const total = rows.reduce((a, r) => a + r.s, 0);
  const word = isExp ? "Expense" : "Income";
  return {
    type, title: `${word} Category Report`, fileTitle: `${word} Category Report`, date, filters: [],
    kpis: [
      { v: `${rows.length} Categories`, l: `${word} Categories` },
      { v: String(rows.reduce((a, r) => a + r.n, 0)), l: "Total Transactions" },
      { v: tk(total), l: `Total ${word} Amount`, tone: isExp ? "neg" : "pos" },
    ],
    cols: [{ key: "cat", label: "Category" }, { key: "n", label: "Total Transactions", kind: "qty", total: true }, { key: "s", label: "Total Amount", kind: "money", total: true }, { key: "pct", label: "Share" }],
    rows: rows.map((r, i) => ({ id: "c" + i, href: isExp ? "/expense" : "/income", c: { cat: r.category || "Uncategorized", n: r.n, s: r.s, pct: total ? `${((r.s / total) * 100).toFixed(1)}%` : "--" }, sort: { n: r.category || "", a: r.s } })),
    totals: true, sortOptions: [{ v: "amount_desc", l: "Amount High → Low" }, { v: "amount_asc", l: "Amount Low → High" }, { v: "name_az", l: "Name A → Z" }], defaultSort: "amount_desc",
    empty: { title: `No ${word} Found`, text: `No ${word.toLowerCase()} was recorded in this period.` },
  };
}

/* ---------- Cash In Hand / Bank Statement ---------- */
function accountStatement(bid: string, type: string, sp: SP): Report {
  const date = resolveRange(sp, "month");
  const isCash = type === "cash-in-hand-statement";
  const accts = all<{ id: string; name: string; type: string; bank_name: string | null; account_no: string | null }>(
    "SELECT id, name, type, bank_name, account_no FROM accounts WHERE business_id=? ORDER BY created_at", [bid]);
  const list = accts.filter((a) => (isCash ? a.type === "cash" : a.type !== "cash"));
  const bals = accountBalances(bid);
  const want = sp.account || sp.accountId;
  const acc = list.find((a) => a.id === want) || (want ? undefined : list[0]);
  const title = isCash ? "Cash In Hand Statement" : "Bank Statement";
  const base: Report = {
    type, title, fileTitle: acc ? `${title} - ${acc.name}` : title, date,
    filters: [{ kind: "picker", param: "account", value: acc?.id || null, placeholder: isCash ? "Select Cash Account" : "Select Bank / Wallet", width: 240,
      options: list.map((a) => ({ id: a.id, label: a.name, sub: a.type === "cash" ? "Cash" : a.type === "bank" ? `Bank${a.account_no ? " · " + a.account_no : ""}` : "Wallet", right: tk(bals[a.id] || 0), rightTone: (bals[a.id] || 0) < 0 ? "neg" : "pos" })) }],
    kpis: [], cols: [], rows: [],
    empty: { title: "Account Not Selected", text: isCash ? "Select a cash account above." : "Select a bank or wallet account above.", icon: isCash ? "cash" : "bank" },
  };
  if (!acc) return base;
  const opening = get<{ opening_balance: number }>("SELECT opening_balance FROM accounts WHERE id=?", [acc.id])?.opening_balance || 0;
  const led = accountLedger(bid, acc.id);
  const before = led.filter((r) => r.date < date.from);
  const inRange = led.filter((r) => r.date >= date.from && r.date <= date.to);
  const bf = before.length ? before[before.length - 1].balance : opening;
  const closing = inRange.length ? inRange[inRange.length - 1].balance : bf;
  const mi = inRange.filter((r) => r.delta > 0).reduce((a, r) => a + r.delta, 0);
  const mo = inRange.filter((r) => r.delta < 0).reduce((a, r) => a - r.delta, 0);
  const rows: RRow[] = [{ id: "bf", variant: "bf", c: { date: date.key === "all" ? "" : date.from, part: "Balance B/F", no: "", notes: "", in: null, out: null, bal: r2(bf) }, tone: bf < 0 ? { bal: "neg" } : undefined }];
  for (const r of inRange) {
    const { particular, no } = splitLabel(r.label);
    rows.push({ id: r.key, href: refHref(r.refKind, r.ref), c: { date: r.date, part: particular, no, notes: r.remarks || "", in: r.delta > 0 ? r.delta : null, out: r.delta < 0 ? -r.delta : null, bal: r.balance }, sub: r.party ? { part: r.party } : undefined, tone: r.balance < 0 ? { bal: "neg" } : undefined });
  }
  return {
    ...base,
    kpis: [
      { v: tk(r2(bf)), l: "Opening Balance" }, { v: tk(r2(mi)), l: "Total Money In", tone: "pos" },
      { v: tk(r2(mo)), l: "Total Money Out", tone: "neg" }, { v: tk(r2(closing)), l: "Closing Balance", tone: closing < 0 ? "neg" : "pos" },
    ],
    cols: [
      { key: "date", label: "Date", kind: "date" }, { key: "part", label: "Particular" }, { key: "no", label: "Bill No" }, { key: "notes", label: "Notes/Remarks" },
      { key: "in", label: "Money In", kind: "money", total: true, tone: "pos" }, { key: "out", label: "Money Out", kind: "money", total: true, tone: "neg" },
      { key: "bal", label: "Balance", kind: "money" },
    ],
    rows, totals: true, searchable: "Search transactions…",
    empty: { title: "No Transactions Found", text: `No money moved through ${acc.name} in this period.` },
  };
}

/* ---------- Discount ---------- */
function discountReport(bid: string, sp: SP): Report {
  const date = resolveRange(sp, "month");
  const rows = all<{ pid: string | null; pname: string | null; sd: number; pd: number; n: number }>(
    `SELECT d.party_id pid, p.name pname,
       SUM(CASE WHEN d.kind='sales_invoice' THEN d.discount_total ELSE 0 END) sd,
       SUM(CASE WHEN d.kind='purchase_bill' THEN d.discount_total ELSE 0 END) pd, COUNT(*) n
     FROM documents d LEFT JOIN parties p ON p.id=d.party_id
     WHERE d.business_id=? AND d.date>=? AND d.date<=? AND d.kind IN ('sales_invoice','purchase_bill') AND d.discount_total>0
     GROUP BY d.party_id ORDER BY (sd+pd) DESC`, [bid, date.from, date.to]);
  const sd = rows.reduce((a, r) => a + r.sd, 0), pd = rows.reduce((a, r) => a + r.pd, 0);
  return {
    type: "discount", title: "Discount Report", fileTitle: "Discount Report", date, filters: [],
    kpis: [
      { v: `${rows.length} Parties`, l: "Parties With Discount" },
      { v: tk(r2(sd)), l: "Total Sales Discount", tone: "neg" }, { v: tk(r2(pd)), l: "Total Purchase Discount", tone: "pos" },
    ],
    cols: [{ key: "name", label: "Party Name" }, { key: "n", label: "Transactions", kind: "qty" }, { key: "sd", label: "Total Sales Discount", kind: "money", total: true }, { key: "pd", label: "Total Purchase Discount", kind: "money", total: true }],
    rows: rows.map((r, i) => ({ id: r.pid || "cash" + i, href: r.pid ? `/parties/${r.pid}` : undefined, c: { name: r.pname || "Cash Sale", n: r.n, sd: r2(r.sd) || null, pd: r2(r.pd) || null }, sort: { n: r.pname || "", a: r.sd + r.pd } })),
    totals: true, searchable: "Search parties…",
    sortOptions: [{ v: "amount_desc", l: "Discount High → Low" }, { v: "amount_asc", l: "Discount Low → High" }, { v: "name_az", l: "Name A → Z" }], defaultSort: "amount_desc",
    note: "Discount includes item discounts and bill-level discounts.",
    empty: { title: "No Discounts Found", text: "No discount was given or received in this period." },
  };
}

/* ---------- Tax ---------- */
function taxReport(bid: string, type: string, sp: SP): Report {
  const date = resolveRange(sp, "month");
  const sales = type === "tax-sales";
  const kind = sales ? "sales_invoice" : "purchase_bill";
  const docs = all<{ id: string; number: number; date: string; created_at: string; total: number; tax_total: number; pname: string | null }>(
    `SELECT d.id, d.number, d.date, d.created_at, d.total, d.tax_total, p.name pname FROM documents d LEFT JOIN parties p ON p.id=d.party_id
     WHERE d.business_id=? AND d.kind=? AND d.date>=? AND d.date<=? AND d.tax_total>0 ORDER BY d.date DESC`, [bid, kind, date.from, date.to]);
  const tax = docs.reduce((a, d) => a + d.tax_total, 0), total = docs.reduce((a, d) => a + d.total, 0);
  const w = sales ? "Sales" : "Purchase";
  return {
    type, title: `Tax ${w} Report`, fileTitle: `Tax ${w} Report`, date, filters: [],
    kpis: [{ v: `${docs.length} Entries`, l: `Taxed ${w}` }, { v: tk(r2(total - tax)), l: "Taxable Amount" }, { v: tk(r2(tax)), l: sales ? "Tax Collected" : "Tax Paid" }, { v: tk(r2(total)), l: "Total Amount" }],
    cols: [
      { key: "no", label: sales ? "Invoice No" : "Bill No" }, { key: "party", label: "Party Name" }, { key: "date", label: "Date", kind: "date" },
      { key: "taxable", label: "Taxable Amount", kind: "money", total: true }, { key: "tax", label: "Tax Amount", kind: "money", total: true }, { key: "total", label: "Total Amount", kind: "money", total: true },
    ],
    rows: docs.map((d) => ({ id: d.id, href: docHref(d.id), c: { no: `#${d.number}`, party: d.pname || "Cash Sale", date: d.date, taxable: r2(d.total - d.tax_total), tax: d.tax_total, total: d.total }, sort: { d: d.date + d.created_at, a: d.tax_total, n: d.pname || "" } })),
    totals: true, sortOptions: DOC_SORT, defaultSort: "latest", searchable: "Search…",
    empty: { title: "No Taxed Transactions", text: `No ${w.toLowerCase()} in this period had tax applied.`, icon: "percent" },
  };
}
