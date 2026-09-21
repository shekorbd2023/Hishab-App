"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/Providers";

export default function BackupClient({ canRestore, businessName }: { canRestore: boolean; businessName: string }) {
  const { t } = useT();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function exportJson() {
    setBusy(true);
    const res = await fetch("/api/export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${businessName.replace(/[^a-z0-9]/gi, "_")}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBusy(false);
  }

  async function importJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("Restoring will REPLACE all current data in this business with the file's contents. Continue?")) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setBusy(true); setMsg("");
    try {
      const payload = JSON.parse(await file.text());
      const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload }) });
      const data = await res.json();
      if (res.ok) { setMsg("✅ Restore complete."); router.refresh(); }
      else setMsg("❌ " + (data.error || "Restore failed"));
    } catch {
      setMsg("❌ Invalid JSON file.");
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "1rem" }}>Backup & Restore</h1>

      <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <h2 style={{ fontWeight: 700 }}>{t("export_json")}</h2>
        <p className="text-muted" style={{ fontSize: ".85rem", margin: ".4rem 0 .9rem" }}>
          Download the entire business — parties, items, accounts, all invoices, payments, expenses, income and audit log — as one JSON file.
        </p>
        <button className="btn btn-primary" onClick={exportJson} disabled={busy}>⬇ {t("export_json")}</button>
      </div>

      <div className="card" style={{ padding: "1.25rem" }}>
        <h2 style={{ fontWeight: 700 }}>{t("import_json")}</h2>
        <p className="text-muted" style={{ fontSize: ".85rem", margin: ".4rem 0 .9rem" }}>
          Restore from a Hishab backup file. This <b>replaces</b> the current business data. Owner/Admin only.
        </p>
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={!canRestore || busy}>⬆ {t("import_json")}</button>
        {!canRestore && <p className="text-muted" style={{ fontSize: ".8rem", marginTop: ".5rem" }}>Only Owner/Admin can restore.</p>}
        <input ref={fileRef} type="file" accept=".json" hidden onChange={importJson} />
        {msg && <p style={{ marginTop: ".75rem", fontSize: ".9rem" }}>{msg}</p>}
      </div>
    </div>
  );
}
