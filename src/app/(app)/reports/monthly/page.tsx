import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { sumDocuments, sumExpenses, sumIncomes } from "@/lib/domain";
import { money } from "@/lib/util";
import Link from "next/link";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

function rangeFor(year: number, month: number) {
  const from = new Date(year, month, 1).toISOString().slice(0, 10);
  const to = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}
function cogs(bid: string, from: string, to: string) {
  return all<{ s: number }>(
    `SELECT COALESCE(SUM(di.qty*i.purchase_price),0) s FROM doc_items di
     JOIN documents d ON d.id=di.document_id JOIN items i ON i.id=di.item_id
     WHERE d.business_id=? AND d.kind='sales_invoice' AND d.date>=? AND d.date<=?`, [bid, from, to]
  )[0]?.s ?? 0;
}

export default async function MonthlyReport({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const sym = ctx.business.currency_symbol;
  const sp = await searchParams;

  const base = sp.m ? new Date(sp.m + "-01T00:00:00") : new Date();
  const y = base.getFullYear(), mo = base.getMonth();
  const cur = rangeFor(y, mo);
  const prev = rangeFor(mo === 0 ? y - 1 : y, mo === 0 ? 11 : mo - 1);
  const label = base.toLocaleString("en-US", { month: "long", year: "numeric" });
  const prevLabel = new Date(y, mo - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  const revenue = sumDocuments(bid, "sales_invoice", cur.from, cur.to) - sumDocuments(bid, "sales_return", cur.from, cur.to);
  const prevRevenue = sumDocuments(bid, "sales_invoice", prev.from, prev.to) - sumDocuments(bid, "sales_return", prev.from, prev.to);
  const cost = cogs(bid, cur.from, cur.to);
  const gross = revenue - cost;
  const expenses = sumExpenses(bid, cur.from, cur.to);
  const otherIncome = sumIncomes(bid, cur.from, cur.to);
  const net = gross - expenses + otherIncome;
  const growth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : revenue > 0 ? 100 : 0;

  const topItems = all<{ name: string; qty: number; amt: number }>(
    `SELECT di.name, SUM(di.qty) qty, SUM(di.amount) amt FROM doc_items di
     JOIN documents d ON d.id=di.document_id
     WHERE d.business_id=? AND d.kind='sales_invoice' AND d.date>=? AND d.date<=?
     GROUP BY di.name ORDER BY amt DESC LIMIT 5`, [bid, cur.from, cur.to]
  );
  const topCustomers = all<{ name: string; amt: number }>(
    `SELECT p.name, SUM(d.total) amt FROM documents d JOIN parties p ON p.id=d.party_id
     WHERE d.business_id=? AND d.kind='sales_invoice' AND d.date>=? AND d.date<=?
     GROUP BY p.id ORDER BY amt DESC LIMIT 5`, [bid, cur.from, cur.to]
  );
  const expenseBreak = all<{ category: string | null; s: number }>(
    `SELECT category, SUM(amount) s FROM expenses WHERE business_id=? AND date>=? AND date<=? GROUP BY category ORDER BY s DESC`, [bid, cur.from, cur.to]
  );
  const moneyIn = all<{ s: number }>(`SELECT COALESCE(SUM(amount),0) s FROM payments WHERE business_id=? AND kind='in' AND date>=? AND date<=?`, [bid, cur.from, cur.to])[0]?.s ?? 0;
  const moneyOut = all<{ s: number }>(`SELECT COALESCE(SUM(amount),0) s FROM payments WHERE business_id=? AND kind='out' AND date>=? AND date<=?`, [bid, cur.from, cur.to])[0]?.s ?? 0;

  const dir = growth >= 0 ? "rose" : "fell";
  const narrative =
    `In ${label}, ${ctx.business.name} recorded revenue of ${money(revenue, sym)}, which ${dir} ${Math.abs(growth).toFixed(1)}% versus ${prevLabel}. ` +
    `Gross profit was ${money(gross, sym)} after ${money(cost, sym)} cost of goods sold; net profit came to ${money(net, sym)} after ${money(expenses, sym)} of expenses` +
    `${otherIncome ? ` and ${money(otherIncome, sym)} of other income` : ""}. ` +
    `${topItems[0] ? `The best-selling item was ${topItems[0].name}. ` : ""}` +
    `${topCustomers[0] ? `The top customer was ${topCustomers[0].name} (${money(topCustomers[0].amt, sym)}). ` : ""}` +
    `Cash collected was ${money(moneyIn, sym)} against ${money(moneyOut, sym)} paid out.`;

  const prevMonthStr = new Date(y, mo - 1, 1).toISOString().slice(0, 7);
  const nextMonthStr = new Date(y, mo + 1, 1).toISOString().slice(0, 7);

  return (
    <div>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <Link href="/reports" className="btn" style={{ padding: ".3rem .6rem" }}>←</Link>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Monthly Business Report</h1>
        </div>
        <div style={{ display: "flex", gap: ".4rem" }}>
          <Link className="btn" href={`/reports/monthly?m=${prevMonthStr}`}>← Prev</Link>
          <Link className="btn" href={`/reports/monthly?m=${nextMonthStr}`}>Next →</Link>
          <PrintButton />
        </div>
      </div>

      <div className="card print-area" style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>{ctx.business.name} — {label}</h2>
        <p style={{ marginTop: ".75rem", lineHeight: 1.6 }}>{narrative}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: ".6rem", margin: "1.25rem 0" }}>
          {[
            { l: "Revenue", v: money(revenue, sym) }, { l: "COGS", v: money(cost, sym) },
            { l: "Gross Profit", v: money(gross, sym) }, { l: "Expenses", v: money(expenses, sym) },
            { l: "Net Profit", v: money(net, sym) }, { l: "MoM Growth", v: `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%` },
          ].map((c) => (
            <div key={c.l} className="card" style={{ padding: ".8rem" }}>
              <div className="text-muted" style={{ fontSize: ".78rem" }}>{c.l}</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{c.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Section title="Top Items" headers={["Item", "Qty", "Sales"]} rows={topItems.map((t) => [t.name, String(t.qty), money(t.amt, sym)])} />
          <Section title="Top Customers" headers={["Customer", "Sales"]} rows={topCustomers.map((t) => [t.name, money(t.amt, sym)])} />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <Section title="Expenses by Category" headers={["Category", "Amount"]} rows={expenseBreak.map((e) => [e.category || "Uncategorized", money(e.s, sym)])} />
        </div>
        <div className="text-muted" style={{ marginTop: "1.5rem", fontSize: ".8rem", textAlign: "center" }}>Generated by Hishab · {new Date().toISOString().slice(0, 10)}</div>
      </div>
    </div>
  );
}

function Section({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <div>
      <h3 style={{ fontWeight: 700, marginBottom: ".4rem" }}>{title}</h3>
      <table className="tbl">
        <thead><tr>{headers.map((h, i) => <th key={i} style={{ textAlign: i === headers.length - 1 ? "right" : "left" }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ textAlign: j === r.length - 1 ? "right" : "left" }}>{c}</td>)}</tr>)}
          {rows.length === 0 && <tr><td colSpan={headers.length} className="text-muted" style={{ textAlign: "center", padding: "1rem" }}>No data.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
