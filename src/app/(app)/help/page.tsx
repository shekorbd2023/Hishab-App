import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const S = ({ q, a }: { q: string; a: string }) => (
    <div className="card" style={{ padding: "1rem" }}>
      <div style={{ fontWeight: 700, marginBottom: ".3rem" }}>{q}</div>
      <div className="text-muted" style={{ fontSize: ".9rem", lineHeight: 1.6 }}>{a}</div>
    </div>
  );
  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>Help &amp; Support</h1>
      <div style={{ display: "grid", gap: ".6rem" }}>
        <S q="How do I record a sale?" a="Use Quick POS for over-the-counter sales, or Sales → Create Sales Invoice for a detailed bill. Enter the customer (or leave as Cash Sale), add items, and mark it paid or leave it as due." />
        <S q="How do I take a payment against a due bill?" a="Open the party (Parties → tap a name) and use Record Payment, or Sales → Payment In. The bill's status updates automatically." />
        <S q="Where is my data stored?" a="On this PC, in the app's data folder. It survives updates and reinstalls. Back it up regularly from Reports → Backup & Restore (JSON), or Settings." />
        <S q="How do I change my logo and business details?" a="Settings → Business Profile. Your logo appears in the sidebar, on invoices, business cards and greeting cards." />
        <S q="Can staff have limited access?" a="Yes. Manage Staffs → add a staff member and set per-module permissions (view / create / edit / delete)." />
        <S q="Contact" a="For help with this build, reach out to the person who set it up for you." />
      </div>
    </div>
  );
}
