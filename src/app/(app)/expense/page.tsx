import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import CashbookClient from "@/components/CashbookClient";

export const dynamic = "force-dynamic";

export default async function ExpensePage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const rows = all<{ id: string; category: string | null; amount: number; date: string; note: string | null; aname: string | null; account_id: string | null }>(
    `SELECT e.id, e.category, e.amount, e.date, e.note, e.account_id, a.name aname
     FROM expenses e LEFT JOIN accounts a ON a.id = e.account_id WHERE e.business_id = ? ORDER BY e.date DESC`, [bid]
  );
  const accounts = all<{ id: string; name: string }>("SELECT id, name FROM accounts WHERE business_id = ? ORDER BY created_at", [bid]);
  return <CashbookClient kind="expense" rows={rows} accounts={accounts} symbol={ctx.business.currency_symbol} />;
}
