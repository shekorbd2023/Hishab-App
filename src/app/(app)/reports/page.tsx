import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getT } from "@/lib/serverI18n";
import Link from "next/link";

export const dynamic = "force-dynamic";

const GROUPS: { title: string; items: { href: string; label: string; desc: string }[] }[] = [
  {
    title: "Transactions",
    items: [
      { href: "/reports/sales", label: "Sales", desc: "All sales in a period" },
      { href: "/reports/purchase", label: "Purchase", desc: "All purchases in a period" },
      { href: "/reports/day-book", label: "Day Book", desc: "Every transaction, day by day" },
      { href: "/reports/profit-loss", label: "Profit & Loss", desc: "Revenue, COGS, expenses, net profit" },
    ],
  },
  {
    title: "Parties",
    items: [
      { href: "/reports/all-parties", label: "All Party Report", desc: "Receivable / payable of every party" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { href: "/reports/stock", label: "Stock & Valuation", desc: "Quantity and stock value per item" },
      { href: "/reports/low-stock", label: "Low Stock Summary", desc: "Items at or below alert level" },
    ],
  },
  {
    title: "Income & Expense",
    items: [
      { href: "/reports/income-expense", label: "Income vs Expense", desc: "Totals and category breakdown" },
    ],
  },
  {
    title: "Exclusive",
    items: [
      { href: "/reports/monthly", label: "📈 Monthly Business Report", desc: "Auto analysis + narrative, CSV & print" },
      { href: "/backup", label: "💾 Backup & Restore (JSON)", desc: "Export/import the entire business" },
    ],
  },
];

export default async function ReportsHub() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const { t } = await getT();
  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>{t("reports")}</h1>
      {GROUPS.map((g) => (
        <div key={g.title} style={{ marginBottom: "1.5rem" }}>
          <h2 className="text-muted" style={{ fontSize: ".8rem", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".5rem" }}>{g.title}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: ".6rem" }}>
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} className="card" style={{ padding: "1rem", textDecoration: "none" }}>
                <div style={{ fontWeight: 700 }}>{it.label}</div>
                <div className="text-muted" style={{ fontSize: ".82rem", marginTop: ".25rem" }}>{it.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
