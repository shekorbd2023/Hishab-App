import { requireCtx } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { buildReport, REPORT_TYPES, LEGACY_TYPES, type SP } from "@/lib/reports";
import ReportView from "@/components/ReportView";
import { get } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<SP> }) {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const { type } = await params;
  const sp = await searchParams;
  if (LEGACY_TYPES[type]) {
    const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
    redirect(`/reports/${LEGACY_TYPES[type]}${qs ? "?" + qs : ""}`);
  }
  if (!REPORT_TYPES.has(type)) notFound();
  // an account link may point at the other statement (cash vs bank/wallet) — send it to the right one
  const accId = sp.account || sp.accountId;
  if (accId && (type === "cash-in-hand-statement" || type === "bank-statement")) {
    const a = get<{ type: string }>("SELECT type FROM accounts WHERE id=? AND business_id=?", [accId, ctx.business.id]);
    const want = a?.type === "cash" ? "cash-in-hand-statement" : "bank-statement";
    if (a && want !== type) redirect(`/reports/${want}?${new URLSearchParams({ ...(sp.range ? { range: sp.range } : {}), ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}), account: accId }).toString()}`);
  }
  const report = buildReport(ctx.business.id, type, sp);
  const b = ctx.business as unknown as { name: string; logo: string | null; phone: string | null; address: string | null; email?: string | null };
  return <ReportView report={report} biz={{ name: b.name, logo: b.logo, phone: b.phone, address: b.address, email: b.email ?? null }} />;
}
