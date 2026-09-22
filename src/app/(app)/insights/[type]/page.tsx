import { notFound, redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";
import { TODAY } from "@/lib/format";
import { buckets, fill, type Period } from "../../dashboard/fmt";
import InsightsView, { type Block } from "./InsightsView";

export const dynamic = "force-dynamic";

const META = {
  sales: { title: "Sales Insights", noun: "Sales", kind: "sales_invoice", who: "Top Customers", what: "Top Selling Items", list: "/sales-invoices" },
  purchase: { title: "Purchase Insights", noun: "Purchase", kind: "purchase_bill", who: "Top Suppliers", what: "Top Purchased Items", list: "/purchase" },
  expense: { title: "Expense Insights", noun: "Expense", kind: null, who: "Top Categories", what: "Top Expense Items", list: "/expense" },
} as const;
const COUNT: Record<Period, number> = { daily: 14, weekly: 12, monthly: 12, quarterly: 8 };

type Tx = { date: string; amount: number; account: string | null; who: string | null; lines: { name: string; qty: number; amount: number; unit: string | null }[] };

export default async function InsightsPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const meta = META[type as keyof typeof META];
  if (!meta) notFound();
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const today = TODAY();
  const since = buckets("quarterly", today, COUNT.quarterly)[0].from;

  const txs: Tx[] = [];
  if (meta.kind) {
    const docs = all<{ id: string; date: string; total: number; acc: string | null; party: string | null }>(
      `SELECT d.id, d.date, d.total, a.name acc, p.name party FROM documents d
       LEFT JOIN accounts a ON a.id = d.account_id LEFT JOIN parties p ON p.id = d.party_id
       WHERE d.business_id = ? AND d.kind = ? AND d.date >= ?`, [bid, meta.kind, since]);
    const lines = all<{ document_id: string; name: string; qty: number; amount: number; unit: string | null }>(
      `SELECT di.document_id, di.name, di.qty, di.amount, di.unit FROM doc_items di JOIN documents d ON d.id = di.document_id
       WHERE d.business_id = ? AND d.kind = ? AND d.date >= ?`, [bid, meta.kind, since]);
    const byDoc = new Map<string, Tx["lines"]>();
    for (const l of lines) { const a = byDoc.get(l.document_id) || []; a.push({ name: l.name, qty: l.qty, amount: l.amount, unit: l.unit }); byDoc.set(l.document_id, a); }
    for (const d of docs) txs.push({ date: d.date, amount: d.total, account: d.acc, who: d.party || (type === "sales" ? "Cash Sale" : "Cash Purchase"), lines: byDoc.get(d.id) || [] });
  } else {
    for (const e of all<{ date: string; amount: number; acc: string | null; category: string | null; lines: string | null }>(
      `SELECT e.date, e.amount, a.name acc, e.category, e.lines FROM expenses e LEFT JOIN accounts a ON a.id = e.account_id
       WHERE e.business_id = ? AND e.date >= ?`, [bid, since])) {
      let ls: Tx["lines"] = [];
      try { ls = (JSON.parse(e.lines || "[]") as { name: string; qty: number; rate: number; amount?: number }[]).map((l) => ({ name: l.name, qty: Number(l.qty) || 0, amount: Number(l.amount ?? (l.qty * l.rate)) || 0, unit: null })); } catch { /* ignore */ }
      txs.push({ date: e.date, amount: e.amount, account: e.acc, who: e.category || "Uncategorised", lines: ls });
    }
  }

  const blocks = {} as Record<Period, Block>;
  for (const p of ["daily", "weekly", "monthly", "quarterly"] as Period[]) {
    const bks = buckets(p, today, COUNT[p]);
    const byDate: Record<string, number> = {};
    for (const t of txs) byDate[t.date] = (byDate[t.date] || 0) + t.amount;
    const values = fill(bks, byDate);
    const cur = bks[bks.length - 1];
    const inCur = txs.filter((t) => t.date >= cur.from && t.date <= cur.to);
    const group = <K extends string>(keyOf: (t: Tx) => K | null) => {
      const m = new Map<string, { count: number; amount: number }>();
      for (const t of inCur) { const k = keyOf(t) || "Unpaid / Credit"; const g = m.get(k) || { count: 0, amount: 0 }; g.count++; g.amount += t.amount; m.set(k, g); }
      return [...m.entries()].map(([name, g]) => ({ name, count: g.count, amount: Math.round(g.amount * 100) / 100 })).sort((a, b) => b.amount - a.amount);
    };
    const itemMap = new Map<string, { qty: number; amount: number; unit: string | null }>();
    for (const t of inCur) for (const l of t.lines) {
      const g = itemMap.get(l.name) || { qty: 0, amount: 0, unit: l.unit }; g.qty += l.qty; g.amount += l.amount; itemMap.set(l.name, g);
    }
    blocks[p] = {
      labels: bks.map((b) => b.label), values: values.map((v) => Math.round(v * 100) / 100),
      curLabel: cur.long, prevLabel: bks[bks.length - 2]?.long || "",
      byAccount: group((t) => (t.account as string | null)),
      byWho: group((t) => (t.who as string | null)).slice(0, 8),
      items: [...itemMap.entries()].map(([name, g]) => ({ name, qty: Math.round(g.qty * 1000) / 1000, unit: g.unit, amount: Math.round(g.amount * 100) / 100 }))
        .sort((a, b) => b.amount - a.amount).slice(0, 8),
      count: inCur.length,
    };
  }
  return <InsightsView type={type} title={meta.title} noun={meta.noun} who={meta.who} what={meta.what} list={meta.list} blocks={blocks} />;
}
