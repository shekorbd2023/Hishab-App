import { redirect, notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { accountLedger } from "@/lib/domain";
import { loadAccounts } from "../data";
import AccountDetail from "./AccountDetail";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const accounts = loadAccounts(bid);
  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();
  const ledger = accountLedger(bid, id).reverse();
  return (
    <AccountDetail
      account={account}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name, balance: a.balance }))}
      ledger={ledger.map((r) => ({ key: r.key, date: r.date, type: r.type, label: r.label, party: r.party, amount: r.amount, delta: r.delta, balance: r.balance, remarks: r.remarks, ref: r.ref, refKind: r.refKind }))}
    />
  );
}
