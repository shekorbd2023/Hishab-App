import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import {
  receivablePayableTotals, sumDocuments, sumExpenses, accountBalances, totalCashBank, monthRange,
} from "@/lib/domain";
import { getT } from "@/lib/serverI18n";
import { money } from "@/lib/util";
import Link from "next/link";
import CashflowChart from "@/components/CashflowChart";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const { business, user } = ctx;
  const bid = business.id;
  const { t } = await getT();
  const sym = business.currency_symbol;

  const { receivable, payable } = receivablePayableTotals(bid);
  const { from, to } = monthRange();
  const salesM = sumDocuments(bid, "sales_invoice", from, to);
  const purchaseM = sumDocuments(bid, "purchase_bill", from, to);
  const expenseM = sumExpenses(bid, from, to);

  const accts = all<{ id: string; name: string; type: string }>(
    "SELECT id, name, type FROM accounts WHERE business_id = ? ORDER BY created_at", [bid]
  );
  const balances = accountBalances(bid);
  const totalBal = totalCashBank(bid);

  // Cashflow last 7 days
  const days: { label: string; date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
  }
  const inRows = all<{ date: string; s: number }>(
    "SELECT substr(date,1,10) date, SUM(amount) s FROM payments WHERE business_id=? AND kind='in' AND date >= ? GROUP BY substr(date,1,10)",
    [bid, days[0].date]
  );
  const outRows = all<{ date: string; s: number }>(
    "SELECT substr(date,1,10) date, SUM(amount) s FROM payments WHERE business_id=? AND kind='out' AND date >= ? GROUP BY substr(date,1,10)",
    [bid, days[0].date]
  );
  const inMap = Object.fromEntries(inRows.map((r) => [r.date, r.s]));
  const outMap = Object.fromEntries(outRows.map((r) => [r.date, r.s]));
  const chart = days.map((d) => ({ label: d.label, in: inMap[d.date] || 0, out: outMap[d.date] || 0 }));
  const totalIn = chart.reduce((a, b) => a + b.in, 0);
  const totalOut = chart.reduce((a, b) => a + b.out, 0);

  const reminders = all<{ id: string; due_date: string; note: string; pname: string }>(
    `SELECT r.id, r.due_date, r.note, p.name pname FROM reminders r
     LEFT JOIN parties p ON p.id = r.party_id
     WHERE r.business_id = ? AND r.done = 0 ORDER BY r.due_date ASC LIMIT 5`, [bid]
  );

  // Health indicators
  const cover = payable > 0 ? receivable / payable : receivable > 0 ? 2 : 1;
  const health = cover >= 1.2 ? "green" : cover >= 0.8 ? "amber" : "red";

  const cards = [
    { label: t("to_receive"), val: money(receivable, sym), tone: "green", href: "/parties?filter=receivable" },
    { label: t("to_give"), val: money(payable, sym), tone: "red", href: "/parties?filter=payable" },
    { label: t("sales_this_month"), val: money(salesM, sym), tone: "green", href: "/sales-invoices" },
    { label: t("purchase_this_month"), val: money(purchaseM, sym), tone: "blue", href: "/purchase" },
    { label: t("expense_this_month"), val: money(expenseM, sym), tone: "red", href: "/expense" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800 }}>{t("welcome")} {user.name}</h1>
        <div style={{ display: "flex", gap: ".4rem" }}>
          <Link href="/pos" className="btn btn-primary">🧮 {t("quick_pos")}</Link>
          <Link href="/purchase/create" className="btn">+ {t("add_purchase")}</Link>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: ".75rem", marginBottom: "1rem" }}>
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card" style={{ padding: "1rem", textDecoration: "none",
            background: c.tone === "green" ? "var(--green-soft)" : c.tone === "red" ? "var(--red-soft)" : "var(--blue-soft)" }}>
            <div className="text-muted" style={{ fontSize: ".8rem" }}>{c.label}</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: ".3rem" }}>{c.val}</div>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: ".75rem", alignItems: "start" }} className="dash-grid">
        {/* Cashflow */}
        <div className="card" style={{ padding: "1.1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".75rem" }}>
            <h2 style={{ fontWeight: 700 }}>{t("cashflow")} <span className="text-muted" style={{ fontSize: ".8rem" }}>(Last 7 Days)</span></h2>
          </div>
          <CashflowChart data={chart} />
          <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", marginTop: ".75rem", fontSize: ".85rem" }}>
            <span><span style={{ color: "var(--brand)" }}>●</span> {t("total_money_in")}: <b>{money(totalIn, sym)}</b></span>
            <span><span style={{ color: "var(--red)" }}>●</span> {t("total_money_out")}: <b>{money(totalOut, sym)}</b></span>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
          <div className="card" style={{ padding: "1.1rem" }}>
            <div className="text-muted" style={{ fontSize: ".8rem" }}>{t("total_balance")}</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, margin: ".3rem 0 .6rem" }}>{money(totalBal, sym)}</div>
            {accts.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem", padding: ".2rem 0" }}>
                <span className="text-muted">{a.name}</span>
                <span style={{ fontWeight: 600 }}>{money(balances[a.id] || 0, sym)}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: "1.1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: health === "green" ? "var(--brand)" : health === "amber" ? "#f59e0b" : "var(--red)" }} />
              <b>{t("business_health")}</b>
            </div>
            <p className="text-muted" style={{ fontSize: ".82rem", marginTop: ".4rem" }}>
              Receivable vs payable cover: <b style={{ color: "var(--text)" }}>{cover.toFixed(2)}×</b>
            </p>
          </div>

          <div className="card" style={{ padding: "1.1rem" }}>
            <h3 style={{ fontWeight: 700, marginBottom: ".5rem" }}>{t("upcoming_reminders")} ({reminders.length})</h3>
            {reminders.length === 0 ? (
              <p className="text-muted" style={{ fontSize: ".85rem" }}>No reminders yet.</p>
            ) : reminders.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem", padding: ".25rem 0" }}>
                <span>{r.pname || "—"}</span>
                <span className="text-muted">{r.due_date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
