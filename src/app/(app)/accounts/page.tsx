import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { Empty } from "@/components/ui";
import { loadAccounts } from "./data";

export const dynamic = "force-dynamic";

export default async function AccountsIndex() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const first = loadAccounts(ctx.business.id)[0];
  if (first) redirect(`/accounts/${first.id}`);
  return (
    <div className="md-empty-pane">
      <Empty icon="bank" title="No accounts yet" text="Add your cash box, bank accounts and mobile wallets (bKash, Nagad…)." />
    </div>
  );
}
