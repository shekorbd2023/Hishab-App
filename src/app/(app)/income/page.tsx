import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import CashbookClient from "@/components/CashbookClient";

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const rows = all<{ id: string; category: string | null; amount: number; date: string; note: string | null; aname: string | null; account_id: string | null }>(
    `SELECT i.id, i.category, i.amount, i.date, i.note, i.account_id, a.name aname
     FROM incomes i LEFT JOIN accounts a ON a.id = i.account_id WHERE i.business_id = ? ORDER BY i.date DESC`, [bid]
  );
  const accounts = all<{ id: string; name: string }>("SELECT id, name FROM accounts WHERE business_id = ? ORDER BY created_at", [bid]);
  return <CashbookClient kind="income" rows={rows} accounts={accounts} symbol={ctx.business.currency_symbol} />;
}
