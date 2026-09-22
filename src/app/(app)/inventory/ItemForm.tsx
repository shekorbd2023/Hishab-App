"use client";
// Karbar "Add New Item" page: name, category, type; tabs Stock Details / Others; Save & New · Add Item.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackButton, Icon, Modal, Seg, Switch, post, shrinkImage, useToast } from "@/components/ui";

export type ItemValue = {
  id?: string; name: string; category: string | null; type: string; code: string | null;
  sales_price: number; purchase_price: number; mrp_price: number; wholesale_price: number; min_wholesale_qty: number;
  unit: string | null; secondary_unit: string | null; conversion_rate: number; opening_stock: number; low_stock_alert: number;
  location: string | null; description: string | null; image: string | null;
};

const UNITS = ["pcs", "KG", "GM", "LTR", "ML", "BOX", "PAC", "CAN", "BTL", "DZN", "BAG", "JAR", "PAIR", "SET", "MTR", "FT", "SQF", "CARTON"];
const s = (n: number | null | undefined) => (n ? String(n) : "");

export default function ItemForm({ initial, categories, stock }: { initial?: ItemValue; categories: string[]; stock?: number }) {
  const router = useRouter();
  const { toast, node } = useToast();
  const edit = !!initial?.id;
  const blank = {
    name: "", category: categories.includes("General") ? "General" : categories[0] || "", type: "Product", code: "",
    sales_price: "", purchase_price: "", mrp_price: "", wholesale_price: "", min_wholesale_qty: "",
    unit: "pcs", secondary_unit: "", conversion_rate: "", opening_stock: "", low_stock_alert: "",
    location: "", description: "", image: "",
  };
  const fromInit = initial ? {
    name: initial.name, category: initial.category || "", type: initial.type || "Product", code: initial.code || "",
    sales_price: s(initial.sales_price), purchase_price: s(initial.purchase_price), mrp_price: s(initial.mrp_price),
    wholesale_price: s(initial.wholesale_price), min_wholesale_qty: s(initial.min_wholesale_qty),
    unit: initial.unit || "pcs", secondary_unit: initial.secondary_unit || "", conversion_rate: s(initial.conversion_rate),
    opening_stock: s(initial.opening_stock), low_stock_alert: s(initial.low_stock_alert),
    location: initial.location || "", description: initial.description || "", image: initial.image || "",
  } : blank;
  const [f, setF] = useState(fromInit);
  const [cats, setCats] = useState(categories);
  const [tab, setTab] = useState<"stock" | "others">("stock");
  const [lowOn, setLowOn] = useState(!!initial?.low_stock_alert);
  const [unitDlg, setUnitDlg] = useState(false);
  const [catDlg, setCatDlg] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const service = f.type === "Service";

  async function save(andNew: boolean) {
    if (!f.name.trim()) { setErr("Item name is required."); nameRef.current?.focus(); return; }
    setBusy(true); setErr("");
    const body = {
      op: edit ? "update" : "create", id: initial?.id, name: f.name.trim(), category: f.category || null, type: f.type,
      code: f.code.trim() || null, sales_price: f.sales_price, purchase_price: f.purchase_price, mrp_price: f.mrp_price,
      wholesale_price: f.wholesale_price, min_wholesale_qty: f.min_wholesale_qty, unit: f.unit || "pcs",
      secondary_unit: f.secondary_unit || null, conversion_rate: f.conversion_rate,
      opening_stock: service ? 0 : f.opening_stock, low_stock_alert: lowOn && !service ? f.low_stock_alert : 0,
      location: f.location.trim() || null, description: f.description.trim() || null, image: f.image || null,
    };
    const { ok, data } = await post<{ id: string }>("/api/items", body);
    setBusy(false);
    if (!ok) { setErr(data.error || "Could not save the item."); return; }
    if (andNew) {
      toast(`${f.name.trim()} saved`);
      setF({ ...blank, category: f.category, unit: f.unit }); setLowOn(false); setTab("stock");
      setTimeout(() => nameRef.current?.focus(), 30);
      router.refresh();
      return;
    }
    router.push(`/inventory/${edit ? initial!.id : data.id}`);
    router.refresh();
  }

  async function pickImage(file?: File) {
    if (!file) return;
    try { set("image", await shrinkImage(file, 500)); } catch { toast("Could not read the image"); }
  }

  return (
    <div className="md-form-page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div className="page-title"><BackButton href={edit ? `/inventory/${initial!.id}` : "/inventory"} />{edit ? "Edit Item" : "Add New Item"}</div>
      </div>
      <div className="card md-form-card">
        <div className="field">
          <label className="label">Item Name <span className="req">*</span></label>
          <input ref={nameRef} className="input" autoFocus value={f.name} placeholder="eg. Noodles" onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label className="label between"><span>Item Category</span>
              <button type="button" className="link" style={{ background: "none", border: 0, cursor: "pointer", fontSize: 12 }} onClick={() => setCatDlg(true)}>+ Add Category</button>
            </label>
            <select className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">No category</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Item Type</label>
            <Seg value={f.type as "Product" | "Service"} onChange={(v) => set("type", v)} options={[{ v: "Product", l: "Product" }, { v: "Service", l: "Service" }]} />
          </div>
        </div>

        <div className="tabs md-tabs">
          <button type="button" className={tab === "stock" ? "on" : ""} onClick={() => setTab("stock")}>{service ? "Pricing" : "Stock Details"}</button>
          <button type="button" className={tab === "others" ? "on" : ""} onClick={() => setTab("others")}>Others</button>
        </div>

        {tab === "stock" ? (
          <>
            <div className="form-grid">
              {!service && (
                <div className="field">
                  <label className="label">{edit ? "Opening Stock" : "Opening Stock"}</label>
                  <div className="input-group has-suffix">
                    <input className="input" style={{ paddingLeft: ".7rem" }} inputMode="decimal" value={f.opening_stock} placeholder="0" onChange={(e) => set("opening_stock", e.target.value)} />
                    <span className="suffix">{(f.unit || "pcs").toUpperCase()}</span>
                  </div>
                  {edit && stock !== undefined && <div className="sub">Current stock: {stock} {(f.unit || "pcs").toUpperCase()} (use Adjust Stock for changes)</div>}
                </div>
              )}
              <div className="field">
                <label className="label">Measuring Unit</label>
                <button type="button" className="input" style={{ textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }} onClick={() => setUnitDlg(true)}>
                  <span>{(f.unit || "pcs").toUpperCase()}{f.secondary_unit ? ` · 1 ${f.unit.toUpperCase()} = ${f.conversion_rate || "?"} ${f.secondary_unit.toUpperCase()}` : ""}</span>
                  <Icon name="chevronDown" size={14} />
                </button>
              </div>
            </div>
            <div className="form-grid">
              <Money label="Sales Price" v={f.sales_price} on={(v) => set("sales_price", v)} />
              <Money label="Purchase Price" v={f.purchase_price} on={(v) => set("purchase_price", v)} />
              <Money label="MRP Price" v={f.mrp_price} on={(v) => set("mrp_price", v)} />
              <Money label="Wholesale Price" v={f.wholesale_price} on={(v) => set("wholesale_price", v)} />
              <div className="field">
                <label className="label">Min. Wholesale Quantity</label>
                <input className="input" inputMode="decimal" value={f.min_wholesale_qty} placeholder="0" onChange={(e) => set("min_wholesale_qty", e.target.value)} />
              </div>
            </div>
            {!service && (
              <div className="md-balcard" style={{ marginBottom: 0 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Low Stock Alert</div>
                  <div className="l">Get a warning when the stock goes below this quantity.</div>
                </div>
                <div className="row" style={{ gap: ".6rem" }}>
                  {lowOn && <input className="input" style={{ width: 110 }} inputMode="decimal" value={f.low_stock_alert} placeholder="Qty" onChange={(e) => set("low_stock_alert", e.target.value)} />}
                  <Switch on={lowOn} onChange={setLowOn} />
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="form-grid">
              <div className="field">
                <label className="label">Item Code</label>
                <div className="row" style={{ gap: ".4rem" }}>
                  <input className="input" value={f.code} placeholder="Barcode / SKU" onChange={(e) => set("code", e.target.value)} />
                  <button type="button" className="btn" onClick={() => set("code", String(Date.now()).slice(-10))}>Generate</button>
                </div>
              </div>
              <div className="field">
                <label className="label">Location</label>
                <input className="input" value={f.location} placeholder="Shelf / rack / godown" onChange={(e) => set("location", e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label className="label">Description</label>
              <textarea className="input" rows={3} value={f.description} placeholder="Enter description" onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Item Image</label>
              <div className="row" style={{ gap: ".75rem" }}>
                <button type="button" className="md-img-box" onClick={() => fileRef.current?.click()}>
                  {f.image ? <img src={f.image} alt="" /> : <span><Icon name="camera" size={20} /><br />Add Image</span>}
                </button>
                {f.image && <button type="button" className="btn btn-sm" onClick={() => set("image", "")}><Icon name="trash" size={14} />Remove</button>}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
              </div>
            </div>
          </>
        )}

        {err && <div className="neg" style={{ fontSize: 12.5 }}>{err}</div>}
        <div className="md-form-foot">
          {!edit && <button className="btn" onClick={() => save(true)} disabled={busy}>Save &amp; New</button>}
          <button className="btn btn-primary" onClick={() => save(false)} disabled={busy}>{busy ? "Saving…" : edit ? "Update Item" : "Add Item"}</button>
        </div>
      </div>

      {unitDlg && <UnitDialog unit={f.unit} sec={f.secondary_unit} rate={f.conversion_rate} onClose={() => setUnitDlg(false)}
        onSave={(u, s2, r) => { setF((x) => ({ ...x, unit: u, secondary_unit: s2, conversion_rate: r })); setUnitDlg(false); }} />}
      {catDlg && <CategoryDialog onClose={() => setCatDlg(false)} onSaved={(n) => { setCats((c) => Array.from(new Set([...c, n])).sort()); set("category", n); setCatDlg(false); }} />}
      {node}
    </div>
  );
}

function Money({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <div className="input-group"><span className="prefix">Tk.</span>
        <input className="input" inputMode="decimal" value={v} placeholder="0" onChange={(e) => on(e.target.value)} /></div>
    </div>
  );
}

function UnitDialog({ unit, sec, rate, onClose, onSave }: { unit: string; sec: string; rate: string; onClose: () => void; onSave: (u: string, s: string, r: string) => void }) {
  const [u, setU] = useState(unit || "pcs");
  const [s2, setS2] = useState(sec);
  const [r, setR] = useState(rate);
  const opts = Array.from(new Set([u, ...UNITS].filter(Boolean)));
  return (
    <Modal title="Select Measuring Unit" onClose={onClose} width={440} footer={
      <><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onSave(u, s2, s2 ? r : "")}>Save</button></>
    }>
      <div className="form-grid">
        <div className="field">
          <label className="label">Primary Unit</label>
          <input className="input" list="units-list" value={u} onChange={(e) => setU(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Secondary Unit</label>
          <input className="input" list="units-list" value={s2} placeholder="None" onChange={(e) => setS2(e.target.value)} />
        </div>
      </div>
      <datalist id="units-list">{opts.map((x) => <option key={x} value={x} />)}</datalist>
      {s2 && (
        <div className="field">
          <label className="label">Conversion Rate</label>
          <div className="row" style={{ gap: ".5rem" }}>
            <span className="sub">1 {u.toUpperCase()} =</span>
            <input className="input" style={{ width: 120 }} inputMode="decimal" value={r} placeholder="0" onChange={(e) => setR(e.target.value)} />
            <span className="sub">{s2.toUpperCase()}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

function CategoryDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (name: string) => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  async function save() {
    const { ok, data } = await post<{ name: string }>("/api/items", { op: "add_category", name });
    if (!ok) { setErr(data.error || "Could not add"); return; }
    onSaved(data.name);
  }
  return (
    <Modal title="Add Item Category" onClose={onClose} width={400} footer={
      <><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>
    }>
      <div className="field">
        <label className="label">Category Name</label>
        <input className="input" autoFocus value={name} placeholder="eg. Honey" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
      </div>
      {err && <div className="neg" style={{ fontSize: 12.5 }}>{err}</div>}
    </Modal>
  );
}
