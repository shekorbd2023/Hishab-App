"use client";
import { useState } from "react";
import Link from "next/link";
import { BackButton, Seg } from "@/components/ui";
import { tk, qty as fq } from "@/lib/format";

type Period = "daily" | "weekly" | "monthly" | "quarterly";
type Row = { name: string; count: number; amount: number };
export type Block = {
  labels: string[]; values: number[]; curLabel: string; prevLabel: string; count: number;
  byAccount: Row[]; byWho: Row[]; items: { name: string; qty: number; unit: string | null; amount: number }[];
};

export default function InsightsView({ type, title, noun, who, what, list, blocks }: {
  type: string; title: string; noun: string; who: string; what: string; list: string; blocks: Record<Period, Block>;
}) {
  const [p, setP] = useState<Period>("monthly");
  const b = blocks[p];
  const cur = b.values[b.values.length - 1] || 0;
  const prev = b.values[b.values.length - 2] || 0;
  const growth = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
  const up = growth >= 0;
  const periodWord = p === "daily" ? "Today" : p === "weekly" ? "This Week" : p === "monthly" ? "This Month" : "This Quarter";
  const max = Math.max(1, ...b.values);
  const isExpense = type === "expense";

  return (
    <div>
      <div className="page-head">
        <div className="page-title"><BackButton href="/dashboard" />{title}</div>
        <Seg value={p} onChange={setP} options={[{ v: "daily", l: "Daily" }, { v: "weekly", l: "Weekly" }, { v: "monthly", l: "Monthly" }, { v: "quarterly", l: "Quarterly" }]} />
      </div>

      <div className="card ins-hero">
        <div className="ins-top">
          <div>
            <div className="sub">Total {noun} ({b.curLabel})</div>
            <div className="ins-big">{tk(cur)}</div>
            <div className={`ins-growth ${isExpense ? (up ? "neg" : "pos") : up ? "pos" : "neg"}`}>
              {up ? "↑" : "↓"} {Math.abs(growth).toFixed(2)}% <span className="sub">vs {b.prevLabel} ({tk(prev)})</span>
            </div>
          </div>
          <div className="ins-count"><b>{b.count}</b><span>{isExpense ? "expenses" : type === "sales" ? "invoices" : "bills"} {periodWord.toLowerCase()}</span></div>
        </div>
        <div className="ins-chart">
          {b.values.map((v, i) => (
            <div key={i} className={`ins-col ${i === b.values.length - 1 ? "cur" : ""}`} title={`${b.labels[i]}: ${tk(v)}`}>
              <div className="ins-val">{v ? (v >= 1000 ? `${Math.round(v / 100) / 10}k` : Math.round(v)) : ""}</div>
              <div className="ins-bar" style={{ height: `${Math.max(v ? 3 : 0, (v / max) * 100)}%` }} />
              <div className="ins-lab">{b.labels[i]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="ins-grid">
        <div className="db-card">
          <div className="db-card-h"><h2>{noun} Breakdown <span className="text-muted" style={{ fontWeight: 500, fontSize: 13 }}>({periodWord}) · by payment mode</span></h2></div>
          <RowsTable rows={b.byAccount} total={cur} unit={isExpense ? "expenses" : type === "sales" ? "sales" : "bills"} />
        </div>
        <div className="db-card">
          <div className="db-card-h"><h2>{who} <span className="text-muted" style={{ fontWeight: 500, fontSize: 13 }}>({periodWord})</span></h2></div>
          <RowsTable rows={b.byWho} total={cur} unit={isExpense ? "expenses" : type === "sales" ? "sales" : "bills"} />
        </div>
        <div className="db-card" style={{ gridColumn: "1 / -1" }}>
          <div className="db-card-h">
            <h2>{what} <span className="text-muted" style={{ fontWeight: 500, fontSize: 13 }}>({periodWord})</span></h2>
            <Link className="link" href={isExpense ? "/expense" : "/inventory"} style={{ fontSize: 13 }}>View All →</Link>
          </div>
          {b.items.length === 0 ? <div className="empty" style={{ padding: "2rem 1rem" }}>No items {periodWord.toLowerCase()}.</div> : (
            <table className="tbl">
              <thead><tr><th style={{ width: 40 }}>#</th><th>Item</th><th className="num">Quantity</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {b.items.map((it, i) => (
                  <tr key={it.name}><td className="text-muted">{i + 1}</td><td style={{ fontWeight: 600 }}>{it.name}</td>
                    <td className="num">{fq(it.qty)} {(it.unit || "").toUpperCase()}</td><td className="num" style={{ fontWeight: 600 }}>{tk(it.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div style={{ marginTop: "1rem" }}><Link className="link" href={list}>Open the full {noun.toLowerCase()} list →</Link></div>
    </div>
  );
}

function RowsTable({ rows, total, unit }: { rows: Row[]; total: number; unit: string }) {
  if (!rows.length) return <div className="empty" style={{ padding: "2rem 1rem" }}>Nothing recorded in this period.</div>;
  return (
    <div className="ins-rows">
      {rows.map((r) => (
        <div key={r.name} className="ins-row">
          <div className="between">
            <div><b>{r.name}</b> <span className="sub">· {r.count} {unit}</span></div>
            <b>{tk(r.amount)}</b>
          </div>
          <div className="ins-track"><div style={{ width: `${total > 0 ? Math.min(100, (r.amount / total) * 100) : 0}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
