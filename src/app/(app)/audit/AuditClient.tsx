"use client";
import { useMemo, useState } from "react";
import { useT } from "@/components/Providers";
import { PageHeader } from "@/components/Modal";
import { downloadCsv } from "@/lib/clientUtil";

type Row = { id: string; user_name: string | null; action: string; entity: string; summary: string | null; created_at: string };

export default function AuditClient({ rows }: { rows: Row[] }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => rows.filter((r) =>
    !q || (r.summary || "").toLowerCase().includes(q.toLowerCase()) || r.entity.includes(q.toLowerCase()) || (r.user_name || "").toLowerCase().includes(q.toLowerCase())
  ), [rows, q]);

  return (
    <div>
      <PageHeader title={t("audit_log")} count={rows.length}>
        <button className="btn" onClick={() => downloadCsv("audit_log.csv", ["time", "user", "action", "entity", "summary"], filtered.map((r) => [r.created_at, r.user_name, r.action, r.entity, r.summary]))}>⬇ {t("export_csv")}</button>
      </PageHeader>
      <div className="card" style={{ padding: "1rem" }}>
        <input className="input" placeholder={`${t("search")}…`} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 300, marginBottom: ".75rem" }} />
        <div style={{ overflowX: "auto" }} className="scroll-thin">
          <table className="tbl">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Summary</th></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="text-muted" style={{ whiteSpace: "nowrap" }}>{r.created_at.slice(0, 19).replace("T", " ")}</td>
                  <td>{r.user_name || "—"}</td>
                  <td><span className={`pill ${r.action === "delete" ? "pill-red" : "pill-green"}`}>{r.action}</span></td>
                  <td>{r.entity}</td>
                  <td className="text-muted">{r.summary || "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>{t("no_data")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
