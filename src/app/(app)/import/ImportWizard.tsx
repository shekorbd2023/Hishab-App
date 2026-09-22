"use client";
// Karbar-style "Import … in 3 Steps": download sample → upload & review/fix inline → confirm & import.
import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon, post, Switch } from "@/components/ui";

type Kind = "text" | "number" | "enum" | "date";
type Spec = { key: string; header: string; aliases: string[]; kind: Kind; required?: boolean; options?: string[]; sample: [string, string]; width?: number };

const PARTY_SPECS: Spec[] = [
  { key: "name", header: "Name", aliases: ["party name", "full name", "customer name", "supplier name", "party"], kind: "text", required: true, sample: ["Rahim Traders", "Karim Store"], width: 180 },
  { key: "phone", header: "Phone Number", aliases: ["phone", "mobile", "mobile number", "contact", "contact number", "phone no"], kind: "text", sample: ["01711000000", "01822000000"], width: 130 },
  { key: "type", header: "Party Type", aliases: ["type", "customer/supplier"], kind: "enum", options: ["Customer", "Supplier"], sample: ["Customer", "Supplier"], width: 130 },
  { key: "category", header: "Party Category", aliases: ["category", "group"], kind: "text", sample: ["Retail", "Wholesale"], width: 120 },
  { key: "opening_balance", header: "Opening Balance", aliases: ["balance", "opening", "current balance", "amount", "due", "party balance"], kind: "number", sample: ["1500", "2000"], width: 110 },
  { key: "balance_type", header: "Balance Type", aliases: ["payment type", "to receive/to give", "receivable/payable", "balance status"], kind: "enum", options: ["To Receive", "To Give"], sample: ["To Receive", "To Give"], width: 135 },
  { key: "as_of_date", header: "As Of Date", aliases: ["date", "as of", "opening date"], kind: "date", sample: ["2026-09-01", "2026-09-01"], width: 130 },
  { key: "address", header: "Address", aliases: ["street address", "location"], kind: "text", sample: ["Mirpur, Dhaka", "Chawkbazar, Chattogram"], width: 170 },
  { key: "email", header: "Email", aliases: ["email address", "e-mail"], kind: "text", sample: ["rahim@example.com", ""], width: 170 },
  { key: "vat", header: "VAT Number", aliases: ["vat", "vat no", "bin", "tin", "tax number"], kind: "text", sample: ["", "123456789"], width: 120 },
];
const ITEM_SPECS: Spec[] = [
  { key: "name", header: "Item Name", aliases: ["name", "product name", "product", "item"], kind: "text", required: true, sample: ["Mustard Oil 1L", "Home Delivery"], width: 180 },
  { key: "code", header: "Item Code", aliases: ["code", "barcode", "sku", "product code"], kind: "text", sample: ["1001", ""], width: 100 },
  { key: "category", header: "Item Category", aliases: ["category", "group"], kind: "text", sample: ["Oil", "Services"], width: 120 },
  { key: "type", header: "Item Type", aliases: ["type", "product/service"], kind: "enum", options: ["Product", "Service"], sample: ["Product", "Service"], width: 120 },
  { key: "unit", header: "Unit", aliases: ["measuring unit", "primary unit", "uom"], kind: "text", sample: ["pcs", ""], width: 80 },
  { key: "sales_price", header: "Sales Price", aliases: ["sale price", "selling price", "price", "rate"], kind: "number", sample: ["250", "60"], width: 100 },
  { key: "purchase_price", header: "Purchase Price", aliases: ["cost", "cost price", "buying price"], kind: "number", sample: ["210", "0"], width: 100 },
  { key: "mrp_price", header: "MRP", aliases: ["mrp price", "max retail price"], kind: "number", sample: ["260", ""], width: 90 },
  { key: "wholesale_price", header: "Wholesale Price", aliases: ["wholesale"], kind: "number", sample: ["235", ""], width: 100 },
  { key: "min_wholesale_qty", header: "Min Wholesale Qty", aliases: ["minimum wholesale quantity", "min wholesale quantity"], kind: "number", sample: ["10", ""], width: 100 },
  { key: "opening_stock", header: "Opening Stock", aliases: ["stock", "quantity", "qty", "stock quantity", "current stock"], kind: "number", sample: ["40", ""], width: 100 },
  { key: "low_stock_alert", header: "Low Stock Alert", aliases: ["low stock", "low stock quantity", "alert quantity", "reorder level"], kind: "number", sample: ["5", ""], width: 100 },
  { key: "location", header: "Location", aliases: ["item location", "rack", "shelf"], kind: "text", sample: ["Rack A", ""], width: 110 },
  { key: "description", header: "Description", aliases: ["details", "note", "notes"], kind: "text", sample: ["Cold-pressed", ""], width: 170 },
];

/* ---------- file parsing (CSV + .xlsx, no deps) ---------- */
function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  const delim = (s.split("\n")[0].match(/;/g)?.length || 0) > (s.split("\n")[0].match(/,/g)?.length || 0) ? ";" : ",";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const u8 = new Uint8Array(buf); const dv = new DataView(buf); const dec = new TextDecoder();
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("This doesn't look like an .xlsx file. Save it as .xlsx or .csv and try again.");
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const files: Record<string, { method: number; size: number; off: number }> = {};
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    files[dec.decode(u8.subarray(p + 46, p + 46 + nl))] = { method, size, off };
    p += 46 + nl + el + cl;
  }
  const read = async (name: string): Promise<string | null> => {
    const f = files[name]; if (!f) return null;
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
    const data = u8.slice(start, start + f.size);
    if (f.method === 0) return dec.decode(data);
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).text();
  };
  const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");
  const tags = (d: Document | Element, t: string) => Array.from(d.getElementsByTagNameNS("*", t));
  const shared: string[] = [];
  const ss = await read("xl/sharedStrings.xml");
  if (ss) for (const si of tags(xml(ss), "si")) shared.push(tags(si, "t").map((t) => t.textContent || "").join(""));
  const sheetName = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort((a, b) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, "")))[0];
  const sx = sheetName ? await read(sheetName) : null;
  if (!sx) throw new Error("No worksheet found in this file.");
  const out: string[][] = [];
  for (const r of tags(xml(sx), "row")) {
    const row: string[] = [];
    for (const c of tags(r, "c")) {
      const ref = c.getAttribute("r") || "";
      const letters = ref.replace(/\d/g, "");
      let ci = row.length;
      if (letters) { ci = 0; for (const ch of letters) ci = ci * 26 + (ch.charCodeAt(0) - 64); ci -= 1; }
      const t = c.getAttribute("t");
      const v = tags(c, "v")[0]?.textContent ?? "";
      const val = t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? tags(c, "t").map((x) => x.textContent || "").join("") : v;
      while (row.length < ci) row.push("");
      row[ci] = val;
    }
    out.push(row);
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, "");
function excelDate(v: string): string {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{4,5}(\.\d+)?$/.test(s) && Number(s) > 20000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000).toISOString().slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const t = Date.parse(s);
  return Number.isFinite(t) && s ? new Date(t + 6 * 3600000).toISOString().slice(0, 10) : s;
}

type R = Record<string, string> & { _id: string };
let seq = 0;

export default function ImportWizard({ kind, existing }: { kind: "parties" | "items"; existing: string[] }) {
  const specs = kind === "parties" ? PARTY_SPECS : ITEM_SPECS;
  const noun = kind === "parties" ? "Parties" : "Items";
  const one = kind === "parties" ? "party" : "item";
  const [rows, setRows] = useState<R[] | null>(null);
  const [file, setFile] = useState("");
  const [unmapped, setUnmapped] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [onlyBad, setOnlyBad] = useState(false);
  const [skip, setSkip] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ count: number; skipped: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const existingSet = useMemo(() => new Set(existing.map((n) => n.trim().toLowerCase())), [existing]);

  function sample() {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = [specs.map((s) => s.header).join(","), specs.map((s) => esc(s.sample[0])).join(","), specs.map((s) => esc(s.sample[1])).join(",")];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Hishab ${noun} Import Sample.csv`; a.click();
  }

  function cleanValue(s: Spec, v: string): string {
    const t = (v ?? "").toString().trim();
    if (!t) return "";
    if (s.kind === "number") return t.replace(/^Tk\.?\s*/i, "").replace(/,/g, "");
    if (s.kind === "date") return excelDate(t);
    if (s.key === "type" && kind === "parties") return /^s/i.test(t) || /supplier|vendor/i.test(t) ? "Supplier" : /^c/i.test(t) || /customer/i.test(t) ? "Customer" : t;
    if (s.key === "type") return /serv/i.test(t) ? "Service" : /prod|goods/i.test(t) ? "Product" : t;
    if (s.key === "balance_type") return /give|pay|cr/i.test(t) ? "To Give" : /rec|dr/i.test(t) ? "To Receive" : t;
    return t;
  }

  async function load(f: File | undefined) {
    if (!f) return;
    setErr(""); setDone(null);
    if (f.size > 5 * 1024 * 1024) { setErr("File is too large (max 5 MB)."); return; }
    try {
      let grid: string[][];
      if (/\.xlsx$/i.test(f.name)) grid = await readXlsx(await f.arrayBuffer());
      else if (/\.xls$/i.test(f.name)) throw new Error("Old .xls files aren't supported. In Excel choose File → Save As → .xlsx or .csv.");
      else grid = parseCsv(await f.text());
      grid = grid.filter((r) => r.some((c) => (c ?? "").toString().trim()));
      // find the header row (first row among the first 10 that names the first column)
      const nameKeys = [specs[0].header, specs[0].key, ...specs[0].aliases].map(norm);
      let hi = grid.slice(0, 10).findIndex((r) => r.some((c) => nameKeys.includes(norm(String(c)))));
      if (hi < 0) hi = 0;
      const header = grid[hi].map((h) => norm(String(h)));
      const colFor: Record<string, number> = {};
      for (const s of specs) {
        const cands = [s.header, s.key, ...s.aliases].map(norm);
        const i = header.findIndex((h, j) => cands.includes(h) && !Object.values(colFor).includes(j));
        if (i >= 0) colFor[s.key] = i;
      }
      if (colFor.name === undefined) throw new Error(`Couldn't find a "${specs[0].header}" column. Download the sample file to see the expected headers.`);
      setUnmapped(grid[hi].filter((_, j) => !Object.values(colFor).includes(j) && String(grid[hi][j]).trim()).map(String));
      const body = grid.slice(hi + 1);
      if (body.length > 500) throw new Error(`This file has ${body.length} entries — you can import up to 500 at a time. Split it into smaller files.`);
      const out: R[] = body.map((r) => {
        const o: R = { _id: String(++seq) } as R;
        for (const s of specs) o[s.key] = colFor[s.key] !== undefined ? cleanValue(s, String(r[colFor[s.key]] ?? "")) : "";
        if (kind === "parties") {
          const n = Number(o.opening_balance);
          if (Number.isFinite(n) && n < 0) { o.opening_balance = String(-n); if (!o.balance_type) o.balance_type = "To Give"; }
          if (!o.type) o.type = o.balance_type === "To Give" ? "Supplier" : "Customer";
          if (!o.balance_type && o.opening_balance) o.balance_type = o.type === "Supplier" ? "To Give" : "To Receive";
        } else if (!o.type) o.type = "Product";
        return o;
      });
      if (!out.length) throw new Error("The file has a header row but no entries.");
      setRows(out); setFile(f.name); setOnlyBad(false);
    } catch (e) {
      setErr((e as Error).message || "Couldn't read this file.");
    }
  }

  const errorsOf = useMemo(() => {
    const m: Record<string, Record<string, string>> = {};
    if (!rows) return m;
    const seen = new Map<string, number>();
    for (const r of rows) { const k = (r.name || "").trim().toLowerCase(); if (k) seen.set(k, (seen.get(k) || 0) + 1); }
    for (const r of rows) {
      const e: Record<string, string> = {};
      for (const s of specs) {
        const v = (r[s.key] || "").trim();
        if (s.required && !v) e[s.key] = `${s.header} is required`;
        else if (v && s.kind === "number" && !Number.isFinite(Number(v))) e[s.key] = `${s.header} must be a number`;
        else if (v && s.kind === "number" && Number(v) < 0 && s.key !== "opening_stock") e[s.key] = `${s.header} can't be negative`;
        else if (v && s.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) e[s.key] = "Use date format YYYY-MM-DD";
        else if (v && s.kind === "enum" && !s.options!.includes(v)) e[s.key] = `Choose ${s.options!.join(" or ")}`;
        else if (v && s.key === "email" && !/^\S+@\S+\.\S+$/.test(v)) e[s.key] = "Invalid email";
      }
      const k = (r.name || "").trim().toLowerCase();
      if (k && (seen.get(k) || 0) > 1) e.name = e.name || "Duplicate name in this file";
      if (Object.keys(e).length) m[r._id] = e;
    }
    return m;
  }, [rows, specs]);

  const badCount = Object.keys(errorsOf).length;
  const dupCount = rows ? rows.filter((r) => existingSet.has((r.name || "").trim().toLowerCase())).length : 0;
  const importCount = rows ? rows.length - (skip ? dupCount : 0) : 0;
  const shown = rows ? (onlyBad ? rows.filter((r) => errorsOf[r._id]) : rows) : [];

  function edit(id: string, key: string, v: string) { setRows((rs) => rs && rs.map((r) => (r._id === id ? { ...r, [key]: v } : r))); }
  function remove(id: string) { setRows((rs) => rs && rs.filter((r) => r._id !== id)); }

  async function doImport() {
    if (!rows || badCount) return;
    setBusy(true); setErr("");
    const payload = rows.map((r) => {
      const o: Record<string, string | number> = {};
      for (const s of specs) o[s.key] = s.kind === "number" ? Number(r[s.key] || 0) : r[s.key] || "";
      if (kind === "parties") o.type = String(o.type).toLowerCase();
      return o;
    });
    const { ok, data } = await post<{ count: number; skipped: number }>("/api/import", { op: kind, rows: payload, skipExisting: skip });
    setBusy(false);
    if (!ok) { setErr(data.error || "Import failed."); return; }
    setDone({ count: data.count, skipped: data.skipped }); setRows(null);
  }

  const step = done ? 4 : rows ? 2 : 1;
  const Steps = (
    <div className="imp-steps">
      <div className={`imp-step ${step === 1 ? "on" : "done"}`}>
        <span className="imp-num">{step > 1 ? <Icon name="check" size={15} /> : 1}</span>
        <div>
          <h3>Download the sample file & fill data</h3>
          <p>Use the sample&apos;s column headers. Only <b>{specs[0].header}</b> is required. Karbar exports and other spreadsheets work too — columns are matched by name.</p>
          <button className="btn btn-sm btn-soft" style={{ marginTop: ".55rem" }} onClick={sample}><Icon name="download" size={14} />Download Sample File</button>
        </div>
      </div>
      <div className={`imp-step ${step === 2 ? "on" : step > 2 ? "done" : ""}`}>
        <span className="imp-num">{step > 2 ? <Icon name="check" size={15} /> : 2}</span>
        <div><h3>Review & adjust</h3><p>Upload the file, then check every row here. Fix mistakes right in the table — rows with errors are highlighted in red.</p></div>
      </div>
      <div className={`imp-step ${step === 4 ? "done" : ""}`}>
        <span className="imp-num">{step > 3 ? <Icon name="check" size={15} /> : 3}</span>
        <div><h3>Confirm & import</h3><p>When everything looks right, import. {noun} appear immediately in {kind === "parties" ? "Parties" : "Inventory"}.</p></div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-head">
        <div className="page-title"><Link href="/import" className="back-btn" aria-label="Back"><Icon name="back" size={18} /></Link>Import {noun} in 3 Steps</div>
        {rows && (
          <div className="row">
            <button className="btn" onClick={() => { setRows(null); setFile(""); }}>Change File</button>
            <button className="btn btn-primary" disabled={!!badCount || busy || importCount === 0} onClick={doImport}>
              <Icon name="upload" size={15} />{busy ? "Importing…" : `Import ${importCount} ${importCount === 1 ? one : noun.toLowerCase()}`}
            </button>
          </div>
        )}
      </div>
      {err && <div className="card" style={{ padding: ".7rem 1rem", marginBottom: "1rem", borderColor: "var(--red)", color: "var(--red)", display: "flex", gap: 8, alignItems: "center" }}><Icon name="info" size={16} />{err}</div>}

      {done ? (
        <div className="card" style={{ padding: "2.5rem 1rem", textAlign: "center", display: "grid", placeItems: "center", gap: ".5rem" }}>
          <span style={{ width: 64, height: 64, borderRadius: 16, background: "var(--brand-soft)", color: "var(--brand)", display: "grid", placeItems: "center" }}><Icon name="check" size={32} /></span>
          <h3 style={{ fontSize: 17, fontWeight: 700 }}>{done.count} {done.count === 1 ? one : noun.toLowerCase()} imported</h3>
          <p className="text-muted">{done.skipped ? `${done.skipped} already existed and were skipped.` : "Everything was added successfully."}</p>
          <div className="row" style={{ marginTop: ".5rem" }}>
            <Link className="btn btn-primary" href={kind === "parties" ? "/parties" : "/inventory"}>View {noun}</Link>
            <button className="btn" onClick={() => setDone(null)}>Import More</button>
          </div>
        </div>
      ) : !rows ? (
        <div className="imp-wrap">
          <div className="card">{Steps}</div>
          <div
            className={`imp-drop ${drag ? "drag" : ""}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files?.[0]); }}
          >
            <div>
              <div className="ic"><Icon name="upload" size={30} /></div>
              <div style={{ fontWeight: 700, fontSize: 15 }}><span style={{ color: "var(--brand)" }}>Click to Upload</span> or drag and drop</div>
              <div className="text-muted" style={{ fontSize: 12.5, marginTop: ".35rem" }}>CSV or Excel (.csv, .xlsx) · up to 500 entries</div>
            </div>
            <input ref={input} type="file" accept=".csv,.xlsx,.xls,text/csv" hidden onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <span className="chip chip-soft"><Icon name="statement" size={14} />{file}</span>
            <span className="chip chip-soft">{rows.length} entries</span>
            {badCount > 0 ? (
              <button className={`chip ${onlyBad ? "on" : ""}`} onClick={() => setOnlyBad((v) => !v)} style={onlyBad ? undefined : { color: "var(--red)", borderColor: "var(--red)" }}>
                <Icon name="info" size={14} />{badCount} with errors{onlyBad ? " (showing)" : " — show only these"}
              </button>
            ) : <span className="chip" style={{ color: "var(--brand-dark)", borderColor: "var(--brand)" }}><Icon name="check" size={14} />All rows valid</span>}
            {dupCount > 0 && (
              <label className="chip" style={{ cursor: "pointer" }}><Switch on={skip} onChange={setSkip} />Skip {dupCount} {dupCount === 1 ? one : noun.toLowerCase()} that already exist</label>
            )}
            <span className="grow" />
            {unmapped.length > 0 && <span className="sub" title={unmapped.join(", ")}>Ignored columns: {unmapped.slice(0, 4).join(", ")}{unmapped.length > 4 ? "…" : ""}</span>}
          </div>
          <div className="table-wrap scroll-thin" style={{ maxHeight: "calc(100vh - 230px)" }}>
            <table className="tbl imp-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th style={{ minWidth: 150 }}>Status</th>
                  {specs.map((s) => <th key={s.key} style={{ minWidth: s.width }}>{s.header}{s.required && <span style={{ color: "var(--red)" }}> *</span>}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const e = errorsOf[r._id];
                  const exists = existingSet.has((r.name || "").trim().toLowerCase());
                  return (
                    <tr key={r._id} className={e ? "bad" : ""}>
                      <td className="text-muted">{rows.indexOf(r) + 1}</td>
                      <td>
                        {e ? <div className="imp-err">{Object.values(e).join(" · ")}</div>
                          : exists ? <span className="pill pill-partial">{skip ? "Exists · skip" : "Exists · add again"}</span>
                          : <span className="pill pill-paid">Ready</span>}
                      </td>
                      {specs.map((s) => (
                        <td key={s.key}>
                          {s.kind === "enum" ? (
                            <select className={`input ${e?.[s.key] ? "err" : ""}`} value={r[s.key]} onChange={(ev) => edit(r._id, s.key, ev.target.value)} title={e?.[s.key]}>
                              <option value="">—</option>
                              {s.options!.map((o) => <option key={o}>{o}</option>)}
                              {r[s.key] && !s.options!.includes(r[s.key]) && <option>{r[s.key]}</option>}
                            </select>
                          ) : (
                            <input className={`input ${e?.[s.key] ? "err" : ""}`} value={r[s.key]} title={e?.[s.key]}
                              inputMode={s.kind === "number" ? "decimal" : undefined} placeholder={s.kind === "date" ? "YYYY-MM-DD" : ""}
                              onChange={(ev) => edit(r._id, s.key, ev.target.value)} />
                          )}
                        </td>
                      ))}
                      <td><button className="btn btn-icon btn-sm btn-ghost" onClick={() => remove(r._id)} title="Remove row" aria-label="Remove row"><Icon name="trash" size={15} /></button></td>
                    </tr>
                  );
                })}
                {shown.length === 0 && <tr><td colSpan={specs.length + 3} className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>No rows left.</td></tr>}
              </tbody>
            </table>
          </div>
          {badCount > 0 && <p className="rv-note"><Icon name="info" size={13} /> Fix or remove the {badCount} highlighted {badCount === 1 ? "row" : "rows"} to enable import. Hover a red field to see what&apos;s wrong.</p>}
        </>
      )}
    </div>
  );
}
