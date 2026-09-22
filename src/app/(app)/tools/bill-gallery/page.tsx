import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { money } from "@/lib/util";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BillGallery() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const sym = ctx.business.currency_symbol;
  const rows = all<{ id: string; number: number; date: string; total: number; status: string; kind: string; pname: string | null }>(
    `SELECT d.id, d.number, d.date, d.total, d.status, d.kind, p.name pname FROM documents d
     LEFT JOIN parties p ON p.id = d.party_id
     WHERE d.business_id = ? AND d.kind IN ('sales_invoice','purchase_bill') ORDER BY d.date DESC, d.number DESC LIMIT 60`, [ctx.business.id]
  );
  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>Bill Gallery</h1>
      <p className="text-muted" style={{ fontSize: ".85rem", marginBottom: "1rem" }}>Your recent invoices &amp; bills — click any to view or print.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: ".75rem" }}>
        {rows.map((r) => (
          <Link key={r.id} href={`/doc/${r.id}`} className="card" style={{ padding: "1rem", textDecoration: "none", display: "flex", flexDirection: "column", gap: ".35rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="pill pill-muted">{r.kind === "sales_invoice" ? "Sale" : "Purchase"} #{r.number}</span>
              <span className={`pill ${r.status === "paid" ? "pill-green" : "pill-red"}`}>{r.status}</span>
            </div>
            <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pname || "Cash Sale"}</div>
            <div className="text-muted" style={{ fontSize: ".8rem" }}>{r.date}</div>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", marginTop: ".2rem" }}>{money(r.total, sym)}</div>
          </Link>
        ))}
        {rows.length === 0 && <p className="text-muted">No bills yet.</p>}
      </div>
    </div>
  );
}
