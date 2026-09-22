import { redirect, notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { partyBalances, partyLedger } from "@/lib/domain";
import PartyDetail from "./PartyDetail";

export const dynamic = "force-dynamic";

// Right pane of the Karbar-style two-pane Parties screen (the list lives in ../layout.tsx).
export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const party = get<{
    id: string; name: string; phone: string | null; address: string | null; type: string; category: string | null;
    opening_balance: number; as_of_date: string | null; email: string | null; vat: string | null; photo: string | null;
  }>("SELECT id, name, phone, address, type, category, opening_balance, as_of_date, email, vat, photo FROM parties WHERE id=? AND business_id=?", [id, bid]);
  if (!party) notFound();

  const balances = partyBalances(bid);
  const ledger = partyLedger(bid, id).reverse(); // newest first, like Karbar
  const accounts = all<{ id: string; name: string; type: string }>("SELECT id, name, type FROM accounts WHERE business_id=? ORDER BY created_at", [bid]);
  const parties = all<{ id: string; name: string; phone: string | null }>("SELECT id, name, phone FROM parties WHERE business_id=? ORDER BY name COLLATE NOCASE", [bid])
    .map((p) => ({ ...p, balance: Math.round((balances[p.id] ?? 0) * 100) / 100 }));
  const cats = all<{ name: string }>(
    `SELECT name FROM categories WHERE business_id=? AND kind='party' UNION SELECT category AS name FROM parties WHERE business_id=? AND category IS NOT NULL AND category != ''`,
    [bid, bid]
  ).map((r) => r.name);
  const counters = Object.fromEntries(
    all<{ kind: string; value: number }>("SELECT kind, value FROM counters WHERE business_id=?", [bid]).map((c) => [c.kind, c.value])
  );

  return (
    <PartyDetail
      party={party}
      balance={Math.round((balances[id] ?? 0) * 100) / 100}
      ledger={ledger.map((r) => ({
        key: r.key, date: r.date, label: r.label, type: r.type, total: r.total, status: r.status,
        balance: r.balance, remarks: r.remarks, ref: r.ref, refKind: r.refKind,
      }))}
      business={{ name: ctx.business.name, phone: ctx.business.phone }}
      accounts={accounts}
      parties={parties}
      categories={cats}
      nextIn={(counters["payment_in"] ?? 0) + 1}
      nextOut={(counters["payment_out"] ?? 0) + 1}
    />
  );
}
