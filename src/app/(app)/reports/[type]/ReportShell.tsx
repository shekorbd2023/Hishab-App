"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Report } from "@/lib/reports";
import { downloadCsv } from "@/lib/clientUtil";

export default function ReportShell({ report, type, from, to, showDates }: { report: Report; type: string; from: string; to: string; showDates: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [tt, setTt] = useState(to);

  function apply() {
    router.push(`/reports/${type}?from=${f}&to=${tt}`);
  }
  function exportCsv() {
    downloadCsv(`${type}.csv`, report.headers, report.rows);
  }

  return (
    <div>
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <Link href="/reports" className="btn" style={{ padding: ".3rem .6rem" }}>←</Link>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>{report.title}</h1>
        </div>
        <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap", alignItems: "end" }}>
          {showDates && (
            <>
              <div><label className="label">From</label><input className="input" type="date" value={f} onChange={(e) => setF(e.target.value)} /></div>
              <div><label className="label">To</label><input className="input" type="date" value={tt} onChange={(e) => setTt(e.target.value)} /></div>
              <button className="btn btn-primary" onClick={apply}>Apply</button>
            </>
          )}
          <button className="btn" onClick={exportCsv}>⬇ CSV</button>
          <button className="btn" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>

      {report.summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: ".6rem", marginBottom: "1rem" }}>
          {report.summary.map((s) => (
            <div key={s.label} className="card" style={{ padding: ".9rem" }}>
              <div className="text-muted" style={{ fontSize: ".8rem" }}>{s.label}</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card print-area" style={{ padding: "1rem", overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr>{report.headers.map((h, i) => <th key={i} style={{ textAlign: i === report.headers.length - 1 ? "right" : "left" }}>{h}</th>)}</tr></thead>
          <tbody>
            {report.rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} style={{ textAlign: j === r.length - 1 ? "right" : "left" }}>{c}</td>)}</tr>
            ))}
            {report.rows.length === 0 && <tr><td colSpan={report.headers.length} className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>No data in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
