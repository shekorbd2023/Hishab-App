import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { partyBalances } from "@/lib/domain";
import PartiesTable from "./PartiesTable";

export const dynamic = "force-dynamic";

export default async function PartiesPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const parties = all<{ id: string; name: string; phone: string | null; type: string; category: string | null; opening_balance: number; address: string | null; note: string | null }>(
    "SELECT * FROM parties WHERE business_id = ? ORDER BY name COLLATE NOCASE", [bid]
  );
  const bal = partyBalances(bid);
  const withBal = parties.map((p) => ({ ...p, balance: bal[p.id] ?? 0 }));
  return <PartiesTable parties={withBal} symbol={ctx.business.currency_symbol} />;
}
