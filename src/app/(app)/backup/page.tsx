import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { get } from "@/lib/db";
import BackupClient from "./BackupClient";

export const dynamic = "force-dynamic";

const COUNTS: [string, string][] = [["parties", "Parties"], ["items", "Items"], ["documents", "Invoices & Bills"], ["payments", "Payments"], ["expenses", "Expenses"], ["accounts", "Accounts"]];

export default async function BackupPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const counts = COUNTS.map(([t, l]) => ({ l, n: get<{ n: number }>(`SELECT COUNT(*) n FROM ${t} WHERE business_id=?`, [ctx.business.id])?.n ?? 0 }));
  const last = get<{ created_at: string }>("SELECT created_at FROM audit_log WHERE business_id=? AND entity='restore' ORDER BY created_at DESC LIMIT 1", [ctx.business.id])?.created_at ?? null;
  return <BackupClient canRestore={ctx.role === "Owner" || ctx.role === "Admin"} businessName={ctx.business.name} counts={counts} lastRestore={last} />;
}
