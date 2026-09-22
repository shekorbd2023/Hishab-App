"use client";
// Karbar Expense / Other Income list: search, All Category, All Payment Modes, date, Sort By; itemised Add/Edit dialog.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateFilter, FilterSelect, Icon, Modal, SearchBox, SortMenu, post, rangeFor, useToast, type DateRange } from "./ui";
import { fmtDate, tk, TODAY } from "@/lib/format";
import { downloadCsv } from "@/lib/clientUtil";
import type { CashRow } from "@/lib/cashbook";

type Acc = { id: string; name: string };

export default function CashbookClient({ kind, rows, accounts, categories, nextNo }: {
  kind: "expense" | "income"; rows: CashRow[]; accounts: Acc[]; categories: string[]; nextNo: number;
}) {
  const router = useRouter();
  const { toast, node } = useToast();
  const W = kind === "expense" ? { title: "Expenses", one: "Expense", no: "Exp No.", add: "Add New Expense" } : { title: "Other Income", one: "Income", no: "Income No.", add: "Add New Income" };
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [acc, setAcc] = useState("all");
  const [range, setRange] = useState<DateRange>(rangeFor("all"));
  const [sort, setSort] = useState("latest");
  const [open, setOpen] = useState<null | "new" | CashRow>(null);
  const [del, setDel] = useState<CashRow | null>(null);
  const [cats, setCats] = useState(categories);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const r = rows.filter((x) => (cat === "all" || (x.category || "") === cat) && (acc === "all" || x.account_id === acc) &&
      x.date >= range.from && x.date <= range.to &&
      (!s || String(x.number).includes(s) || (x.category || "").toLowerCase().includes(s) || (x.note || "").toLowerCase().includes(s) ||
        x.lines.some((l) => l.name.toLowerCase().includes(s))));
    const by: Record<string, (a: CashRow, b: CashRow) => number> = {
      latest: (a, b) => (a.date === b.date ? b.number - a.number : a.date < b.date ? 1 : -1),
      oldest: (a, b) => (a.date === b.date ? a.number - b.number : a.date < b.date ? -1 : 1),
      amt_desc: (a, b) => b.amount - a.amount, amt_asc: (a, b) => a.amount - b.amount,
    };
    return [...r].sort(by[sort] || by.latest);
  }, [rows, q, cat, acc, range, sort]);
  const total = shown.reduce((a, r) => a + r.amount, 0);

  async function remove() {
    if (!del) return;
    const { ok, data } = await post("/api/cashbook", { op: "delete", kind, id: del.id });
    if (!ok) { toast(data.error || "Could not delete"); return; }
    setDel(null); toast(`${W.one} deleted`); router.refresh();
  }

  if (rows.length === 0 && !open) {
    return (
      <div>
        <div className="page-head"><div className="page-title">{W.title} (0)</div></div>
        <div className="card"><div className="empty" style={{ padding: "4rem 1rem" }}>
          <div className="empty-icon"><Icon name={kind === "expense" ? "wallet" : "income"} size={26} /></div>
          <h3>Create Your First {W.one}</h3>
          <div>Record {kind === "expense" ? "rent, salary, transport and other business costs" : "commission, rent received and other earnings"} to see your real profit.</div>
          <button className="btn btn-primary" style={{ marginTop: ".6rem" }} onClick={() => setOpen("new")}><Icon name="plus" size={15} />{W.add}</button>
        </div></div>
        {node}
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-title">{W.title} ({rows.length})</div>
        <div className="row" style={{ gap: ".5rem" }}>
          <button className="btn" onClick={() => downloadCsv(`${kind}.csv`, ["number", "date", "category", "payment_mode", "amount", "remarks"],
            shown.map((r) => [r.number, r.date, r.category, r.aname, r.amount, r.note]))}><Icon name="download" size={15} />Download</button>
          <button className="btn btn-primary" onClick={() => setOpen("new")}><Icon name="plus" size={15} />{W.add}</button>
        </div>
      </div>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder={`Search ${W.title.toLowerCase()}…`} width={240} />
        <FilterSelect value={cat} onChange={setCat} options={[{ v: "all", l: "All Category" }, ...cats.map((c) => ({ v: c, l: c }))]} />
        <FilterSelect value={acc} onChange={setAcc} options={[{ v: "all", l: "All Payment Modes" }, ...accounts.map((a) => ({ v: a.id, l: a.name }))]} />
        <DateFilter value={range} onChange={setRange} />
        <div className="grow" />
        <SortMenu value={sort} onChange={setSort} options={[{ v: "latest", l: "Latest" }, { v: "oldest", l: "Oldest" }, { v: "amt_desc", l: "Amount: High to Low" }, { v: "amt_asc", l: "Amount: Low to High" }]} />
      </div>
      <div className="dl-strip">
        <span><b>{shown.length}</b> {shown.length === 1 ? W.one.toLowerCase() : W.title.toLowerCase()}</span><span className="dl-dot" />
        <span>Total <b className={kind === "expense" ? "neg" : "pos"}>{tk(Math.round(total * 100) / 100)}</b></span>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>{W.no}</th><th>Category</th><th>Date</th><th>Payment Mode</th><th className="num">Total Amount</th><th>Remarks</th><th style={{ width: 84 }} /></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => setOpen(r)}>
                <td className="dl-no">#{r.number}</td>
                <td>{r.category || <span className="text-muted">--</span>}
                  {r.lines.length > 0 && <div className="sub">{r.lines.map((l) => l.name).join(", ")}</div>}</td>
                <td>{fmtDate(r.date)}</td>
                <td>{r.aname || <span className="text-muted">--</span>}</td>
                <td className="num" style={{ fontWeight: 600 }}>{tk(r.amount)}</td>
                <td className="sub">{r.note || "--"}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="dl-act">
                    <button className="btn btn-icon btn-sm btn-ghost" title="Edit" onClick={() => setOpen(r)}><Icon name="edit" size={15} /></button>
                    <button className="btn btn-icon btn-sm btn-ghost" title="Delete" style={{ color: "var(--red)" }} onClick={() => setDel(r)}><Icon name="trash" size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={7}><div className="empty"><h3>No {W.title.toLowerCase()} found</h3><div>Try a different search or filter.</div></div></td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <CashDialog kind={kind} W={W} row={open === "new" ? null : open} nextNo={nextNo} accounts={accounts} categories={cats}
          onCategory={(n) => setCats((c) => Array.from(new Set([...c, n])).sort())}
          onClose={() => setOpen(null)}
          onSaved={(again, msg) => { toast(msg); router.refresh(); if (!again) setOpen(null); }} />
      )}
      {del && (
        <Modal title={`Delete ${W.one}`} onClose={() => setDel(null)} width={420} footer={
          <><button className="btn" onClick={() => setDel(null)}>Cancel</button>
            <button className="btn btn-primary dl-del" onClick={remove}><Icon name="trash" size={14} />Delete</button></>
        }>
          <div>Delete {W.one.toLowerCase()} <b>#{del.number}</b> ({tk(del.amount)})?</div>
          <div className="sub">The money goes back to {del.aname || "the account"}. This cannot be undone.</div>
        </Modal>
      )}
      {node}
    </div>
  );
}

type L = { key: number; name: string; qty: string; rate: string };
let K = 1;

function CashDialog({ kind, W, row, nextNo, accounts, categories, onCategory, onClose, onSaved }: {
  kind: "expense" | "income"; W: { one: string; no: string }; row: CashRow | null; nextNo: number; accounts: Acc[]; categories: string[];
  onCategory: (n: string) => void; onClose: () => void; onSaved: (again: boolean, msg: string) => void;
}) {
  const edit = !!row;
  const [no, setNo] = useState(String(row?.number || nextNo));
  const [manual, setManual] = useState(false);
  const [date, setDate] = useState(row?.date || TODAY());
  const [cat, setCat] = useState(row?.category || "");
  const [newCat, setNewCat] = useState<string | null>(null);
  const [itemised, setItemised] = useState((row?.lines.length || 0) > 0);
  const [lines, setLines] = useState<L[]>(row?.lines.length ? row.lines.map((l) => ({ key: K++, name: l.name, qty: String(l.qty), rate: String(l.rate) })) : [{ key: K++, name: "", qty: "1", rate: "" }]);
  const [amount, setAmount] = useState(row && !row.lines.length ? String(row.amount) : "");
  const cash = accounts.find((a) => /cash/i.test(a.name)) || accounts[0];
  const [acc, setAcc] = useState(row?.account_id || cash?.id || "");
  const [note, setNote] = useState(row?.note || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const lineTotal = lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);
  const total = itemised ? Math.round(lineTotal * 100) / 100 : Number(amount) || 0;

  async function addCategory() {
    const name = (newCat || "").trim(); if (!name) return;
    const { ok, data } = await post<{ name: string }>("/api/cashbook", { op: "add_category", kind, name });
    if (!ok) { setErr(data.error || "Could not add category"); return; }
    onCategory(data.name); setCat(data.name); setNewCat(null);
  }

  async function save(again: boolean) {
    if (!(total > 0)) { setErr("Enter the amount."); return; }
    setBusy(true); setErr("");
    const payload = {
      op: edit ? "update" : "create", kind, id: row?.id, number: edit || manual ? Number(no) : undefined, date, category: cat || null,
      account_id: acc || null, note: note.trim() || null,
      ...(itemised ? { lines: lines.filter((l) => l.name.trim()).map((l) => ({ name: l.name.trim(), qty: Number(l.qty) || 1, rate: Number(l.rate) || 0 })) } : { amount: total, lines: [] }),
    };
    const { ok, data } = await post<{ number: number }>("/api/cashbook", payload);
    setBusy(false);
    if (!ok) { setErr(data.error || "Could not save."); return; }
    onSaved(again, `${W.one} #${edit ? no : data.number} saved`);
    if (again) {
      setNo(String((data.number || Number(no)) + 1)); setManual(false); setAmount(""); setNote("");
      setLines([{ key: K++, name: "", qty: "1", rate: "" }]);
    }
  }

  return (
    <Modal title={edit ? `Edit ${W.one} #${row!.number}` : `Add ${W.one}`} onClose={() => !busy && onClose()} width={560} footer={
      <>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        {!edit && <button className="btn" onClick={() => save(true)} disabled={busy}>Save &amp; New</button>}
        <button className="btn btn-primary" onClick={() => save(false)} disabled={busy}>{busy ? "Saving…" : `Save ${W.one}`}</button>
      </>
    }>
      <div className="form-grid">
        <div className="field">
          <label className="label between"><span>{W.no}</span>
            {!edit && <button type="button" className="link" style={{ background: "none", border: 0, cursor: "pointer", fontSize: 12 }} onClick={() => { setManual((m) => !m); setNo(String(nextNo)); }}>{manual ? "Auto" : "Manual"}</button>}
          </label>
          <input className="input" value={no} disabled={!edit && !manual} inputMode="numeric" onChange={(e) => setNo(e.target.value.replace(/[^\d]/g, ""))} />
        </div>
        <div className="field">
          <label className="label">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label className="label between"><span>{W.one} Category</span>
          <button type="button" className="link" style={{ background: "none", border: 0, cursor: "pointer", fontSize: 12 }} onClick={() => setNewCat(newCat === null ? "" : null)}>{newCat === null ? "+ Add Category" : "Cancel"}</button>
        </label>
        {newCat === null ? (
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <div className="row" style={{ gap: ".4rem" }}>
            <input className="input" autoFocus value={newCat} placeholder={kind === "expense" ? "eg. Rent" : "eg. Commission"} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }} />
            <button className="btn btn-primary" onClick={addCategory}>Add</button>
          </div>
        )}
      </div>

      {itemised ? (
        <div className="md-lines">
          <table>
            <thead><tr><th>Item</th><th style={{ width: 80 }}>Qty</th><th style={{ width: 110 }}>Rate</th><th className="num" style={{ width: 100 }}>Amount</th><th style={{ width: 34 }} /></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td><input className="input" value={l.name} placeholder="Item name" onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, name: e.target.value } : x)))} /></td>
                  <td><input className="input" inputMode="decimal" value={l.qty} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty: e.target.value } : x)))} /></td>
                  <td><input className="input" inputMode="decimal" value={l.rate} placeholder="0" onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, rate: e.target.value } : x)))} /></td>
                  <td className="num">{tk((Number(l.qty) || 0) * (Number(l.rate) || 0))}</td>
                  <td><button className="btn btn-icon btn-sm btn-ghost" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}><Icon name="x" size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: ".45rem .5rem", borderTop: "1px solid var(--border)" }}>
            <button className="link" style={{ background: "none", border: 0, cursor: "pointer", fontSize: 12.5 }} onClick={() => setLines((ls) => [...ls, { key: K++, name: "", qty: "1", rate: "" }])}>+ Add {W.one} Item</button>
          </div>
        </div>
      ) : (
        <button className="link" style={{ background: "none", border: 0, cursor: "pointer", fontSize: 13, justifySelf: "start", padding: 0 }} onClick={() => setItemised(true)}>
          + Add {W.one} Item <span className="sub">(itemise this {W.one.toLowerCase()})</span>
        </button>
      )}

      <div className="field">
        <label className="label">Total Amount</label>
        <div className="input-group"><span className="prefix">Tk.</span>
          <input className="input" inputMode="decimal" value={itemised ? String(total) : amount} disabled={itemised} placeholder="0" autoFocus={!edit}
            onChange={(e) => setAmount(e.target.value)} /></div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label className="label">Payment Method</label>
          <select className="input" value={acc} onChange={(e) => setAcc(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">Remarks</label>
          <input className="input" value={note} placeholder="Enter remarks" onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      {err && <div className="neg" style={{ fontSize: 12.5 }}>{err}</div>}
    </Modal>
  );
}
