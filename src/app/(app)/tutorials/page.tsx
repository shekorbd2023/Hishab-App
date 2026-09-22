import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: 1, t: "Set up your business", d: "Go to Settings and add your business name, address, phone and logo.", href: "/settings" },
  { n: 2, t: "Add your items", d: "Inventory → Add New Item (or Import Data → CSV) with prices and opening stock.", href: "/inventory" },
  { n: 3, t: "Add your parties", d: "Parties → Add customers & suppliers, or import them from CSV.", href: "/parties" },
  { n: 4, t: "Make your first sale", d: "Use Quick POS at the counter, or Sales → Create Sales Invoice.", href: "/pos" },
  { n: 5, t: "Track money", d: "Record expenses, other income, and see your accounts under Manage Accounts.", href: "/accounts" },
  { n: 6, t: "See how you're doing", d: "Reports → Profit & Loss, Monthly Business Report, stock and party statements.", href: "/reports" },
];

export default async function TutorialsPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>Tutorials — Getting Started</h1>
      <div style={{ display: "grid", gap: ".6rem" }}>
        {STEPS.map((s) => (
          <Link key={s.n} href={s.href} className="card" style={{ padding: "1rem", display: "flex", gap: ".9rem", alignItems: "center", textDecoration: "none" }}>
            <span style={{ width: 34, height: 34, borderRadius: 999, background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, flexShrink: 0 }}>{s.n}</span>
            <span>
              <div style={{ fontWeight: 700 }}>{s.t}</div>
              <div className="text-muted" style={{ fontSize: ".88rem" }}>{s.d}</div>
            </span>
            <span className="link" style={{ marginLeft: "auto" }}>Open →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
