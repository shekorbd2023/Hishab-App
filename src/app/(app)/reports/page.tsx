import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { REPORTS, REPORT_GROUPS } from "@/lib/reports";
import ReportsHub from "./ReportsHub";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const admin = ctx.role === "Owner" || ctx.role === "Admin";
  const list = REPORTS.filter((r) => admin || r.type !== "audit").map((r) => ({ ...r, href: r.href || `/reports/${r.type}` }));
  return <ReportsHub reports={list} groups={REPORT_GROUPS} />;
}
