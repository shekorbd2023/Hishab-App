"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon, SearchBox, Empty } from "@/components/ui";

type R = { type: string; title: string; desc: string; group: string; icon: string; href: string };
type G = { key: string; title: string; chip: string };

export default function ReportsHub({ reports, groups }: { reports: R[]; groups: G[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return reports.filter((r) => (cat === "all" || r.group === cat) && (!s || r.title.toLowerCase().includes(s) || r.desc.toLowerCase().includes(s)));
  }, [reports, q, cat]);
  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Browse Various Reports</h1>
        <SearchBox value={q} onChange={setQ} placeholder="Search reports…" width={280} />
      </div>
      <div className="toolbar">
        <button className={`chip ${cat === "all" ? "on" : ""}`} onClick={() => setCat("all")}>All Reports</button>
        {groups.map((g) => <button key={g.key} className={`chip ${cat === g.key ? "on" : ""}`} onClick={() => setCat(g.key)}>{g.chip}</button>)}
      </div>
      {groups.map((g) => {
        const list = shown.filter((r) => r.group === g.key);
        if (!list.length) return null;
        return (
          <section key={g.key} className="rh-section">
            <h2 className="rh-title">{g.title}</h2>
            <div className="rh-grid">
              {list.map((r) => (
                <Link key={r.type} href={r.href} className="rh-card">
                  <span className={`rh-ic ${g.key === "extras" ? "x" : ""}`}><Icon name={r.icon} size={18} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span className="rh-name">{r.title}</span>
                    <span className="rh-desc">{r.desc}</span>
                  </span>
                  <Icon name="chevronRight" size={16} className="rh-go" />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {shown.length === 0 && <div className="card"><Empty title="No Reports Found" text={`No report matches “${q}”.`} icon="search" /></div>}
    </div>
  );
}
