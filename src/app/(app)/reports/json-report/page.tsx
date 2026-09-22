import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { get } from "@/lib/db";
import { receivablePayableTotals, totalCashBank } from "@/lib/domain";
import { tk } from "@/lib/format";
import JsonReportClient from "./JsonReportClient";

export const dynamic = "force-dynamic";

const COUNTS: [string, string][] = [
  ["parties", "Parties"], ["items", "Items"], ["accounts", "Accounts"], ["documents", "Invoices & Bills"], ["payments", "Payments"],
  ["expenses", "Expenses"], ["incomes", "Incomes"], ["transfers", "Transfers"], ["account_adjustments", "Add / Reduce Money"],
  ["stock_adjustments", "Stock Adjustments"], ["reminders", "Reminders"], ["audit_log", "Audit Entries"],
];

export default async function JsonReportPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const counts = COUNTS.map(([t, l]) => {
    let n = 0;
    try { n = get<{ n: number }>(`SELECT COUNT(*) n FROM ${t} WHERE business_id=?`, [bid])?.n ?? 0; } catch { /* table may not exist */ }
    return { l, n };
  });
  const lines = get<{ n: number }>("SELECT COUNT(*) n FROM doc_items di JOIN documents d ON d.id=di.document_id WHERE d.business_id=?", [bid])?.n ?? 0;
  counts.splice(4, 0, { l: "Invoice Line Items", n: lines });
  const rp = receivablePayableTotals(bid);
  const snapshot = [
    { l: "Total Receivable", v: tk(Math.round(rp.receivable * 100) / 100), t: "pos" },
    { l: "Total Payable", v: tk(Math.round(rp.payable * 100) / 100), t: "neg" },
    { l: "Cash & Bank Balance", v: tk(totalCashBank(bid)) },
  ];
  return <JsonReportClient businessName={ctx.business.name} counts={counts} snapshot={snapshot} />;
}
