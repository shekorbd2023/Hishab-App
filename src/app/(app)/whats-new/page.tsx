import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const RELEASES = [
  { v: "0.1.6", items: ["Hishab logo across the app, login, favicon and Windows icon", "Business logo shown in the sidebar business switcher", "Business Tools: Business Cards, Greeting Cards, Barcode Generator, Bill Gallery", "Import Data hub (CSV) and Help / Tutorials / What's New"] },
  { v: "0.1.4", items: ["Settings & business profile with logo upload", "Invoice logo, footer, and 80mm thermal receipt", "POS received amount, change/due and hold-bill", "New reports: party statement, returns, discount, tax", "Dashboard top items & top customers", "Barcode label printing & manual stock adjustment", "Reminders page & staff permission editor"] },
  { v: "0.1.3", items: ["Offline Windows desktop app (Electron) with local database", "Full modules: parties, inventory, sales, purchase, POS, accounts, reports, JSON/CSV export, audit log"] },
];

export default async function WhatsNewPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>What&apos;s New</h1>
      <div style={{ display: "grid", gap: ".75rem" }}>
        {RELEASES.map((r) => (
          <div key={r.v} className="card" style={{ padding: "1.1rem" }}>
            <div style={{ fontWeight: 800, marginBottom: ".4rem" }}>Version {r.v}</div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: ".25rem" }}>
              {r.items.map((it, i) => <li key={i} style={{ fontSize: ".9rem", lineHeight: 1.5 }}>{it}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
