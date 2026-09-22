"use client";
import { useMemo, useState } from "react";
import { Icon, SearchBox, FilterSelect, DateFilter, rangeFor, SplitButton, Empty, Avatar, Modal, type DateRange } from "@/components/ui";
import { downloadXlsx, downloadCsvSheet, safeFile, type Sheet } from "@/components/ReportView";
import { fmtDate, TODAY } from "@/lib/format";

export type AuditRow = { id: string; user_name: string | null; action: string; entity: string; entity_id: string | null; summary: string | null; before_json: string | null; after_json: string | null; created_at: string };

const ACTION_LABEL: Record<string, string> = { create: "Created", update: "Updated", delete: "Deleted" };
const PILL: Record<string, string> = { create: "pill-paid", update: "pill-partial", delete: "pill-unpaid" };
const cap = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
// audit timestamps are UTC ISO — show them in Dhaka time
const local = (iso: string) => { const d = new Date(Date.parse(iso) + 6 * 3600000).toISOString(); return { date: d.slice(0, 10), time: d.slice(11, 16) }; };

function pretty(s: string | null) {
  if (!s) return "";
  try { return JSON.stringify(JSON.parse(s), (k, v) => (typeof v === "string" && v.startsWith("data:") ? "[image]" : v), 2); } catch { return s + (s.length >= 6000 ? "…" : ""); }
}

export default function AuditClient({ rows, businessName }: { rows: AuditRow[]; businessName: string }) {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [user, setUser] = useState("all");
  const [range, setRange] = useState<DateRange>(rangeFor("all"));
  const [open, setOpen] = useState<AuditRow | null>(null);

  const entities = useMemo(() => [...new Set(rows.map((r) => r.entity))].sort(), [rows]);
  const users = useMemo(() => [...new Set(rows.map((r) => r.user_name || "System"))].sort(), [rows]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      const d = local(r.created_at).date;
      return (action === "all" || r.action === action) && (entity === "all" || r.entity === entity) && (user === "all" || (r.user_name || "System") === user)
        && d >= range.from && d <= range.to
        && (!s || (r.summary || "").toLowerCase().includes(s) || r.entity.toLowerCase().includes(s) || (r.user_name || "").toLowerCase().includes(s));
    });
  }, [rows, q, action, entity, user, range]);

  function sheet(): Sheet {
    return {
      title: `${businessName} — Audit Log`, subtitle: range.label,
      header: ["Date", "Time", "User", "Action", "Module", "Details"],
      rows: list.map((r) => { const t = local(r.created_at); return [fmtDate(t.date), t.time, r.user_name || "System", ACTION_LABEL[r.action] || r.action, cap(r.entity), r.summary || ""]; }),
    };
  }
  const fname = (ext: string) => safeFile(`Audit Log_${range.key === "all" ? TODAY() : `${range.from}_TO_${range.to}`}`) + "." + ext;

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Audit Log <span className="count">({rows.length})</span></h1>
        <SplitButton label="Download Excel" icon="download" onClick={() => downloadXlsx(sheet(), fname("xlsx"))} disabled={!list.length}
          items={[{ label: "Download CSV", icon: "download", onClick: () => downloadCsvSheet(sheet(), fname("csv")) }, { label: "Print", icon: "printer", onClick: () => window.print() }]} />
      </div>
      <div className="toolbar no-print">
        <SearchBox value={q} onChange={setQ} placeholder="Search activity…" width={250} />
        <FilterSelect value={action} onChange={setAction} options={[{ v: "all", l: "All Actions" }, { v: "create", l: "Created" }, { v: "update", l: "Updated" }, { v: "delete", l: "Deleted" }]} />
        <FilterSelect value={entity} onChange={setEntity} options={[{ v: "all", l: "All Modules" }, ...entities.map((e) => ({ v: e, l: cap(e) }))]} />
        <FilterSelect value={user} onChange={setUser} options={[{ v: "all", l: "All Users" }, ...users.map((u) => ({ v: u, l: u }))]} />
        <DateFilter value={range} onChange={setRange} />
      </div>
      {list.length === 0 ? (
        <div className="card"><Empty title={rows.length ? "No Activity Found" : "No Activity Yet"} text={rows.length ? "No entries match these filters." : "Every create, edit and delete in this business will be recorded here."} icon="audit" /></div>
      ) : (
        <div className="table-wrap scroll-thin">
          <table className="tbl">
            <thead><tr><th>Date &amp; Time</th><th>User</th><th>Action</th><th>Module</th><th>Details</th><th /></tr></thead>
            <tbody>
              {list.map((r) => {
                const t = local(r.created_at);
                const hasDiff = !!(r.before_json || r.after_json);
                return (
                  <tr key={r.id} className={hasDiff ? "clickable" : ""} onClick={() => hasDiff && setOpen(r)}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(t.date)}<div className="sub">{t.time}</div></td>
                    <td><span className="row"><Avatar name={r.user_name || "System"} soft />{r.user_name || "System"}</span></td>
                    <td><span className={`pill ${PILL[r.action] || "pill-muted"}`}>{ACTION_LABEL[r.action] || r.action}</span></td>
                    <td>{cap(r.entity)}</td>
                    <td className="text-muted" style={{ maxWidth: 520 }}>{r.summary || "--"}</td>
                    <td className="num">{hasDiff && <Icon name="eye" size={15} style={{ color: "var(--muted)" }} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <Modal title={`${ACTION_LABEL[open.action] || open.action} ${cap(open.entity)}`} onClose={() => setOpen(null)} width={760}>
          <div className="sub">{fmtDate(local(open.created_at).date)} {local(open.created_at).time} · {open.user_name || "System"} · {open.summary}</div>
          <div style={{ display: "grid", gridTemplateColumns: open.before_json && open.after_json ? "1fr 1fr" : "1fr", gap: ".75rem" }}>
            {open.before_json && <div><div className="label">Before</div><pre className="scroll-thin" style={{ fontSize: 11.5, background: "var(--hover)", padding: ".6rem", borderRadius: 6, maxHeight: 380, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{pretty(open.before_json)}</pre></div>}
            {open.after_json && <div><div className="label">After</div><pre className="scroll-thin" style={{ fontSize: 11.5, background: "var(--brand-soft)", padding: ".6rem", borderRadius: 6, maxHeight: 380, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{pretty(open.after_json)}</pre></div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
