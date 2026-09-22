"use client";
// Common Karbar-style report screen: ← title, Print PDF + Download Excel ▾, filters, KPI tiles,
// table with totals, print letterhead. Data comes pre-built from src/lib/reports.ts.
import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Report, RRow, Col, Cell, Filter } from "@/lib/reports";
import { fmtDate, tk, qty as fq, TODAY } from "@/lib/format";
import {
  Icon, SplitButton, DateFilter, FilterSelect, SortMenu, SearchBox, Picker, Switch, Seg, Empty, StatusPill, type DateRange,
} from "@/components/ui";

export type BizHead = { name: string; logo: string | null; phone: string | null; address: string | null; email: string | null };

/* ============================== Export helpers (CSV + real .xlsx, no deps) ============================== */
export type Sheet = { title: string; subtitle?: string; header: string[]; rows: (string | number | null)[][]; kinds?: ("text" | "money" | "qty")[]; boldRows?: Set<number>; widths?: number[] };

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadCsvSheet(sheet: Sheet, filename: string) {
  const lines = [sheet.header.map(csvCell).join(","), ...sheet.rows.map((r) => r.map(csvCell).join(","))];
  saveBlob(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), filename);
}

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = []; const central: Uint8Array[] = [];
  let offset = 0;
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const name = enc.encode(f.name); const crc = crc32(f.data); const size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}
const xesc = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i: number) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
export function downloadXlsx(sheet: Sheet, filename: string) {
  const enc = new TextEncoder();
  const rowsXml: string[] = [];
  let r = 0;
  const cell = (ci: number, v: string | number | null, style: number) => {
    const ref = colName(ci) + (r + 1);
    if (v === null || v === "") return style ? `<c r="${ref}" s="${style}"/>` : "";
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xesc(String(v))}</t></is></c>`;
  };
  const pushRow = (cells: string) => { rowsXml.push(`<row r="${r + 1}">${cells}</row>`); r++; };
  pushRow(cell(0, sheet.title, 4));
  if (sheet.subtitle) pushRow(cell(0, sheet.subtitle, 0));
  pushRow("");
  pushRow(sheet.header.map((h, i) => cell(i, h, 5)).join(""));
  sheet.rows.forEach((row, ri) => {
    const bold = sheet.boldRows?.has(ri);
    pushRow(row.map((v, i) => {
      const k = sheet.kinds?.[i] || "text";
      const st = typeof v === "number" ? (k === "qty" ? (bold ? 7 : 6) : (bold ? 3 : 2)) : bold ? 1 : 0;
      return cell(i, v, st);
    }).join(""));
  });
  const widths = sheet.widths || sheet.header.map((h, i) => Math.min(60, Math.max(h.length + 2, ...sheet.rows.slice(0, 400).map((x) => String(x[i] ?? "").length + 2), 10)));
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${rowsXml.join("")}</sheetData></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.###"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7F6EF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const sheetName = xesc(sheet.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Report");
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml },
    { name: "xl/styles.xml", data: styles },
  ].map((f) => ({ name: f.name, data: enc.encode(f.data) }));
  const bytes = zipStore(files);
  saveBlob(new Blob([bytes.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}
export const safeFile = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").trim();

/* ============================== Cell rendering ============================== */
function plain(col: Col, v: Cell): string | number | null {
  if (v === null || v === undefined || v === "") return null;
  if (col.kind === "date") return fmtDate(String(v));
  if (col.kind === "status") return String(v).toUpperCase();
  return v;
}
function show(col: Col, v: Cell, row?: RRow): React.ReactNode {
  if (v === null || v === undefined || v === "") return col.kind === "money" || col.kind === "qty" ? <span className="text-muted">--</span> : "";
  const suffix = row?.suffix?.[col.key] || "";
  switch (col.kind) {
    case "date": return fmtDate(String(v));
    case "money": return tk(Number(v)) + suffix;
    case "signed": return tk(Number(v)) + suffix;
    case "qty": return fq(Number(v)) + suffix;
    case "status": return <StatusPill status={String(v)} />;
    default: return String(v) + suffix;
  }
}
function toneOf(col: Col, row: RRow): string {
  const t = row.tone?.[col.key];
  if (t) return t;
  const v = row.c[col.key];
  if (col.tone && v !== null && v !== undefined && v !== "" && Number(v) !== 0) return col.tone;
  return "";
}
const isData = (r: RRow) => !r.variant || r.variant === "strong";

/* ============================== Component ============================== */
export default function ReportView({ report, biz }: { report: Report; biz: BizHead }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(report.defaultSort || "");
  const [open, setOpen] = useState<Set<string>>(new Set());

  function nav(patch: Record<string, string | null>) {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") sp.delete(k); else sp.set(k, v); }
    const qs = sp.toString();
    start(() => router.push(`/reports/${report.type}${qs ? "?" + qs : ""}`, { scroll: false }));
  }
  function setDate(r: DateRange) {
    if (r.key === "custom") nav({ range: "custom", from: r.from, to: r.to });
    else nav({ range: r.key, from: null, to: null });
  }

  // search + sort (client side; KPIs stay as computed on the server)
  const rows = useMemo(() => {
    let list = report.rows;
    const s = q.trim().toLowerCase();
    if (s) {
      const out: RRow[] = [];
      let parentOk = false;
      for (const r of list) {
        if (r.variant === "bf") { out.push(r); continue; }
        if (r.variant === "item") { if (parentOk) out.push(r); continue; }
        parentOk = Object.values(r.c).some((v) => v !== null && String(v).toLowerCase().includes(s)) || Object.values(r.sub || {}).some((v) => v.toLowerCase().includes(s));
        if (parentOk) out.push(r);
      }
      list = out;
    }
    if (sort && report.sortOptions && !list.some((r) => r.variant === "item")) {
      const head = list.filter((r) => r.variant === "bf");
      const body = list.filter((r) => r.variant !== "bf");
      const cmp: Record<string, (a: RRow, b: RRow) => number> = {
        latest: (a, b) => (b.sort?.d || "").localeCompare(a.sort?.d || ""),
        oldest: (a, b) => (a.sort?.d || "").localeCompare(b.sort?.d || ""),
        amount_desc: (a, b) => (b.sort?.a || 0) - (a.sort?.a || 0),
        amount_asc: (a, b) => (a.sort?.a || 0) - (b.sort?.a || 0),
        name_az: (a, b) => (a.sort?.n || "").localeCompare(b.sort?.n || ""),
        name_za: (a, b) => (b.sort?.n || "").localeCompare(a.sort?.n || ""),
        qty_desc: (a, b) => (b.sort?.q || 0) - (a.sort?.q || 0),
        qty_asc: (a, b) => (a.sort?.q || 0) - (b.sort?.q || 0),
      };
      if (cmp[sort]) list = [...head, ...[...body].sort(cmp[sort])];
    }
    return list;
  }, [report, q, sort]);

  const totals = useMemo(() => {
    if (!report.totals) return null;
    const t: Record<string, number> = {};
    for (const c of report.cols) if (c.total) t[c.key] = rows.filter(isData).reduce((a, r) => a + (Number(r.c[c.key]) || 0), 0);
    return t;
  }, [report, rows]);

  const rangeText = report.date ? (report.date.key === "all" ? "All Date" : report.date.from === report.date.to ? fmtDate(report.date.from) : `${fmtDate(report.date.from)} - ${fmtDate(report.date.to)}`) : `As of ${fmtDate(TODAY())}`;

  function sheet(): Sheet {
    const out: (string | number | null)[][] = [];
    const bold = new Set<number>();
    const push = (r: RRow, indent = "") => {
      if (r.variant === "green" || r.variant === "strong") bold.add(out.length);
      out.push(report.cols.map((c, i) => { const v = plain(c, r.c[c.key]); return i === 0 && typeof v === "string" ? indent + v : v; }));
      for (const ch of r.children || []) push(ch, indent + "    ");
    };
    rows.forEach((r) => push(r));
    if (totals) { bold.add(out.length); out.push(report.cols.map((c, i) => (c.total ? Math.round(totals[c.key] * 100) / 100 : i === 0 ? "Total" : null))); }
    return {
      title: `${biz.name} — ${report.fileTitle}`, subtitle: rangeText,
      header: report.cols.map((c) => c.label), rows: out, boldRows: bold,
      kinds: report.cols.map((c) => (c.kind === "money" || c.kind === "signed" ? "money" : c.kind === "qty" ? "qty" : "text")),
    };
  }
  const fname = (ext: string) => safeFile(`${report.fileTitle}_${report.date && report.date.key !== "all" ? `${report.date.from}_TO_${report.date.to}` : report.date ? "All Date" : TODAY()}`) + "." + ext;
  const doXlsx = () => downloadXlsx(sheet(), fname("xlsx"));
  const doCsv = () => downloadCsvSheet(sheet(), fname("csv"));

  const hasTable = report.cols.length > 0;
  const dataCount = report.rows.filter(isData).length;
  const numCols = report.cols.filter((c) => c.kind === "money" || c.kind === "qty" || c.kind === "signed");

  return (
    <div className={`rv ${pending ? "rv-pending" : ""}`}>
      <div className="page-head no-print">
        <div className="page-title">
          <Link href="/reports" className="back-btn" aria-label="Back to reports"><Icon name="back" size={18} /></Link>
          {report.title}
        </div>
        <div className="row">
          <button className="btn" onClick={() => window.print()} disabled={!hasTable}><Icon name="printer" size={15} />Print PDF</button>
          <SplitButton label="Download Excel" icon="download" onClick={doXlsx} disabled={!hasTable}
            items={[{ label: "Download PDF", icon: "printer", onClick: () => window.print() }, { label: "Download CSV", icon: "download", onClick: doCsv }, { label: "Download Excel (.xlsx)", icon: "download", onClick: doXlsx }]} />
        </div>
      </div>

      {/* Print-only letterhead */}
      <div className="rv-letterhead">
        <div className="row" style={{ gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={biz.logo || "/logo.svg"} alt="" />
          <div>
            <div className="rv-lh-name">{biz.name}</div>
            <div className="rv-lh-meta">{[biz.phone, biz.email, biz.address].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="rv-lh-title">{report.fileTitle}</div>
          <div className="rv-lh-meta">{rangeText}</div>
        </div>
      </div>

      <div className="toolbar rv-filters no-print">
        {report.searchable && hasTable && <SearchBox value={q} onChange={setQ} placeholder={report.searchable} width={230} />}
        {report.filters.map((f, i) => <FilterControl key={i} f={f} nav={nav} />)}
        {report.date && <DateFilter value={{ key: report.date.key, from: report.date.from, to: report.date.to, label: report.date.key === "custom" ? rangeText : report.date.label }} onChange={setDate} />}
        <span className="grow" />
        {report.sortOptions && hasTable && <SortMenu value={sort} options={report.sortOptions} onChange={setSort} />}
      </div>

      {report.kpis.length > 0 && (
        <div className="rv-kpis">
          {report.kpis.map((k, i) => (
            <div key={i} className="kpi"><div className={`v ${/^-?Tk\. 0$/.test(k.v) ? "" : k.tone || ""}`}>{k.v}</div><div className="l">{k.l}</div></div>
          ))}
        </div>
      )}

      {!hasTable ? (
        <div className="card"><Empty title={report.empty?.title || "Nothing to show"} text={report.empty?.text} icon={report.empty?.icon || "statement"} /></div>
      ) : dataCount === 0 && !report.rows.some((r) => r.variant === "bf" || r.variant === "green") ? (
        <div className="card"><Empty title={report.empty?.title || "No Data Found"} text={report.empty?.text} icon={report.empty?.icon || "statement"} /></div>
      ) : (
        <div className={`table-wrap rv-table ${report.compact ? "rv-compact" : ""}`}>
          <table className="tbl">
            <thead>
              <tr>
                {report.cols.map((c) => <th key={c.key} className={c.kind === "money" || c.kind === "qty" || c.kind === "signed" ? "num" : ""} style={c.minWidth ? { minWidth: c.minWidth } : undefined}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => <RowView key={r.id} r={r} cols={report.cols} open={open} toggle={(id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })} onGo={(h) => router.push(h)} />)}
              {rows.length === 0 && <tr><td colSpan={report.cols.length} className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>No rows match “{q}”.</td></tr>}
            </tbody>
            {totals && rows.length > 0 && (
              <tfoot>
                <tr className="rv-total">
                  {report.cols.map((c, i) => (
                    <td key={c.key} className={numCols.includes(c) ? "num" : ""}>
                      {c.total ? (c.kind === "qty" ? fq(totals[c.key]) : tk(Math.round(totals[c.key] * 100) / 100)) : i === 0 ? `Total (${rows.filter(isData).length})` : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {report.note && hasTable && <p className="rv-note"><Icon name="info" size={13} /> {report.note}</p>}
      <div className="rv-printfoot">Generated by Hishab on {fmtDate(TODAY())}</div>
    </div>
  );
}

function RowView({ r, cols, open, toggle, onGo, depth = 0 }: { r: RRow; cols: Col[]; open: Set<string>; toggle: (id: string) => void; onGo: (h: string) => void; depth?: number }) {
  const expandable = !!r.children?.length;
  const isOpen = open.has(r.id);
  const cls = [r.href ? "clickable" : "", r.variant ? `rv-${r.variant}` : "", depth ? "rv-child" : "", expandable ? "clickable" : ""].join(" ");
  return (
    <>
      <tr className={cls} onClick={() => (expandable ? toggle(r.id) : r.href ? onGo(r.href) : undefined)}>
        {cols.map((c, i) => {
          const num = c.kind === "money" || c.kind === "qty" || c.kind === "signed";
          return (
            <td key={c.key} className={`${num ? "num" : ""} ${toneOf(c, r)}`} style={i === 0 && depth ? { paddingLeft: `${1.1 + depth * 1.4}rem` } : undefined}
              colSpan={r.variant === "item" && i === 1 ? cols.length - 1 : undefined}
              hidden={r.variant === "item" && i > 1}>
              {i === 0 && expandable ? (
                <span className="rv-exp"><Icon name={isOpen ? "chevronDown" : "chevronRight"} size={14} className="rv-chev" />{show(c, r.c[c.key], r)}</span>
              ) : i === 1 && r.variant === "item" ? <span className="rv-itemline">{String(r.c[c.key] ?? "")}</span> : show(c, r.c[c.key], r)}
              {r.sub?.[c.key] && <div className="sub">{r.sub[c.key]}</div>}
            </td>
          );
        })}
      </tr>
      {expandable && isOpen && r.children!.map((ch) => <RowView key={ch.id} r={ch} cols={cols} open={open} toggle={toggle} onGo={onGo} depth={depth + 1} />)}
    </>
  );
}

function FilterControl({ f, nav }: { f: Filter; nav: (p: Record<string, string | null>) => void }) {
  switch (f.kind) {
    case "picker":
      return <div style={{ width: f.width || 240 }}><Picker value={f.value} options={f.options} placeholder={f.placeholder} onChange={(id) => nav({ [f.param]: id })} clearable={f.clearable} /></div>;
    case "select":
      return <FilterSelect value={f.value} options={f.options} onChange={(v) => nav({ [f.param]: v === "all" ? null : v })} />;
    case "switch":
      return <label className="chip" style={{ cursor: "pointer" }}><Switch on={f.value} onChange={(v) => nav({ [f.param]: v ? "1" : null })} />{f.label}</label>;
    case "check":
      return (
        <label className="chip" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={f.value} onChange={(e) => nav({ [f.param]: e.target.checked ? "1" : null })} style={{ accentColor: "var(--brand)" }} />{f.label}
        </label>
      );
    case "seg":
      return <Seg value={f.value} options={f.options} onChange={(v) => nav({ [f.param]: v === f.options[0].v ? null : v })} />;
  }
}
