import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { get } from "@/lib/db";
import { Icon } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const np = get<{ n: number }>("SELECT COUNT(*) n FROM parties WHERE business_id=?", [bid])?.n ?? 0;
  const ni = get<{ n: number }>("SELECT COUNT(*) n FROM items WHERE business_id=?", [bid])?.n ?? 0;
  const cards = [
    { href: "/import/parties", icon: "users", title: "Import Parties", desc: "Add customers and suppliers in bulk — name, phone, type, category, opening balance (To Receive / To Give), address, email and VAT number.", meta: `${np} parties now` },
    { href: "/import/items", icon: "box", title: "Import Items", desc: "Add products and services in bulk — code, category, unit, sales / purchase / MRP / wholesale price, opening stock and low stock alert.", meta: `${ni} items now` },
  ];
  return (
    <div>
      <div className="page-head"><h1 className="page-title">Import Data</h1></div>
      <div className="bk-grid">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card hub-card">
            <span className="rh-ic" style={{ width: 44, height: 44, borderRadius: 10 }}><Icon name={c.icon} size={22} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="rh-name" style={{ fontSize: 15 }}>{c.title}</span>
              <span className="rh-desc" style={{ fontSize: 12.5 }}>{c.desc}</span>
              <span className="row" style={{ marginTop: ".7rem", gap: ".6rem" }}>
                <span className="btn btn-sm btn-primary"><Icon name="upload" size={14} />Start Import</span>
                <span className="sub">{c.meta} · 3 steps · up to 500 entries</span>
              </span>
            </span>
          </Link>
        ))}
      </div>
      <div className="card" style={{ padding: "1rem 1.2rem", marginTop: "1rem", display: "flex", gap: ".8rem", alignItems: "flex-start" }}>
        <span className="rh-ic x"><Icon name="info" size={18} /></span>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <b>Moving from Karbar or another app?</b>
          <div className="text-muted">
            Export your parties and items there as Excel (.xlsx) or CSV and upload the file here — columns such as <i>Name</i>, <i>Phone Number</i>, <i>Opening Balance</i>,
            <i> Sales Price</i> or <i>Stock</i> are matched automatically, and you can fix anything in the review table before importing.
            To move a whole Hishab business (invoices, payments, balances) use a JSON backup in <Link className="link" href="/backup">Backup &amp; Restore</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
