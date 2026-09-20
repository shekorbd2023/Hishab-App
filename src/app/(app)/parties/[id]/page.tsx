import { requireCtx } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { partyBalance } from "@/lib/domain";
import { money } from "@/lib/util";
import { getT } from "@/lib/serverI18n";
import Link from "next/link";
import PartyActions from "./PartyActions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  sales_invoice: "Sales Invoice", purchase_bill: "Purchase Bill",
  sales_return: "Sales Return", purchase_return: "Purchase Return", quotation: "Quotation",
};

export default async function PartyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const sym = ctx.business.currency_symbol;
  const { t } = await getT();

  const party = get<{ id: string; name: string; phone: string | null; type: string }>(
    "SELECT * FROM parties WHERE id = ? AND business_id = ?", [id, bid]
  );
  if (!party) notFound();

  const balance = partyBalance(bid, id);
  const accounts = all<{ id: string; name: string }>("SELECT id, name FROM accounts WHERE business_id = ? ORDER BY created_at", [bid]);

  const docs = all<{ id: string; kind: string; number: number; date: string; total: number; status: string }>(
    "SELECT id, kind, number, date, total, status FROM documents WHERE business_id = ? AND party_id = ?", [bid, id]
  );
  const pays = all<{ id: string; kind: string; amount: number; date: string; mode: string | null }>(
    "SELECT id, kind, amount, date, mode FROM payments WHERE business_id = ? AND party_id = ? AND document_id IS NULL", [bid, id]
  );
  type Row = { date: string; label: string; amount: number; status?: string };
  const timeline: Row[] = [
    ...docs.map((d) => ({ date: d.date, label: `${KIND_LABEL[d.kind]} #${d.number}`, amount: d.total, status: d.status })),
    ...pays.map((p) => ({ date: p.date, label: p.kind === "in" ? "Payment In" : "Payment Out", amount: p.amount })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <Link href="/parties" className="link" style={{ fontSize: ".85rem" }}>← {t("parties")}</Link>
      <div className="card" style={{ padding: "1.25rem", margin: ".75rem 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>{party.name}</h1>
            <div className="text-muted" style={{ fontSize: ".85rem" }}>{party.phone || "—"} · {party.type}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="text-muted" style={{ fontSize: ".8rem" }}>{balance >= 0 ? t("to_receive") : t("to_give")}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: balance >= 0 ? "var(--brand)" : "var(--red)" }}>
              {money(Math.abs(balance), sym)}
            </div>
          </div>
        </div>
        <PartyActions partyId={party.id} partyName={party.name} phone={party.phone} balance={balance} accounts={accounts} />
      </div>

      <div className="card" style={{ padding: "1rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>Transactions ({timeline.length})</h2>
        <div style={{ overflowX: "auto" }} className="scroll-thin">
          <table className="tbl">
            <thead><tr><th>Type</th><th>{t("date")}</th><th style={{ textAlign: "right" }}>{t("total")}</th><th>{t("status")}</th></tr></thead>
            <tbody>
              {timeline.map((r, i) => (
                <tr key={i}>
                  <td>{r.label}</td>
                  <td className="text-muted">{r.date}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{money(r.amount, sym)}</td>
                  <td>{r.status ? <span className={`pill ${r.status === "paid" ? "pill-green" : "pill-red"}`}>{r.status}</span> : "—"}</td>
                </tr>
              ))}
              {timeline.length === 0 && <tr><td colSpan={4} className="text-muted" style={{ textAlign: "center", padding: "1.5rem" }}>{t("no_data")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
