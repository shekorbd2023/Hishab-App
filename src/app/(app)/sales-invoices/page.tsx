import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { money } from "@/lib/util";
import { getT } from "@/lib/serverI18n";
import Link from "next/link";
import { docPaid } from "@/lib/domain";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "sales_invoice", label: "sales_invoices", href: "/sales-invoices" },
  { key: "payment_in", label: "payment_in", href: "/sales-invoices?tab=payment_in" },
  { key: "quotation", label: "quotations", href: "/sales-invoices?tab=quotation" },
  { key: "sales_return", label: "sales_return", href: "/sales-invoices?tab=sales_return" },
];

export default async function SalesHub({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const sym = ctx.business.currency_symbol;
  const { t } = await getT();
  const sp = await searchParams;
  const tab = sp.tab || "sales_invoice";

  const createLink =
    tab === "quotation" ? "/sales-invoices/create?kind=quotation" :
    tab === "sales_return" ? "/sales-invoices/create?kind=sales_return" :
    "/sales-invoices/create?kind=sales_invoice";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>{t("sales")}</h1>
        {tab !== "payment_in" && <Link href={createLink} className="btn btn-primary">+ {t("add")}</Link>}
      </div>

      <div style={{ display: "flex", gap: ".4rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {TABS.map((tb) => (
          <Link key={tb.key} href={tb.href} className="btn" style={{ background: tab === tb.key ? "var(--brand)" : undefined, color: tab === tb.key ? "#fff" : undefined, borderColor: tab === tb.key ? "var(--brand)" : undefined }}>
            {t(tb.label)}
          </Link>
        ))}
      </div>

      <div className="card" style={{ padding: "1rem", overflowX: "auto" }}>
        {tab === "payment_in" ? <PaymentsTable bid={bid} sym={sym} kind="in" /> : <DocsTable bid={bid} sym={sym} kind={tab} />}
      </div>
    </div>
  );
}

async function DocsTable({ bid, sym, kind }: { bid: string; sym: string; kind: string }) {
  const rows = all<{ id: string; number: number; date: string; total: number; status: string; pname: string | null }>(
    `SELECT d.id, d.number, d.date, d.total, d.status, p.name pname
     FROM documents d LEFT JOIN parties p ON p.id = d.party_id
     WHERE d.business_id = ? AND d.kind = ? ORDER BY d.number DESC`, [bid, kind]
  );
  return (
    <table className="tbl">
      <thead><tr><th>No.</th><th>Party</th><th>Date</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Unpaid</th><th>Status</th></tr></thead>
      <tbody>
        {rows.map((r) => {
          const unpaid = r.total - docPaid(r.id);
          return (
            <tr key={r.id}>
              <td><Link href={`/doc/${r.id}`} className="link">#{r.number}</Link></td>
              <td>{r.pname || "Cash Sale"}</td>
              <td className="text-muted">{r.date}</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{money(r.total, sym)}</td>
              <td style={{ textAlign: "right" }}>{kind === "quotation" ? "—" : money(Math.max(0, unpaid), sym)}</td>
              <td>{kind === "quotation" ? <span className="pill pill-muted">quote</span> : <span className={`pill ${r.status === "paid" ? "pill-green" : "pill-red"}`}>{r.status}</span>}</td>
            </tr>
          );
        })}
        {rows.length === 0 && <tr><td colSpan={6} className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>No records yet.</td></tr>}
      </tbody>
    </table>
  );
}

async function PaymentsTable({ bid, sym, kind }: { bid: string; sym: string; kind: string }) {
  const rows = all<{ id: string; amount: number; date: string; mode: string | null; pname: string | null; aname: string | null }>(
    `SELECT pay.id, pay.amount, pay.date, pay.mode, p.name pname, a.name aname
     FROM payments pay LEFT JOIN parties p ON p.id = pay.party_id LEFT JOIN accounts a ON a.id = pay.account_id
     WHERE pay.business_id = ? AND pay.kind = ? ORDER BY pay.date DESC`, [bid, kind]
  );
  return (
    <table className="tbl">
      <thead><tr><th>Party</th><th>Date</th><th>Account</th><th>Mode</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.pname || "—"}</td><td className="text-muted">{r.date}</td><td>{r.aname || "—"}</td><td>{r.mode || "—"}</td>
            <td style={{ textAlign: "right", fontWeight: 600 }}>{money(r.amount, sym)}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={5} className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>No records yet.</td></tr>}
      </tbody>
    </table>
  );
}
