"use client";
// Karbar "Add New Party" dialog — also used for Edit Party.
import { useRef, useState } from "react";
import { Modal, Icon, Picker, Seg, shrinkImage, post } from "@/components/ui";
import { TODAY } from "@/lib/format";

export type PartyFormValue = {
  id?: string;
  name: string;
  phone: string | null;
  type: string;
  category: string | null;
  opening_balance: number;
  as_of_date?: string | null;
  address: string | null;
  email?: string | null;
  vat?: string | null;
  photo?: string | null;
};

export default function PartyForm({
  party, categories, onClose, onSaved,
}: {
  party?: PartyFormValue | null;
  categories: string[];
  onClose: () => void;
  onSaved: (id: string, andNew: boolean) => void;
}) {
  const blank = {
    name: "", phone: "", category: "", type: "customer", opening: "", payType: "receive" as "receive" | "give",
    asOf: TODAY(), address: "", email: "", vat: "", photo: "",
  };
  const fromParty = party ? {
    name: party.name, phone: party.phone || "", category: party.category || "", type: party.type === "supplier" ? "supplier" : "customer",
    opening: party.opening_balance ? String(Math.abs(party.opening_balance)) : "", payType: (party.opening_balance < 0 ? "give" : "receive") as "receive" | "give",
    asOf: party.as_of_date || TODAY(), address: party.address || "", email: party.email || "", vat: party.vat || "", photo: party.photo || "",
  } : blank;
  const [f, setF] = useState(fromParty);
  const [tab, setTab] = useState<"credit" | "extra">("credit");
  const [cats, setCats] = useState<string[]>(categories);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((o) => ({ ...o, [k]: v }));

  async function save(andNew: boolean) {
    if (!f.name.trim()) { setErr("Full name is required."); return; }
    setBusy(true); setErr(null);
    const payload = {
      name: f.name.trim(), phone: f.phone.trim(), category: f.category.trim(), type: f.type,
      opening_balance: Number(f.opening) || 0, payment_type: f.payType, as_of_date: f.asOf,
      address: f.address.trim(), email: f.email.trim(), vat: f.vat.trim(), photo: f.photo || null,
    };
    const { ok, data } = await post<{ id: string }>("/api/parties", party?.id ? { op: "update", id: party.id, ...payload } : { op: "create", ...payload });
    setBusy(false);
    if (!ok) { setErr(data.error || "Could not save the party."); return; }
    const id = party?.id || data.id;
    if (andNew) { setF({ ...blank, type: f.type }); setTab("credit"); }
    onSaved(id, andNew);
  }

  async function addCategory(name: string) {
    const n = name.trim();
    if (!n) return;
    await post("/api/parties", { op: "add_category", name: n });
    setCats((c) => (c.includes(n) ? c : [...c, n].sort()));
    set("category", n);
  }

  async function pickPhoto(file?: File) {
    if (!file) return;
    set("photo", await shrinkImage(file, 180));
  }

  return (
    <Modal
      title={party?.id ? "Edit Party" : "Add New Party"}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn" onClick={onClose}>Close</button>
          {!party?.id && <button className="btn btn-soft" disabled={busy} onClick={() => save(true)}>Save &amp; New</button>}
          <button className="btn btn-primary" disabled={busy} onClick={() => save(false)}>{busy ? "Saving…" : "Save Party"}</button>
        </>
      }
    >
      <div className="md-photo-wrap">
        <button type="button" className="md-photo" onClick={() => fileRef.current?.click()} title="Upload photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {f.photo ? <img src={f.photo} alt="" /> : <Icon name="camera" size={24} />}
        </button>
        <div style={{ display: "grid", gap: 4 }}>
          <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}><Icon name="upload" size={14} />Upload Photo</button>
          {f.photo && <button type="button" className="btn btn-sm btn-ghost" style={{ color: "var(--red)" }} onClick={() => set("photo", "")}>Remove</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      <div className="field">
        <label className="label">Full Name <span className="req">*</span></label>
        <input className="input" value={f.name} autoFocus placeholder="Enter party name" onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="form-grid">
        <div className="field">
          <label className="label">Phone Number</label>
          <input className="input" value={f.phone} inputMode="tel" placeholder="01XXXXXXXXX" onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Party Category</label>
          <Picker
            value={cats.includes(f.category) ? f.category : null}
            options={cats.map((c) => ({ id: c, label: c }))}
            onChange={(id) => { if (id) set("category", id); }}
            placeholder="Select or type category"
            allowFree freeText={f.category} onFreeText={(t) => set("category", t)}
            onCreate={addCategory} createLabel="Create category"
          />
        </div>
      </div>
      <div className="field">
        <label className="label">Party Type</label>
        <Seg value={f.type} onChange={(v) => set("type", v)} options={[{ v: "customer", l: "Customer" }, { v: "supplier", l: "Supplier" }]} />
      </div>

      <div className="tabs md-tabs">
        <button type="button" className={tab === "credit" ? "on" : ""} onClick={() => setTab("credit")}>Credit Info</button>
        <button type="button" className={tab === "extra" ? "on" : ""} onClick={() => setTab("extra")}>Additional Info</button>
      </div>

      {tab === "credit" ? (
        <>
          <div className="form-grid">
            <div className="field">
              <label className="label">Opening Balance</label>
              <div className="input-group">
                <span className="prefix">Tk.</span>
                <input className="input" type="number" min={0} step="any" value={f.opening} placeholder="0" onChange={(e) => set("opening", e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label className="label">As of Date</label>
              <input className="input" type="date" value={f.asOf} onChange={(e) => set("asOf", e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="label">Payment Type</label>
            <div className="md-radio">
              <button type="button" className={f.payType === "receive" ? "on" : ""} onClick={() => set("payType", "receive")}><span className="dot" />To Receive</button>
              <button type="button" className={f.payType === "give" ? "on give" : ""} onClick={() => set("payType", "give")}><span className="dot" />To Give</button>
            </div>
            <div className="sub" style={{ marginTop: 4 }}>
              {f.payType === "receive" ? "The party owes you this amount (receivable)." : "You owe the party this amount (payable)."}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label className="label">Address</label>
            <textarea className="input" rows={2} value={f.address} placeholder="Enter address" onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="label">Email</label>
              <input className="input" type="email" value={f.email} placeholder="name@example.com" onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">VAT Number</label>
              <input className="input" value={f.vat} placeholder="BIN / VAT No." onChange={(e) => set("vat", e.target.value)} />
            </div>
          </div>
        </>
      )}
      {err && <div className="md-danger-note">{err}</div>}
    </Modal>
  );
}
