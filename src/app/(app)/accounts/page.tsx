import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { accountBalances, totalCashBank } from "@/lib/domain";
import AccountsManager from "./AccountsManager";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const accts = all<{ id: string; name: string; type: string; opening_balance: number }>(
    "SELECT * FROM accounts WHERE business_id = ? ORDER BY created_at", [bid]
  );
  const bal = accountBalances(bid);
  const withBal = accts.map((a) => ({ ...a, balance: bal[a.id] ?? 0 }));
  return <AccountsManager accounts={withBal} total={totalCashBank(bid)} symbol={ctx.business.currency_symbol} />;
}
