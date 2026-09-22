"use client";
// Karbar "Items List (n)": search + All Categories / All Stock / All Items filters + Sort By, clickable rows → item detail.
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, FilterSelect, Icon, Modal, MoreButton, SearchBox, SortMenu, SplitButton, post, useToast } from "@/components/ui";
import { downloadCsv } from "@/lib/clientUtil";
import { tk, qty as fq } from "@/lib/format";
import StockDialog from "./StockDialog";
import type { ItemRow } from "./data";

const stateOf = (it: ItemRow) => it.type === "Service" ? "in" : it.stock <= 0 ? "out" : it.low_stock_alert > 0 && it.stock <= it.low_stock_alert ? "low" : "in";

export default function ItemsTable({ items, categories }: { items: ItemRow[]; categories: string[] }) {
  const router = useRouter();
  const { toast, node } = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [stock, setStock] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("name_az");
  const [adjust, setAdjust] = useState<{ it: ItemRow; mode: "add" | "reduce" } | null>(null);
  const [del, setDel] = useState<ItemRow | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = items.filter((it) => {
      if (s && !it.name.toLowerCase().includes(s) && !(it.code || "").toLowerCase().includes(s)) return false;
      if (cat !== "all" && (it.category || "") !== cat) return false;
      if (type !== "all" && it.type !== type) return false;
      if (stock !== "all" && stateOf(it) !== stock) return false;
      return true;
    });
    const by: Record<string, (a: ItemRow, b: ItemRow) => number> = {
      latest: (a, b) => (a.created_at < b.created_at ? 1 : -1),
      qty_desc: (a, b) => b.stock - a.stock,
      qty_asc: (a, b) => a.stock - b.stock,
      name_az: (a, b) => a.name.localeCompare(b.name),
      name_za: (a, b) => b.name.localeCompare(a.name),
    };
    return [...list].sort(by[sort] || by.name_az);
  }, [items, q, cat, stock, type, sort]);

  const value = useMemo(() => rows.reduce((a, it) => a + Math.max(0, it.stock) * it.purchase_price, 0), [rows]);
  const low = useMemo(() => items.filter((it) => stateOf(it) !== "in").length, [items]);

  function exportCsv() {
    downloadCsv("items.csv",
      ["name", "category", "type", "code", "sales_price", "purchase_price", "mrp_price", "wholesale_price", "unit", "current_stock"],
      rows.map((i) => [i.name, i.category, i.type, i.code, i.sales_price, i.purchase_price, i.mrp_price, i.wholesale_price, i.unit, i.stock]));
  }
  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const { ok, data } = await post<{ count: number }>("/api/items", { op: "import", csv: await file.text() });
    toast(ok ? `Imported ${data.count} items` : data.error || "Import failed");
    if (ok) router.refresh();
    if (fileRef.current) fileRef.current.value = "";
  }
  async function remove() {
    if (!del) return;
    setBusy(true);
    const { ok, data } = await post("/api/items", { op: "delete", id: del.id });
    setBusy(false);
    if (!ok) { toast(data.error || "Could not delete"); return; }
    setDel(null); toast("Item deleted"); router.refresh();
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-title">
          Items List ({items.length})
          <Link href="/settings/features/inventory" className="btn btn-icon btn-sm btn-ghost" title="Inventory settings"><Icon name="settings" size={16} /></Link>
        </div>
        <div className="row" style={{ gap: ".5rem" }}>
          <Link className="btn" href="/tools/barcode"><Icon name="barcode" size={15} />Barcode</Link>
          <button className="btn" onClick={exportCsv}><Icon name="download" size={15} />Download</button>
          <Link className="btn" href="/import/items"><Icon name="import" size={15} />Import Items</Link>
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={onImport} />
          <SplitButton label="Add New Item" icon="plus" href="/inventory/add"
            items={[{ label: "Import Items (Excel)", icon: "import", href: "/import/items" }, { label: "Import CSV", icon: "upload", onClick: () => fileRef.current?.click() }]} />
        </div>
      </div>

      <div className="md-strip">
        <span>Items<b>{rows.length}</b></span>
        <span>Stock Value<b>{tk(Math.round(value))}</b></span>
        <span>Low / Out of Stock<b className={low ? "neg" : ""}>{low}</b></span>
      </div>

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search items…" width={260} />
        <FilterSelect value={cat} onChange={setCat} options={[{ v: "all", l: "All Categories" }, ...categories.map((c) => ({ v: c, l: c }))]} />
        <FilterSelect value={stock} onChange={setStock} options={[{ v: "all", l: "All Stock" }, { v: "in", l: "In Stock" }, { v: "low", l: "Low Stock" }, { v: "out", l: "Out of Stock" }]} />
        <FilterSelect value={type} onChange={setType} options={[{ v: "all", l: "All Items" }, { v: "Product", l: "Product" }, { v: "Service", l: "Service" }]} />
        <div className="grow" />
        <SortMenu value={sort} onChange={setSort} options={[
          { v: "latest", l: "Latest" }, { v: "qty_desc", l: "Quantity: High to Low" }, { v: "qty_asc", l: "Quantity: Low to High" },
          { v: "name_az", l: "Name: A to Z" }, { v: "name_za", l: "Name: Z to A" },
        ]} />
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Item Name</th><th>Type</th><th>Category</th><th>Item Code</th>
              <th className="num">Sales Price</th><th className="num">Purchase Price</th><th className="num">Quantity</th>
              <th style={{ width: 56 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => {
              const st = stateOf(it);
              return (
                <tr key={it.id} className="clickable" onClick={() => router.push(`/inventory/${it.id}`)}>
                  <td>
                    <div className="row" style={{ gap: ".6rem" }}>
                      <Avatar name={it.name} img={it.image} soft />
                      <b style={{ fontWeight: 600 }}>{it.name}</b>
                    </div>
                  </td>
                  <td>{it.type}</td>
                  <td>{it.category || <span className="text-muted">--</span>}</td>
                  <td>{it.code || <span className="text-muted">--</span>}</td>
                  <td className="num">{tk(it.sales_price)}</td>
                  <td className="num">{tk(it.purchase_price)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    {it.type === "Service" ? <span className="text-muted">--</span> : (
                      <span className={st === "out" ? "neg" : st === "low" ? "amber" : ""}>{fq(it.stock)} {(it.unit || "pcs").toUpperCase()}</span>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <MoreButton items={[
                      { heading: "Adjust Stock" },
                      { label: "Add Stock", icon: "plus", onClick: () => setAdjust({ it, mode: "add" }) },
                      { label: "Reduce Stock", icon: "minus", onClick: () => setAdjust({ it, mode: "reduce" }) },
                      { sep: true },
                      { heading: "Actions" },
                      { label: "Edit Item", icon: "edit", href: `/inventory/${it.id}/edit` },
                      { label: "Delete Item", icon: "trash", danger: true, onClick: () => setDel(it) },
                    ]} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8}><div className="empty"><h3>No items found</h3><div>Try a different search or filter.</div>
                <Link href="/inventory/add" className="btn btn-primary" style={{ marginTop: ".5rem" }}><Icon name="plus" size={15} />Add New Item</Link></div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {adjust && <StockDialog item={adjust.it} mode={adjust.mode} onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); toast("Stock updated"); router.refresh(); }} />}
      {del && (
        <Modal title="Delete Item" onClose={() => !busy && setDel(null)} width={420} footer={
          <>
            <button className="btn" onClick={() => setDel(null)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary dl-del" onClick={remove} disabled={busy}><Icon name="trash" size={14} />{busy ? "Deleting…" : "Delete"}</button>
          </>
        }>
          <div>Are you sure you want to delete <b>{del.name}</b>?</div>
          <div className="sub">Old invoices keep the item name, but it will no longer appear in lists or stock reports.</div>
        </Modal>
      )}
      {node}
    </div>
  );
}
