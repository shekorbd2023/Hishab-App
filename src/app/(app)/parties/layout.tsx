import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";
import { partyBalances } from "@/lib/domain";
import { partyCategories } from "./data";
import PartiesShell, { type PartyRow } from "./PartiesShell";

export const dynamic = "force-dynamic";

// Karbar two-pane: the party list lives in the layout so switching parties only reloads the detail pane.
export default async function PartiesLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const bal = partyBalances(bid);
  const parties: PartyRow[] = all<Omit<PartyRow, "balance">>(
    "SELECT id, name, phone, type, category, photo, created_at FROM parties WHERE business_id = ? ORDER BY created_at DESC, name COLLATE NOCASE",
    [bid]
  ).map((p) => ({ ...p, balance: Math.round((bal[p.id] ?? 0) * 100) / 100 }));
  return (
    <Suspense>
      <PartiesShell parties={parties} categories={partyCategories(bid)}>{children}</PartiesShell>
    </Suspense>
  );
}
