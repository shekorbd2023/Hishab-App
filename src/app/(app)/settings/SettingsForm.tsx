"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/Providers";
import { api } from "@/lib/clientUtil";

type Biz = { name: string; address: string; phone: string; currency_symbol: string; logo: string };
type S = { invoice_footer: string; default_tax: number; show_logo: boolean };

export default function SettingsForm({ business, settings, canEdit }: { business: Biz; settings: S; canEdit: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [f, setF] = useState({ ...business, ...settings });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) { setMsg("Logo too large (keep under 400 KB)."); return; }
    const reader = new FileReader();
    reader.onload = () => setF({ ...f, logo: String(reader.result) });
    reader.readAsDataURL(file);
  }

  async function save() {
    setBusy(true); setMsg("");
    const { ok, data } = await api("/api/settings", f);
    setBusy(false);
    if (ok) { setMsg("✅ Saved."); router.refresh(); } else setMsg("❌ " + ((data.error as string) || "Failed"));
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>{t("settings")}</h1>
      <div className="card" style={{ padding: "1.25rem", display: "grid", gap: ".7rem" }}>
        <h2 style={{ fontWeight: 700 }}>Business Profile</h2>
        <div><label className="label">{t("business_name")}</label><input className="input" value={f.name} onChange={set("name")} disabled={!canEdit} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".6rem" }}>
          <div><label className="label">{t("phone")}</label><input className="input" value={f.phone} onChange={set("phone")} disabled={!canEdit} /></div>
          <div><label className="label">Currency symbol</label><input className="input" value={f.currency_symbol} onChange={set("currency_symbol")} disabled={!canEdit} /></div>
        </div>
        <div><label className="label">{t("address")}</label><input className="input" value={f.address} onChange={set("address")} disabled={!canEdit} /></div>
        <div>
          <label className="label">Logo (shown on invoices)</label>
          <div style={{ display: "flex", gap: ".75rem", alignItems: "center" }}>
            {f.logo ? <img src={f.logo} alt="logo" style={{ height: 48, borderRadius: 8, border: "1px solid var(--border)" }} /> : <span className="text-muted" style={{ fontSize: ".8rem" }}>No logo</span>}
            {canEdit && <input type="file" accept="image/*" onChange={onLogo} />}
            {f.logo && canEdit && <button className="btn" onClick={() => setF({ ...f, logo: "" })}>Remove</button>}
          </div>
        </div>

        <h2 style={{ fontWeight: 700, marginTop: ".5rem" }}>Invoice</h2>
        <div><label className="label">Invoice footer note</label><textarea className="input" rows={2} value={f.invoice_footer} onChange={set("invoice_footer")} disabled={!canEdit} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".6rem" }}>
          <div><label className="label">Default tax %</label><input className="input" type="number" value={f.default_tax} onChange={set("default_tax")} disabled={!canEdit} /></div>
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center", fontSize: ".85rem", marginTop: "1.4rem" }}>
            <input type="checkbox" checked={f.show_logo} onChange={set("show_logo")} disabled={!canEdit} /> Show logo on invoices
          </label>
        </div>

        {msg && <p style={{ fontSize: ".9rem" }}>{msg}</p>}
        {canEdit ? (
          <div><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "…" : t("save")}</button></div>
        ) : <p className="text-muted" style={{ fontSize: ".85rem" }}>Only Owner/Admin/Partner can edit settings.</p>}
      </div>
    </div>
  );
}
