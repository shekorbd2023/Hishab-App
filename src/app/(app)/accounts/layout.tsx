import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import AccountsShell from "./AccountsShell";
import { loadAccounts } from "./data";

export const dynamic = "force-dynamic";

// Karbar "Manage Accounts": account list on the left (in the layout), selected account's activity on the right.
export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  return <AccountsShell accounts={loadAccounts(ctx.business.id)}>{children}</AccountsShell>;
}
