"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, post, shrinkImage, useToast } from "@/components/ui";
import { PageTitle, Section } from "../SettingsKit";

const CATEGORIES = ["Agriculture", "Grocery", "Pharmacy", "Clothing & Fashion", "Electronics", "Restaurant & Food", "Cosmetics", "Hardware", "Stationery", "Service", "Other"];
const TYPES = ["Retailer", "Wholesaler", "Distributor", "Manufacturer", "Service"];
const DIVISIONS = ["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"];

export default function BusinessProfile({ initial, bankCount, canEdit }: { initial: Record<string, string | null>; bankCount: number; canEdit: boolean }) {
  const router = useRouter();
  const { toast, node } = useToast();
  const [f, setF] = useState(() => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v ?? ""])) as Record<string, string>);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((o) => ({ ...o, [k]: e.target.value }));

  async function saveLogo(logo: string) {
    setF((o) => ({ ...o, logo }));
    const { ok, data } = await post("/api/settings", { op: "business", logo });
    if (!ok) { toast(data.error || "Could not save logo"); return; }
    toast(logo ? "Logo updated — it now shows in the sidebar, on invoices, receipts and cards" : "Logo removed");
    router.refresh();
  }
  async function pick(files: FileList | null) {
    const fl = files?.[0]; if (!fl) return;
    try { await saveLogo(await shrinkImage(fl, 400, fl.type === "image/png" ? "image/png" : "image/jpeg")); }
    catch { toast("Could not read that image"); }
  }
  async function save() {
    if (!f.name.trim()) { toast("Business name is required"); return; }
    setBusy(true);
    const { logo: _logo, ...rest } = f; void _logo;
    const { ok, data } = await post("/api/settings", { op: "business", ...rest });
    setBusy(false);
    if (!ok) { toast(data.error || "Could not save"); return; }
    toast("Business profile saved"); router.refresh();
  }

  return (
    <div>
      <PageTitle>Business Profile</PageTitle>
      <Section title="Business Logo" hint="Shown when Hishab opens, in the sidebar, and printed on every invoice, money receipt, business card and greeting card.">
        <div className="logo-drop">
          <div className="logo-box" onClick={() => canEdit && file.current?.click()} title="Upload logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f.logo ? <img src={f.logo} alt="Business logo" /> : <div style={{ textAlign: "center" }}><Icon name="camera" size={28} /><div className="sub">Add logo</div></div>}
          </div>
          <div style={{ display: "grid", gap: ".5rem" }}>
            <div style={{ fontWeight: 700 }}>{f.name || "Your business"}</div>
            <div className="sub">PNG or JPG, square works best. It is resized automatically.</div>
            {canEdit && (
              <div className="row">
                <button className="btn btn-primary" onClick={() => file.current?.click()}><Icon name="upload" size={15} />{f.logo ? "Change Logo" : "Upload Logo"}</button>
                {f.logo && <button className="btn btn-danger" onClick={() => saveLogo("")}><Icon name="trash" size={15} />Remove</button>}
              </div>
            )}
          </div>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        </div>
      </Section>

      <Section title="Basic Information">
        <div className="form-grid" style={{ padding: "1rem" }}>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label className="label">Business Name <span className="req">*</span></label><input className="input" value={f.name} onChange={set("name")} disabled={!canEdit} /></div>
          <div className="field"><label className="label">Business Contact Number</label><input className="input" value={f.phone} onChange={set("phone")} disabled={!canEdit} /></div>
          <div className="field"><label className="label">Business Email</label><input className="input" type="email" value={f.email} onChange={set("email")} disabled={!canEdit} /></div>
          <div className="field"><label className="label">Business Category</label>
            <select className="input" value={f.category} onChange={set("category")} disabled={!canEdit}><option value="">Select…</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label className="label">Business Type</label>
            <select className="input" value={f.biz_type} onChange={set("biz_type")} disabled={!canEdit}><option value="">Select…</option>{TYPES.map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
      </Section>

      <Section title="Address Information">
        <div className="form-grid" style={{ padding: "1rem" }}>
          <div className="field"><label className="label">Division</label>
            <select className="input" value={f.division} onChange={set("division")} disabled={!canEdit}><option value="">Select…</option>{DIVISIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label className="label">District</label><input className="input" value={f.district} onChange={set("district")} disabled={!canEdit} /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label className="label">Street Address</label><input className="input" value={f.address} onChange={set("address")} disabled={!canEdit} /></div>
        </div>
      </Section>

      <Section title="Financial Information">
        <div className="form-grid" style={{ padding: "1rem" }}>
          <div className="field"><label className="label">Registration Number (Trade licence / BIN)</label><input className="input" value={f.reg_no} onChange={set("reg_no")} disabled={!canEdit} /></div>
          <div className="field"><label className="label">Bank Accounts</label>
            <Link href="/accounts" className="input" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none" }}>Total {bankCount} bank / wallet accounts<Icon name="chevronRight" size={14} /></Link></div>
        </div>
      </Section>

      {canEdit && <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary btn-lg" onClick={save} disabled={busy}>Save Details</button></div>}
      {node}
    </div>
  );
}
