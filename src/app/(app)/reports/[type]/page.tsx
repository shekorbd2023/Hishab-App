import { requireCtx } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { buildReport } from "@/lib/reports";
import { monthRange } from "@/lib/domain";
import ReportShell from "./ReportShell";

export const dynamic = "force-dynamic";

const VALID = new Set(["sales", "purchase", "day-book", "profit-loss", "all-parties", "stock", "low-stock", "income-expense"]);
const NO_DATE = new Set(["all-parties", "stock", "low-stock"]);

export default async function ReportPage({
  params, searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const { type } = await params;
  if (!VALID.has(type)) notFound();
  const sp = await searchParams;
  const mr = monthRange();
  // default to year-to-date-ish: last 90 days -> today, or month for narrow
  const from = sp.from || new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString().slice(0, 10);
  const to = sp.to || mr.to;

  const report = buildReport(ctx.business.id, type, from, to, ctx.business.currency_symbol);
  return <ReportShell report={report} type={type} from={from} to={to} showDates={!NO_DATE.has(type)} />;
}
