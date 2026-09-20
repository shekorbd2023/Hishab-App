"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/Providers";
import { Modal, PageHeader } from "@/components/Modal";
import { api, downloadCsv } from "@/lib/clientUtil";

type Item = {
  id: string; name: string; category: string | null; type: string; code: string | null;
  sales_price: number; purchase_price: number; mrp_price: number; wholesale_price: number;
  min_wholesale_qty: number; unit: string | null; opening_stock: number; low_stock_alert: number; stock: number;
};

const m = (n: number, s: string) => `${s} ${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function ItemsTable({ items, symbol }: { items: Item[]; symbol: string }) {
  const { t } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low">("all");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cats = useMemo(() => Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[], [items]);
  const rows = useMemo(() => items.filter((it) => {
    if (q && !it.name.toLowerCase().includes(q.toLowerCase()) && !(it.code || "").includes(q)) return false;
    if (cat !== "all" && it.category !== cat) return false;
    if (stockFilter === "low" && !(it.stock <= it.low_stock_alert)) return false;
    return true;
  }), [items, q, cat, stockFilter]);

  function exportCsv() {
    downloadCsv("items.csv",
      ["name", "category", "type", "code", "sales_price", "purchase_price", "mrp_price", "wholesale_price", "min_wholesale_qty", "unit", "opening_stock", "low_stock_alert", "current_stock"],
      rows.map((i) => [i.name, i.category, i.type, i.code, i.sales_price, i.purchase_price, i.mrp_price, i.wholesale_price, i.min_wholesale_qty, i.unit, i.opening_stock, i.low_stock_alert, i.stock]));
  }
  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const csv = await file.text();
    const { ok, data } = await api("/api/items", { op: "import", csv });
    if (ok) { alert(`Imported ${data.count} items`); router.refresh(); } else alert((data.error as string) || "Import failed");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <PageHeader title={t("inventory")} count={items.length}>
        <button className="btn" onClick={exportCsv}>⬇ {t("export_csv")}</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>⬆ {t("import_csv")}</button>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={onImport} />
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>+ {t("add_item")}</button>
      </PageHeader>

      <div className="card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: ".75rem" }}>
          <input className="input" placeholder={`${t("search")}…`} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="all">{t("all")} {t("category")}</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" value={stockFilter} onChange={(e) => setStockFilter(e.target.value as "all" | "low")} style={{ maxWidth: 160 }}>
            <option value="all">{t("all")}</option>
            <option value="low">{t("low_stock")}</option>
          </select>
        </div>
        <div style={{ overflowX: "auto" }} className="scroll-thin">
          <table className="tbl">
            <thead><tr>
              <th>{t("item_name")}</th><th>{t("category")}</th><th style={{ textAlign: "right" }}>{t("sales_price")}</th>
              <th style={{ textAlign: "right" }}>{t("purchase_price")}</th><th style={{ textAlign: "right" }}>{t("quantity")}</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((it) => (
                <tr key={it.id}>
                  <td>{it.name}{it.code && <span className="text-muted" style={{ fontSize: ".75rem" }}> · {it.code}</span>}</td>
                  <td className="text-muted">{it.category || "—"}</td>
                  <td style={{ textAlign: "right" }}>{m(it.sales_price, symbol)}</td>
                  <td style={{ textAlign: "right" }}>{m(it.purchase_price, symbol)}</td>
                  <td style={{ textAlign: "right", color: it.stock <= it.low_stock_alert ? "var(--red)" : "inherit", fontWeight: 600 }}>
                    {it.stock} {it.unit}
                  </td>
                  <td style={{ textAlign: "right" }}><button className="btn" style={{ padding: ".25rem .5rem" }} onClick={() => { setEditing(it); setShowForm(true); }}>✎</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>{t("no_data")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <ItemForm item={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); router.refresh(); }} />}
    </div>
  );
}

function ItemForm({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const [f, setF] = useState({
    name: item?.name || "", category: item?.category || "", type: item?.type || "Product", code: item?.code || "",
    sales_price: item?.sales_price ?? 0, purchase_price: item?.purchase_price ?? 0, mrp_price: item?.mrp_price ?? 0,
    wholesale_price: item?.wholesale_price ?? 0, min_wholesale_qty: item?.min_wholesale_qty ?? 0,
    unit: item?.unit || "pcs", opening_stock: item?.opening_stock ?? 0, low_stock_alert: item?.low_stock_alert ?? 0,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const field = (k: keyof typeof f, label: string, type = "text") => (
    <div><label className="label">{label}</label><input className="input" type={type} value={f[k] as string | number} onChange={set(k)} /></div>
  );

  async function save() {
    if (!f.name.trim()) return;
    setBusy(true);
    const { ok, data } = await api("/api/items", item ? { op: "update", id: item.id, ...f } : { op: "create", ...f });
    setBusy(false);
    if (ok) onSaved(); else alert((data.error as string) || "Failed");
  }
  async function del() {
    if (!item || !confirm("Delete this item?")) return;
    const { ok } = await api("/api/items", { op: "delete", id: item.id });
    if (ok) onSaved();
  }

  return (
    <Modal title={item ? `${t("edit")} ${t("item_name")}` : t("add_item")} onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".6rem" }}>
        {field("name", `${t("item_name")} *`)}
        <div><label className="label">{t("type")}</label><select className="input" value={f.type} onChange={set("type")}><option>Product</option><option>Service</option></select></div>
        {field("category", t("category"))}
        {field("code", t("item_code"))}
        {field("sales_price", t("sales_price"), "number")}
        {field("purchase_price", t("purchase_price"), "number")}
        {field("mrp_price", t("mrp_price"), "number")}
        {field("wholesale_price", t("wholesale_price"), "number")}
        {field("min_wholesale_qty", t("min_wholesale_qty"), "number")}
        {field("unit", t("unit"))}
        {field("opening_stock", t("opening_stock"), "number")}
        {field("low_stock_alert", t("low_stock_alert"), "number")}
      </div>
      <div style={{ display: "flex", gap: ".5rem", marginTop: "1rem" }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{t("save")}</button>
        <button className="btn" onClick={onClose}>{t("cancel")}</button>
        {item && <button className="btn btn-danger" style={{ marginLeft: "auto" }} onClick={del}>{t("delete")}</button>}
      </div>
    </Modal>
  );
}
