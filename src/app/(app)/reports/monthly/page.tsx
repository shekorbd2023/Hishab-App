import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { all, get } from "@/lib/db";
import { sumDocuments, sumExpenses, sumIncomes } from "@/lib/domain";
import { tk, qty, fmtDate, TODAY } from "@/lib/format";
import PrintButton from "./PrintButton";
import { Icon } from "@/components/ui";

export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthOf(y: number, m: number) {
  const d = new Date(Date.UTC(y, m, 1));
  const Y = d.getUTCFullYear(), M = d.getUTCMonth();
  return { y: Y, m: M, key: `${Y}-${String(M + 1).padStart(2, "0")}`, from: new Date(Date.UTC(Y, M, 1)).toISOString().slice(0, 10), to: new Date(Date.UTC(Y, M + 1, 0)).toISOString().slice(0, 10), label: `${MONTHS[M]} ${Y}` };
}
const cogs = (bid: string, kind: string, from: string, to: string) => get<{ s: number }>(
  `SELECT COALESCE(SUM(di.qty*i.purchase_price),0) s FROM doc_items di JOIN documents d ON d.id=di.document_id JOIN items i ON i.id=di.item_id
   WHERE d.business_id=? AND d.kind=? AND d.date>=? AND d.date<=?`, [bid, kind, from, to])?.s ?? 0;

export default async function MonthlyReport({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const sp = await searchParams;
  const [ty, tm] = (sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : TODAY().slice(0, 7)).split("-").map(Number);
  const cur = monthOf(ty, tm - 1), prev = monthOf(ty, tm - 2), next = monthOf(ty, tm);

  const revenue = sumDocuments(bid, "sales_invoice", cur.from, cur.to) - sumDocuments(bid, "sales_return", cur.from, cur.to);
  const prevRevenue = sumDocuments(bid, "sales_invoice", prev.from, prev.to) - sumDocuments(bid, "sales_return", prev.from, prev.to);
  const purchases = sumDocuments(bid, "purchase_bill", cur.from, cur.to) - sumDocuments(bid, "purchase_return", cur.from, cur.to);
  const cost = cogs(bid, "sales_invoice", cur.from, cur.to) - cogs(bid, "sales_return", cur.from, cur.to);
  const gross = revenue - cost;
  const expenses = sumExpenses(bid, cur.from, cur.to);
  const otherIncome = sumIncomes(bid, cur.from, cur.to);
  const net = gross - expenses + otherIncome;
  const growth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : revenue > 0 ? 100 : 0;
  const invoices = get<{ n: number }>("SELECT COUNT(*) n FROM documents WHERE business_id=? AND kind='sales_invoice' AND date>=? AND date<=?", [bid, cur.from, cur.to])?.n ?? 0;

  const topItems = all<{ name: string; qty: number; amt: number }>(
    `SELECT di.name, SUM(di.qty) qty, SUM(di.amount) amt FROM doc_items di JOIN documents d ON d.id=di.document_id
     WHERE d.business_id=? AND d.kind='sales_invoice' AND d.date>=? AND d.date<=? GROUP BY di.name ORDER BY amt DESC LIMIT 5`, [bid, cur.from, cur.to]);
  const topCustomers = all<{ id: string; name: string; n: number; amt: number }>(
    `SELECT p.id, p.name, COUNT(*) n, SUM(d.total) amt FROM documents d JOIN parties p ON p.id=d.party_id
     WHERE d.business_id=? AND d.kind='sales_invoice' AND d.date>=? AND d.date<=? GROUP BY p.id ORDER BY amt DESC LIMIT 5`, [bid, cur.from, cur.to]);
  const expenseBreak = all<{ category: string | null; s: number }>(
    "SELECT category, SUM(amount) s FROM expenses WHERE business_id=? AND date>=? AND date<=? GROUP BY category ORDER BY s DESC", [bid, cur.from, cur.to]);
  const moneyIn = get<{ s: number }>("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE business_id=? AND kind='in' AND date>=? AND date<=?", [bid, cur.from, cur.to])?.s ?? 0;
  const moneyOut = get<{ s: number }>("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE business_id=? AND kind='out' AND date>=? AND date<=?", [bid, cur.from, cur.to])?.s ?? 0;

  const narrative =
    `In ${cur.label}, ${ctx.business.name} made ${invoices} sale${invoices === 1 ? "" : "s"} worth ${tk(revenue)} (net of returns), which ${growth >= 0 ? "rose" : "fell"} ${Math.abs(growth).toFixed(1)}% versus ${prev.label}. ` +
    `Gross profit was ${tk(gross)} after ${tk(cost)} cost of goods sold; net profit came to ${tk(net)} after ${tk(expenses)} of expenses` +
    `${otherIncome ? ` and ${tk(otherIncome)} of other income` : ""}. ` +
    `${topItems[0] ? `The best-selling item was ${topItems[0].name}. ` : ""}` +
    `${topCustomers[0] ? `The top customer was ${topCustomers[0].name} (${tk(topCustomers[0].amt)}). ` : ""}` +
    `Cash collected from parties was ${tk(moneyIn)} against ${tk(moneyOut)} paid out.`;

  const kpis = [
    { l: "Sales (invoice totals, net of returns)", v: tk(revenue) }, { l: "Purchases", v: tk(purchases) },
    { l: "Cost of Goods Sold", v: tk(cost) }, { l: "Gross Profit", v: tk(gross), t: gross >= 0 ? "pos" : "neg" },
    { l: "Expenses", v: tk(expenses), t: "neg" }, { l: "Net Profit", v: tk(net), t: net >= 0 ? "pos" : "neg" },
    { l: `Growth vs ${MONTHS[prev.m].slice(0, 3)}`, v: `${growth >= 0 ? "↑" : "↓"} ${Math.abs(growth).toFixed(1)}%`, t: growth >= 0 ? "pos" : "neg" },
    { l: "Collected from Parties", v: tk(moneyIn), t: "pos" },
    { l: "Paid to Parties", v: tk(moneyOut) },
  ];
  const b = ctx.business;

  return (
    <div className="rv">
      <div className="page-head no-print">
        <div className="page-title">
          <Link href="/reports" className="back-btn" aria-label="Back to reports"><Icon name="back" size={18} /></Link>
          Monthly Business Analysis
        </div>
        <div className="row">
          <Link className="chip" href={`/reports/monthly?m=${prev.key}`}>‹ {MONTHS[prev.m].slice(0, 3)} {prev.y}</Link>
          <span className="chip on">{cur.label}</span>
          <Link className="chip" href={`/reports/monthly?m=${next.key}`}>{MONTHS[next.m].slice(0, 3)} {next.y} ›</Link>
          <PrintButton />
        </div>
      </div>

      <div className="rv-letterhead">
        <div className="row" style={{ gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.logo || "/logo.svg"} alt="" />
          <div><div className="rv-lh-name">{b.name}</div><div className="rv-lh-meta">{[b.phone, b.address].filter(Boolean).join(" · ")}</div></div>
        </div>
        <div style={{ textAlign: "right" }}><div className="rv-lh-title">Monthly Business Analysis</div><div className="rv-lh-meta">{fmtDate(cur.from)} - {fmtDate(cur.to)}</div></div>
      </div>

      <div className="rv-kpis mb-kpis">
        {kpis.map((k) => <div key={k.l} className="kpi"><div className={`v ${k.t || ""}`}>{k.v}</div><div className="l">{k.l}</div></div>)}
      </div>

      <div className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
        <div className="row" style={{ fontWeight: 700, marginBottom: ".4rem" }}>Summary for {cur.label}</div>
        <p style={{ lineHeight: 1.7, color: "var(--text)" }}>{narrative}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1rem" }}>
        <Section title="Top Selling Items" headers={["Item", "Qty Sold", "Amount"]} rows={topItems.map((t) => [t.name, qty(t.qty), tk(t.amt)])} />
        <Section title="Top Customers" headers={["Customer", "Invoices", "Amount"]} rows={topCustomers.map((t) => [t.name, String(t.n), tk(t.amt)])} />
        <Section title="Expenses by Category" headers={["Category", "Amount"]} rows={expenseBreak.map((e) => [e.category || "Uncategorized", tk(e.s)])} />
      </div>
      <div className="rv-printfoot">Generated by Hishab on {fmtDate(TODAY())}</div>
    </div>
  );
}

function Section({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="table-wrap rv-table">
      <div style={{ padding: ".75rem .85rem", fontWeight: 700, borderBottom: "1px solid var(--border)" }}>{title}</div>
      <table className="tbl">
        <thead><tr>{headers.map((h, i) => <th key={i} className={i > 0 ? "num" : ""}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j > 0 ? "num" : ""} style={j === 0 ? { whiteSpace: "normal" } : undefined}>{c}</td>)}</tr>)}
          {rows.length === 0 && <tr><td colSpan={headers.length} className="text-muted" style={{ textAlign: "center", padding: "1.5rem" }}>No data for this month.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
