import { requireCtx } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { buildReport } from "@/lib/reports";
import { monthRange } from "@/lib/domain";
import { all } from "@/lib/db";
import ReportShell from "./ReportShell";

export const dynamic = "force-dynamic";

const VALID = new Set([
  "sales", "purchase", "sales-return", "purchase-return", "day-book", "profit-loss",
  "all-parties", "stock", "low-stock", "income-expense", "party-statement", "discount", "tax",
]);
const NO_DATE = new Set(["all-parties", "stock", "low-stock"]);
const PARTY_TYPES = new Set(["sales", "purchase", "sales-return", "purchase-return", "party-statement"]);

export default async function ReportPage({
  params, searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ from?: string; to?: string; party?: string }>;
}) {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const { type } = await params;
  if (!VALID.has(type)) notFound();
  const sp = await searchParams;
  const mr = monthRange();
  const from = sp.from || new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString().slice(0, 10);
  const to = sp.to || mr.to;
  const party = sp.party || "all";

  const report = buildReport(ctx.business.id, type, from, to, ctx.business.currency_symbol, { partyId: party });
  const parties = PARTY_TYPES.has(type)
    ? all<{ id: string; name: string }>("SELECT id, name FROM parties WHERE business_id = ? ORDER BY name COLLATE NOCASE", [ctx.business.id])
    : [];

  return (
    <ReportShell
      report={report}
      type={type}
      from={from}
      to={to}
      showDates={!NO_DATE.has(type)}
      parties={parties}
      party={party}
      showParty={PARTY_TYPES.has(type)}
    />
  );
}
