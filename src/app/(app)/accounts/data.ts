import { all } from "@/lib/db";
import { accountBalances } from "@/lib/domain";

export type AcctRow = {
  id: string; name: string; type: string; opening_balance: number; bank_name: string | null; holder: string | null;
  account_no: string | null; created_at: string; balance: number;
};

export function loadAccounts(bid: string): AcctRow[] {
  const bal = accountBalances(bid);
  return all<Omit<AcctRow, "balance">>(
    "SELECT id, name, type, opening_balance, bank_name, holder, account_no, created_at FROM accounts WHERE business_id = ? ORDER BY created_at, name",
    [bid]
  ).map((a) => ({ ...a, balance: Math.round((bal[a.id] || 0) * 100) / 100 }));
}
