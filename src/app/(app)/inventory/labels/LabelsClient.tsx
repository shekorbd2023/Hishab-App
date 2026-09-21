"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { code128SVG } from "@/lib/barcode";

type Item = { id: string; name: string; code: string | null; sales_price: number };
const m = (n: number, s: string) => `${s} ${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function LabelsClient({ items, symbol, businessName }: { items: Item[]; symbol: string; businessName: string }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const shown = useMemo(() => items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase())), [items, q]);
  const labels = useMemo(() => {
    const out: Item[] = [];
    for (const it of items) {
      const n = qty[it.id] || 0;
      for (let i = 0; i < n; i++) out.push(it);
    }
    return out;
  }, [items, qty]);
  const setN = (id: string, n: number) => setQty((s) => ({ ...s, [id]: Math.max(0, n) }));

  return (
    <div>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <Link href="/inventory" className="btn" style={{ padding: ".3rem .6rem" }}>←</Link>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Barcode Labels</h1>
        </div>
        <button className="btn btn-primary" onClick={() => window.print()} disabled={labels.length === 0}>🖨 Print {labels.length ? `(${labels.length})` : ""}</button>
      </div>

      <div className="no-print card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <input className="input" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280, marginBottom: ".75rem" }} />
        <div style={{ overflowX: "auto" }} className="scroll-thin">
          <table className="tbl">
            <thead><tr><th>Item</th><th>Code</th><th style={{ textAlign: "right" }}>Price</th><th style={{ textAlign: "right" }}>Labels</th></tr></thead>
            <tbody>
              {shown.map((it) => (
                <tr key={it.id}>
                  <td>{it.name}</td>
                  <td className="text-muted">{it.code || it.id.slice(0, 8)}</td>
                  <td style={{ textAlign: "right" }}>{m(it.sales_price, symbol)}</td>
                  <td style={{ textAlign: "right" }}>
                    <input className="input" type="number" min={0} style={{ width: 70 }} value={qty[it.id] || 0} onChange={(e) => setN(it.id, Number(e.target.value))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="print-area" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {labels.length === 0 && <p className="no-print text-muted">Set a label count next to items, then Print.</p>}
        {labels.map((it, i) => {
          const value = it.code || it.id.slice(0, 12);
          return (
            <div key={i} style={{ width: 160, border: "1px solid var(--border)", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{businessName}</div>
              <div style={{ fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
              <div dangerouslySetInnerHTML={{ __html: code128SVG(value, { height: 40, module: 1.3 }) }} style={{ margin: "2px 0" }} />
              <div style={{ fontSize: 9, letterSpacing: 1 }}>{value}</div>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{m(it.sales_price, symbol)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
