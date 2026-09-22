"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Dropdown, FilterSelect, Icon, Modal, SearchBox, SortMenu, SplitButton, post, useToast } from "@/components/ui";
import { fmtDate, tk, qty as fq } from "@/lib/format";
import StockDialog from "../StockDialog";
import type { ItemRow } from "../data";

type Act = { key: string; date: string; label: string; party: string | null; change: number; qty: number; remarks: string | null; ref: string | null; kind: string };

const stateOf = (it: ItemRow) => it.type === "Service" ? "in" : it.stock <= 0 ? "out" : it.low_stock_alert > 0 && it.stock <= it.low_stock_alert ? "low" : "in";

export default function ItemDetail({ items, item, activity, categories }: { items: ItemRow[]; item: ItemRow; activity: Act[]; categories: string[] }) {
  const router = useRouter();
  const { toast, node } = useToast();
  // left pane
  const [lq, setLq] = useState("");
  const [cat, setCat] = useState("all");
  const [stock, setStock] = useState("all");
  // right pane
  const [tab, setTab] = useState<"activity" | "details">("activity");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("latest");
  const [adjust, setAdjust] = useState<null | "add" | "reduce">(null);
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const s = lq.trim().toLowerCase();
    return items.filter((it) => (!s || it.name.toLowerCase().includes(s) || (it.code || "").toLowerCase().includes(s)) &&
      (cat === "all" || (it.category || "") === cat) && (stock === "all" || stateOf(it) === stock));
  }, [items, lq, cat, stock]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const r = activity.filter((a) => !s || a.label.toLowerCase().includes(s) || (a.party || "").toLowerCase().includes(s) || (a.remarks || "").toLowerCase().includes(s));
    if (sort === "oldest") return [...r].reverse();
    return r;
  }, [activity, q, sort]);

  const unit = (item.unit || "pcs").toUpperCase();
  const st = stateOf(item);

  async function remove() {
    setBusy(true);
    const { ok, data } = await post("/api/items", { op: "delete", id: item.id });
    setBusy(false);
    if (!ok) { toast(data.error || "Could not delete"); return; }
    router.push("/inventory"); router.refresh();
  }

  return (
    <div className="two-pane has-detail">
      <div className="pane-list">
        <div className="pane-head">
          <div className="md-pane-title">
            <h1>Items ({items.length})</h1>
            <SplitButton label="Add Item" icon="plus" href="/inventory/add" items={[{ label: "Import Items", icon: "import", href: "/import/items" }]} />
          </div>
          <SearchBox value={lq} onChange={setLq} placeholder="Search items…" width="100%" />
          <div className="md-filters">
            <FilterSelect value={cat} onChange={setCat} options={[{ v: "all", l: "All Categories" }, ...categories.map((c) => ({ v: c, l: c }))]} />
            <FilterSelect value={stock} onChange={setStock} options={[{ v: "all", l: "All Stock" }, { v: "in", l: "In Stock" }, { v: "low", l: "Low Stock" }, { v: "out", l: "Out of Stock" }]} />
          </div>
        </div>
        <div className="pane-body scroll-thin">
          {list.map((it) => {
            const s2 = stateOf(it);
            return (
              <Link key={it.id} href={`/inventory/${it.id}`} prefetch={false} className={`list-row ${it.id === item.id ? "active" : ""}`}>
                <Avatar name={it.name} img={it.image} soft />
                <div className="main">
                  <div className="name">{it.name}</div>
                  <div className="phone">{it.category || "---"}</div>
                </div>
                <div className="right">
                  <div className={`amt ${s2 === "out" ? "neg" : "settled"}`}>{it.type === "Service" ? "--" : `${fq(it.stock)} ${(it.unit || "pcs").toUpperCase()}`}</div>
                  <div className="lbl">{tk(it.sales_price)}</div>
                </div>
              </Link>
            );
          })}
          {list.length === 0 && <div className="empty" style={{ padding: "2rem 1rem" }}>No items match your filters.</div>}
        </div>
      </div>

      <div className="pane-detail scroll-thin">
        <div className="md-head">
          <div className="who">
            <Avatar name={item.name} img={item.image} size="lg" soft />
            <div>
              <h2>{item.name}</h2>
              <div className="sub">{item.category || "No category"} · {item.type}{item.code ? ` · Code ${item.code}` : ""}</div>
            </div>
          </div>
          <div className="row" style={{ gap: ".5rem" }}>
            <Dropdown items={[
              { label: "Edit Item", icon: "edit", href: `/inventory/${item.id}/edit` },
              { label: "Delete Item", icon: "trash", danger: true, onClick: () => setDel(true) },
            ]} trigger={(t) => <button className="btn" onClick={t}>Manage Item<Icon name="chevronDown" size={14} /></button>} />
            {item.type !== "Service" && (
              <Dropdown items={[
                { label: "Add Stock", icon: "plus", onClick: () => setAdjust("add") },
                { label: "Reduce Stock", icon: "minus", onClick: () => setAdjust("reduce") },
              ]} trigger={(t) => <button className="btn btn-primary" onClick={t}>Adjust Stock<Icon name="chevronDown" size={14} /></button>} />
            )}
          </div>
        </div>

        <div className="md-kpis" style={{ marginTop: "1rem" }}>
          <div className="kpi"><div className="l">Stock Quantity</div><div className={`v ${st === "out" ? "neg" : st === "low" ? "amber" : ""}`}>{item.type === "Service" ? "--" : `${fq(item.stock)} ${unit}`}</div></div>
          <div className="kpi"><div className="l">Sales Price</div><div className="v">{tk(item.sales_price)}</div></div>
          <div className="kpi"><div className="l">Purchase Price</div><div className="v">{tk(item.purchase_price)}</div></div>
          <div className="kpi"><div className="l">Stock Value</div><div className="v">{tk(Math.round(Math.max(0, item.stock) * item.purchase_price * 100) / 100)}</div></div>
        </div>

        <div className="tabs">
          <button className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>Item Activity ({activity.length})</button>
          <button className={tab === "details" ? "on" : ""} onClick={() => setTab("details")}>Item Details</button>
        </div>

        {tab === "activity" ? (
          <>
            <div className="md-sec">
              <SearchBox value={q} onChange={setQ} placeholder="Search activity…" width={240} />
              <div className="tools">
                <SortMenu value={sort} onChange={setSort} options={[{ v: "latest", l: "Latest" }, { v: "oldest", l: "Oldest" }]} />
              </div>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Type</th><th>Date</th><th className="num">Change</th><th className="num">Quantity</th><th>Remarks</th></tr></thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.key} className={a.ref ? "clickable" : ""} onClick={() => a.ref && router.push(`/doc/${a.ref}`)}>
                      <td>
                        {a.ref ? <Link className="md-type-link" href={`/doc/${a.ref}`} onClick={(e) => e.stopPropagation()}>{a.label}</Link> : <b>{a.label}</b>}
                        {a.party && <div className="sub">{a.party}</div>}
                      </td>
                      <td>{fmtDate(a.date)}</td>
                      <td className={`num ${a.change > 0 ? "pos" : a.change < 0 ? "neg" : ""}`} style={{ fontWeight: 600 }}>{a.change > 0 ? "+" : ""}{fq(a.change)}</td>
                      <td className="num">{fq(a.qty)} {unit}</td>
                      <td className="sub">{a.remarks || "--"}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={5}><div className="empty"><h3>No activity yet</h3><div>Sales, purchases and stock adjustments of this item show here.</div></div></td></tr>}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="card" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="md-dl">
              <D k="Item Type" v={item.type} />
              <D k="Category" v={item.category} />
              <D k="Item Code" v={item.code} />
              <D k="Measuring Unit" v={unit + (item.secondary_unit ? ` (1 ${unit} = ${item.conversion_rate} ${item.secondary_unit.toUpperCase()})` : "")} />
              <D k="Sales Price" v={tk(item.sales_price)} />
              <D k="Purchase Price" v={tk(item.purchase_price)} />
              <D k="MRP Price" v={item.mrp_price ? tk(item.mrp_price) : null} />
              <D k="Wholesale Price" v={item.wholesale_price ? tk(item.wholesale_price) : null} />
              <D k="Min. Wholesale Qty" v={item.min_wholesale_qty ? fq(item.min_wholesale_qty) : null} />
              <D k="Opening Stock" v={item.type === "Service" ? null : `${fq(item.opening_stock)} ${unit}`} />
              <D k="Low Stock Alert" v={item.low_stock_alert ? `${fq(item.low_stock_alert)} ${unit}` : "Off"} />
              <D k="Location" v={item.location} />
              <D k="Description" v={item.description} />
            </div>
            {item.image && <img src={item.image} alt="" style={{ marginTop: "1rem", maxWidth: 180, borderRadius: 10, border: "1px solid var(--border)" }} />}
          </div>
        )}
      </div>

      {adjust && <StockDialog item={item} mode={adjust} onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); toast("Stock updated"); router.refresh(); }} />}
      {del && (
        <Modal title="Delete Item" onClose={() => !busy && setDel(false)} width={420} footer={
          <>
            <button className="btn" onClick={() => setDel(false)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary dl-del" onClick={remove} disabled={busy}><Icon name="trash" size={14} />{busy ? "Deleting…" : "Delete"}</button>
          </>
        }>
          <div>Are you sure you want to delete <b>{item.name}</b>?</div>
        </Modal>
      )}
      {node}
    </div>
  );
}

function D({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><div className="k">{k}</div><div className="v">{v || <span className="text-muted">--</span>}</div></div>;
}
