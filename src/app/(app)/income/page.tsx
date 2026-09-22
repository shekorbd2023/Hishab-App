import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cashbookData } from "@/lib/cashbook";
import CashbookClient from "@/components/CashbookClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  return <CashbookClient kind="income" {...cashbookData(ctx.business.id, "income")} />;
}
