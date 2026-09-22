import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { all } from "@/lib/db";
import { receivablePayableTotals, sumDocuments, sumExpenses, accountBalances, docLabel } from "@/lib/domain";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/serverI18n";
import { fmtDate, TODAY } from "@/lib/format";
import { Icon } from "@/components/ui";
import CashflowChart, { type CashSeries } from "@/components/CashflowChart";
import DashActions from "./DashActions";
import { makeMoney, buckets, fill, startOfMonth, addMonths, addDays } from "./fmt";

export const dynamic = "force-dynamic";

type Mov = { date: string; s: number };

export default async function Dashboard() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const { business, user } = ctx;
  const bid = business.id;
  const { t } = await getT();
  const st = getSettings(bid);
  const sym = business.currency_symbol || "Tk.";
  const money = makeMoney(sym, st);
  const today = TODAY();

  // ---- KPIs
  const { receivable, payable } = receivablePayableTotals(bid);
  const mFrom = startOfMonth(today), mTo = addDays(addMonths(mFrom, 1), -1);
  const salesM = sumDocuments(bid, "sales_invoice", mFrom, mTo);
  const purchaseM = sumDocuments(bid, "purchase_bill", mFrom, mTo);
  const expenseM = sumExpenses(bid, mFrom, mTo);

  // ---- Cashflow: in = payments in + incomes + add-money; out = payments out + expenses + reduce-money (transfers excluded)
  const since = addMonths(startOfMonth(today), -11);
  const q = (sql: string) => all<Mov>(sql, [bid, since]);
  const inRows = [
    ...q("SELECT substr(date,1,10) date, SUM(amount) s FROM payments WHERE business_id=? AND kind='in' AND date>=? GROUP BY 1"),
    ...q("SELECT substr(date,1,10) date, SUM(amount) s FROM incomes WHERE business_id=? AND date>=? GROUP BY 1"),
    ...q("SELECT substr(date,1,10) date, SUM(amount) s FROM account_adjustments WHERE business_id=? AND kind='add' AND date>=? GROUP BY 1"),
  ];
  const outRows = [
    ...q("SELECT substr(date,1,10) date, SUM(amount) s FROM payments WHERE business_id=? AND kind='out' AND date>=? GROUP BY 1"),
    ...q("SELECT substr(date,1,10) date, SUM(amount) s FROM expenses WHERE business_id=? AND date>=? GROUP BY 1"),
    ...q("SELECT substr(date,1,10) date, SUM(amount) s FROM account_adjustments WHERE business_id=? AND kind='reduce' AND date>=? GROUP BY 1"),
  ];
  const toMap = (rows: Mov[]) => rows.reduce<Record<string, number>>((m, r) => { m[r.date] = (m[r.date] || 0) + r.s; return m; }, {});
  const inMap = toMap(inRows), outMap = toMap(outRows);
  const mk = (period: "daily" | "weekly" | "monthly", n: number): CashSeries => {
    const b = buckets(period, today, n);
    const i = fill(b, inMap), o = fill(b, outMap);
    return b.map((x, k) => ({ label: x.label, in: i[k], out: o[k] }));
  };
  const series = { daily: mk("daily", 7), weekly: mk("weekly", 8), monthly: mk("monthly", 12) };

  // ---- Accounts
  const accts = all<{ id: string; name: string; type: string }>("SELECT id, name, type FROM accounts WHERE business_id=? ORDER BY created_at", [bid]);
  const bal = accountBalances(bid);
  const totalBal = accts.reduce((a, x) => a + (bal[x.id] || 0), 0);

  // ---- Recent transactions
  type Tx = { id: string; src: string; kind: string; number: number; date: string; created_at: string; name: string | null; total: number };
  const recent = all<Tx>(
    `SELECT * FROM (
       SELECT d.id, 'doc' src, d.kind, d.number, d.date, d.created_at, p.name, d.total FROM documents d LEFT JOIN parties p ON p.id=d.party_id
         WHERE d.business_id=? AND d.kind!='quotation'
       UNION ALL
       SELECT y.id, 'pay', y.kind, y.number, y.date, y.created_at, p.name, y.amount FROM payments y LEFT JOIN parties p ON p.id=y.party_id
         WHERE y.business_id=? AND y.is_auto=0
       UNION ALL
       SELECT id, 'exp', 'expense', number, date, created_at, category, amount FROM expenses WHERE business_id=?
       UNION ALL
       SELECT id, 'inc', 'income', number, date, created_at, category, amount FROM incomes WHERE business_id=?
     ) ORDER BY date DESC, created_at DESC LIMIT 8`, [bid, bid, bid, bid]
  );
  const docIds = recent.filter((r) => r.src === "doc").map((r) => r.id);
  const paidMap: Record<string, number> = {};
  if (docIds.length) {
    for (const r of all<{ document_id: string; s: number }>(
      `SELECT document_id, SUM(amount) s FROM payments WHERE document_id IN (${docIds.map(() => "?").join(",")}) GROUP BY document_id`, docIds)) paidMap[r.document_id] = r.s;
  }
  const txLabel = (r: Tx) =>
    r.src === "doc" ? docLabel(r.kind, r.number)
      : r.src === "pay" ? `${r.kind === "in" ? "Payment In" : "Payment Out"} #${r.number}`
        : r.src === "exp" ? `Expense #${r.number}` : `Income #${r.number}`;
  const txHref = (r: Tx) => (r.src === "doc" ? `/doc/${r.id}` : r.src === "pay" ? `/receipt/${r.id}` : r.src === "exp" ? "/expense" : "/income");

  // ---- Reminders
  const reminders = all<{ id: string; due_date: string; note: string | null; pname: string | null }>(
    `SELECT r.id, r.due_date, r.note, p.name pname FROM reminders r LEFT JOIN parties p ON p.id=r.party_id
     WHERE r.business_id=? AND r.done=0 ORDER BY r.due_date ASC LIMIT 5`, [bid]
  );
  const remCount = all<{ c: number }>("SELECT COUNT(*) c FROM reminders WHERE business_id=? AND done=0", [bid])[0]?.c ?? 0;

  const kpis = [
    { label: t("to_receive"), val: money(receivable), tone: "green", href: "/parties?filter=receivable", icon: "arrowDown" },
    { label: t("to_give"), val: money(payable), tone: "pink", href: "/parties?filter=payable", icon: "arrowUp" },
    { label: t("sales_this_month"), val: money(salesM), tone: "", href: "/insights/sales", icon: "tag" },
    { label: t("purchase_this_month"), val: money(purchaseM), tone: "", href: "/insights/purchase", icon: "cart" },
    { label: t("expense_this_month"), val: money(expenseM), tone: "", href: "/insights/expense", icon: "wallet" },
  ];

  return (
    <div>
      <div className="db-head">
        <h1>{t("welcome")} {user.name}</h1>
        <DashActions />
      </div>

      <div className="db-kpis">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className={`db-kpi ${k.tone}`}>
            <div className="l"><span>{k.label}</span><span className="ic"><Icon name={k.icon} size={15} /></span></div>
            <div className="v">{k.val}</div>
          </Link>
        ))}
      </div>

      <div className="db-grid">
        <div style={{ display: "grid", gap: "1rem", minWidth: 0 }}>
          <CashflowChart series={series} symbol={sym} hide={st.privacy_mode} />

          <div className="db-card">
            <div className="db-card-h">
              <h2>{t("recent_transactions")}</h2>
              <Link href="/reports/all-transactions" className="link" style={{ fontSize: 13 }}>{t("view_all_transactions")} →</Link>
            </div>
            {recent.length === 0 ? (
              <div className="empty"><Icon name="receipt" size={32} stroke={1.3} /><h3>No transactions yet</h3><div>Create your first sale to see it here.</div></div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead><tr><th>Date</th><th>Type</th><th>Name</th><th className="num">Total</th><th className="num">Rec/Paid</th><th className="num">Balance</th></tr></thead>
                  <tbody>
                    {recent.map((r) => {
                      const isDoc = r.src === "doc";
                      const paid = isDoc ? paidMap[r.id] || 0 : r.total;
                      const due = isDoc ? Math.max(0, r.total - paid) : 0;
                      return (
                        <tr key={r.src + r.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                          <td><Link href={txHref(r)} className="link" style={{ fontWeight: 600 }}>{txLabel(r)}</Link></td>
                          <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || (isDoc ? "Cash Sale" : "--")}</td>
                          <td className="num">{money(r.total)}</td>
                          <td className="num">{money(paid)}</td>
                          <td className={`num ${due > 0 ? "neg" : ""}`}>{isDoc ? money(due) : "--"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="db-card">
            <div className="db-card-h" style={{ alignItems: "flex-start" }}>
              <div>
                <div className="text-muted" style={{ fontSize: 12.5 }}>{t("total_balance")}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{money(totalBal)}</div>
              </div>
              <Link href="/accounts" className="btn btn-sm btn-soft" style={{ width: "auto" }}>View</Link>
            </div>
            <div style={{ padding: ".25rem 1rem .5rem" }}>
              {accts.map((a) => (
                <Link key={a.id} href={`/accounts/${a.id}`} className="db-acc">
                  <span className={`acc-ic ${a.type}`}><Icon name={a.type === "bank" ? "bank" : a.type === "wallet" ? "wallet" : "cash"} size={15} /></span>
                  <span style={{ flex: 1, fontWeight: 500 }}>{a.name}</span>
                  <b className={(bal[a.id] || 0) < 0 ? "neg" : ""}>{money(bal[a.id] || 0)}</b>
                </Link>
              ))}
              {accts.length === 0 && <div className="text-muted" style={{ padding: ".75rem 0" }}>No accounts yet.</div>}
            </div>
          </div>

          <div className="db-card">
            <div className="db-card-h">
              <h2>{t("upcoming_reminders")} ({remCount})</h2>
              <Link href="/reminders" className="link" style={{ fontSize: 12.5 }}>View all</Link>
            </div>
            {reminders.length === 0 ? (
              <div className="empty" style={{ padding: "1.6rem 1rem" }}>
                <div style={{ width: 60, height: 60, borderRadius: 14, background: "var(--hover)", display: "grid", placeItems: "center", color: "var(--faint)" }}><Icon name="reminder" size={30} stroke={1.3} /></div>
                <h3 style={{ fontSize: 14 }}>{t("no_reminders")}</h3>
                <div style={{ fontSize: 12.5 }}>Set reminders to collect dues on time.</div>
                <Link href="/reminders?new=1" className="btn btn-primary btn-sm" style={{ marginTop: ".5rem" }}><Icon name="plus" size={14} />{t("add_new_reminder")}</Link>
              </div>
            ) : (
              <div style={{ padding: ".25rem 1rem .75rem" }}>
                {reminders.map((r) => (
                  <div key={r.id} className="db-acc">
                    <span className="acc-ic bank"><Icon name="reminder" size={15} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pname || r.note || "Reminder"}</div>
                      {r.pname && r.note && <div className="sub">{r.note}</div>}
                    </span>
                    <span className={`sub ${r.due_date < today ? "neg" : ""}`} style={{ whiteSpace: "nowrap" }}>{fmtDate(r.due_date)}</span>
                  </div>
                ))}
                <Link href="/reminders?new=1" className="btn btn-sm" style={{ marginTop: ".6rem", width: "100%" }}><Icon name="plus" size={14} />{t("add_new_reminder")}</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
