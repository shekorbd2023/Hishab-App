"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Modal, useToast } from "@/components/ui";
import { fmtDate } from "@/lib/format";

type Parsed = { payload: { format: string; exported_at?: string; business?: { name?: string }; data: Record<string, unknown[]> }; file: string };

export default function BackupClient({ canRestore, businessName, counts, lastRestore }: { canRestore: boolean; businessName: string; counts: { l: string; n: number }[]; lastRestore: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast, node } = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [confirmText, setConfirmText] = useState("");

  async function exportJson() {
    setBusy(true);
    try {
      const res = await fetch("/api/export");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${businessName.replace(/[^a-z0-9]/gi, "_")}_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      toast("Backup downloaded");
    } finally { setBusy(false); }
  }

  async function pick(file?: File) {
    if (!file) return;
    setErr("");
    try {
      const payload = JSON.parse(await file.text());
      if (payload?.format !== "hishab-business-export" || !payload.data) throw new Error("bad");
      setParsed({ payload, file: file.name }); setConfirmText("");
    } catch { setErr("This file isn't a Hishab backup (.json exported from Backup & Restore)."); }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function restore() {
    if (!parsed) return;
    setBusy(true); setErr("");
    const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload: parsed.payload }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setParsed(null); toast("Restore complete"); router.refresh(); }
    else setErr(data.error || "Restore failed");
  }

  const pc = parsed ? (["parties", "items", "documents", "payments", "expenses", "accounts"] as const).map((k) => ({ k, n: (parsed.payload.data[k] || []).length })) : [];

  return (
    <div>
      <div className="page-head"><h1 className="page-title">Backup &amp; Restore</h1></div>
      {err && <div className="card" style={{ padding: ".7rem 1rem", marginBottom: "1rem", borderColor: "var(--red)", color: "var(--red)", display: "flex", gap: 8, alignItems: "center" }}><Icon name="info" size={16} />{err}</div>}
      <div className="bk-grid">
        <div className="card" style={{ padding: "1.2rem" }}>
          <div className="row"><span className="rh-ic"><Icon name="download" size={18} /></span><div><div style={{ fontWeight: 700, fontSize: 15 }}>Download Backup</div><div className="sub">One JSON file with everything in {businessName}</div></div></div>
          <div className="bk-stats">
            {counts.map((c) => <div key={c.l} className="bk-stat"><b>{c.n.toLocaleString("en-US")}</b><span>{c.l}</span></div>)}
          </div>
          <p className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: ".9rem" }}>
            Includes parties, items, accounts, all invoices with line items, payments, expenses, income, transfers, add/reduce money, stock adjustments, categories and the audit log. Keep it somewhere safe — Google Drive, email, or a USB stick.
          </p>
          <div className="row">
            <button className="btn btn-primary" onClick={exportJson} disabled={busy}><Icon name="download" size={15} />Download Backup (.json)</button>
            <Link className="btn btn-ghost" href="/reports/json-report">Full JSON Report <Icon name="chevronRight" size={14} /></Link>
          </div>
        </div>

        <div className="card" style={{ padding: "1.2rem" }}>
          <div className="row"><span className="rh-ic" style={{ background: "var(--red-soft)", color: "var(--red)" }}><Icon name="upload" size={18} /></span><div><div style={{ fontWeight: 700, fontSize: 15 }}>Restore from Backup</div><div className="sub">Replaces all data in this business</div></div></div>
          <div className="imp-drop" style={{ minHeight: 170, marginTop: ".9rem", opacity: canRestore ? 1 : .6, cursor: canRestore ? "pointer" : "not-allowed" }}
            onClick={() => canRestore && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (canRestore) pick(e.dataTransfer.files?.[0]); }}>
            <div>
              <div className="ic" style={{ width: 48, height: 48 }}><Icon name="backup" size={24} /></div>
              <div style={{ fontWeight: 600 }}><span style={{ color: "var(--brand)" }}>Choose backup file</span> or drag it here</div>
              <div className="sub" style={{ marginTop: ".25rem" }}>{canRestore ? "Hishab backup .json" : "Only the Owner or an Admin can restore"}</div>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => pick(e.target.files?.[0])} />
          <p className="sub" style={{ marginTop: ".7rem" }}>{lastRestore ? `Last restored on ${fmtDate(lastRestore)}.` : "Tip: download a fresh backup before restoring."}</p>
        </div>
      </div>

      {parsed && (
        <Modal title="Restore this backup?" onClose={() => setParsed(null)} width={520}
          footer={<>
            <button className="btn" onClick={() => setParsed(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ background: "var(--red)", borderColor: "var(--red)" }} disabled={busy || confirmText.trim().toUpperCase() !== "RESTORE"} onClick={restore}>
              {busy ? "Restoring…" : "Yes, Replace My Data"}
            </button>
          </>}>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            <b>{parsed.file}</b>{parsed.payload.business?.name ? <> · from <b>{parsed.payload.business.name}</b></> : null}
            {parsed.payload.exported_at && <> · exported {fmtDate(parsed.payload.exported_at)}</>}
          </div>
          <div className="bk-stats" style={{ margin: 0 }}>
            {pc.map((c) => <div key={c.k} className="bk-stat"><b>{c.n.toLocaleString("en-US")}</b><span style={{ textTransform: "capitalize" }}>{c.k}</span></div>)}
          </div>
          <div style={{ background: "var(--red-soft)", color: "var(--red)", borderRadius: 6, padding: ".65rem .8rem", fontSize: 12.5, display: "flex", gap: 8 }}>
            <Icon name="info" size={16} />
            <span>Everything currently in <b>{businessName}</b> — parties, items, invoices, payments, expenses and accounts — will be deleted and replaced by this file. This can&apos;t be undone.</span>
          </div>
          <div className="field">
            <label className="label">Type RESTORE to confirm</label>
            <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESTORE" autoFocus />
          </div>
        </Modal>
      )}
      {node}
    </div>
  );
}
