"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";

export default function JsonReportClient({ businessName, counts, snapshot }: { businessName: string; counts: { l: string; n: number }[]; snapshot: { l: string; v: string; t?: string }[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function dl(report: boolean) {
    setBusy(report ? "r" : "b");
    try {
      const res = await fetch(`/api/export${report ? "?report=1" : ""}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${businessName.replace(/[^a-z0-9]/gi, "_")}_${report ? "full_report" : "backup"}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
    } finally { setBusy(null); }
  }
  return (
    <div>
      <div className="page-head">
        <div className="page-title"><Link href="/reports" className="back-btn" aria-label="Back"><Icon name="back" size={18} /></Link>Full JSON Business Report</div>
        <button className="btn btn-primary" onClick={() => dl(true)} disabled={!!busy}><Icon name="download" size={15} />{busy === "r" ? "Preparing…" : "Download Full JSON Report"}</button>
      </div>
      <div className="rv-kpis">
        {snapshot.map((s) => <div key={s.l} className="kpi"><div className={`v ${s.t || ""}`}>{s.v}</div><div className="l">{s.l}</div></div>)}
      </div>
      <div className="card" style={{ padding: "1.1rem 1.2rem" }}>
        <div style={{ fontWeight: 700 }}>What&apos;s inside</div>
        <p className="text-muted" style={{ fontSize: 13, margin: ".3rem 0 0", lineHeight: 1.6 }}>
          One JSON file with every record of <b>{businessName}</b> plus a computed snapshot — party balances (To Receive / To Give), account balances,
          item stock with value, expense totals by category and month-by-month sales. Use it for your accountant, for analysis in other tools, or as an archive.
        </p>
        <div className="bk-stats">
          {counts.map((c) => <div key={c.l} className="bk-stat"><b>{c.n.toLocaleString("en-US")}</b><span>{c.l}</span></div>)}
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => dl(true)} disabled={!!busy}><Icon name="download" size={15} />Full JSON Report</button>
          <button className="btn" onClick={() => dl(false)} disabled={!!busy}><Icon name="backup" size={15} />{busy === "b" ? "Preparing…" : "Raw Backup (restorable)"}</button>
          <Link href="/backup" className="btn btn-ghost">Backup &amp; Restore <Icon name="chevronRight" size={14} /></Link>
        </div>
      </div>
    </div>
  );
}
