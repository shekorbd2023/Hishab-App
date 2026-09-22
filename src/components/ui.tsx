"use client";
// Shared UI kit — Karbar-style building blocks used by every screen.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* ============================== Icons ============================== */
const P: Record<string, string> = {
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35",
  plus: "M12 5v14M5 12h14",
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 6 6 6-6 6",
  chevronLeft: "m15 6-6 6 6 6",
  back: "M19 12H5m7 7-7-7 7-7",
  more: "M12 5h.01M12 12h.01M12 19h.01",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  printer: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
  download: "M12 3v12m0 0 5-5m-5 5-5-5M4 21h16",
  upload: "M12 21V9m0 0 5 5m-5-5-5 5M4 3h16",
  edit: "M4 20h4L18.5 9.5a2.83 2.83 0 0 0-4-4L4 16v4Zm9.5-13.5 4 4",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
  filter: "M3 5h18l-7 8v6l-4 2v-8L3 5Z",
  sort: "M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3",
  calendar: "M4 6h16v15H4zM4 10h16M9 3v4m6-4v4",
  x: "M18 6 6 18M6 6l12 12",
  check: "m5 12 5 5L20 7",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  box: "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8",
  tag: "M3 12V3h9l9 9-9 9-9-9Zm5-4.5h.01",
  cart: "M3 3h2l2.5 12h11L21 7H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  receipt: "M6 2h12v20l-3-2-3 2-3-2-3 2V2Zm3 6h6m-6 4h6m-6 4h4",
  income: "M3 7h18v12H3zM3 11h18M7 15h3",
  bank: "M3 10 12 4l9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18",
  wallet: "M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2Zm14 7h.01",
  cash: "M2 7h20v10H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 12h.01M18 12h.01",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  staff: "M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0M19 8l2 2-2 2",
  import: "M12 3v12m0 0 4-4m-4 4-4-4M5 21h14a2 2 0 0 0 2-2v-4M3 15v4a2 2 0 0 0 2 2",
  tools: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-2.5-13a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14m0 3h.01",
  video: "M3 6h13v12H3zM16 10l5-3v10l-5-3",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4a7.5 7.5 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z",
  bell: "M6 9a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8Zm4.5 12a1.5 1.5 0 0 0 3 0",
  keyboard: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
  logout: "M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7",
  whatsapp: "M20 12a8 8 0 0 1-11.8 7L4 20l1.1-4.1A8 8 0 1 1 20 12Zm-11-3c0 3.5 2.5 6 6 6l1-1.5-2-1-1 1a4 4 0 0 1-2.5-2.5l1-1-1-2L9 9Z",
  copy: "M8 8h12v12H8zM4 16V4h12",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-10v5m0-8h.01",
  image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9h.01",
  camera: "M4 8h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  barcode: "M3 5v14M6 5v14M9 5v14M13 5v14M16 5v14M19 5v14M21 5v14",
  scan: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10",
  minus: "M5 12h14",
  statement: "M7 3h10l4 4v14H3V3h4Zm0 6h10M7 13h10M7 17h6",
  swap: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4m4 4H7",
  arrowUp: "M12 19V5m-7 7 7-7 7 7",
  arrowDown: "M12 5v14m7-7-7 7-7-7",
  pos: "M4 4h16v10H4zM8 18h8M12 14v4",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  gift: "M4 11h16v10H4zM2 7h20v4H2zM12 7v14M12 7S10 3 7.5 3a2 2 0 0 0 0 4H12Zm0 0s2-4 4.5-4a2 2 0 0 1 0 4H12Z",
  card: "M3 5h18v14H3zM3 10h18M7 15h4",
  audit: "M9 11l2 2 4-4M5 3h14v18l-7-4-7 4V3Z",
  reminder: "M12 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2M5 3 2 6m17-3 3 3",
  backup: "M4 7c0-2 3.6-3 8-3s8 1 8 3-3.6 3-8 3-8-1-8-3Zm0 0v10c0 2 3.6 3 8 3s8-1 8-3V7M4 12c0 2 3.6 3 8 3s8-1 8-3",
  percent: "M19 5 5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
};
export type IconName = keyof typeof P | string;

export function Icon({ name, size = 16, stroke = 1.8, style, className }: { name: IconName; size?: number; stroke?: number; style?: React.CSSProperties; className?: string }) {
  const d = P[name] || P.info;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }} className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

/* ============================== Outside-click hook ============================== */
export function useOutside<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open, onClose]);
  return ref;
}

/* ============================== Dropdown menu ============================== */
export type MenuItem =
  | { label: string; icon?: IconName; onClick?: () => void; href?: string; danger?: boolean; disabled?: boolean }
  | { sep: true }
  | { heading: string };

export function Dropdown({
  trigger, items, align = "right", width, children,
}: {
  trigger: (toggle: () => void, open: boolean) => React.ReactNode;
  items?: MenuItem[];
  align?: "left" | "right";
  width?: number;
  children?: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const ref = useOutside<HTMLDivElement>(open, close);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      {trigger(() => setOpen((o) => !o), open)}
      {open && (
        <div className="menu" style={{ top: "calc(100% + 4px)", [align]: 0, minWidth: width } as React.CSSProperties}>
          {children
            ? children(close)
            : (items || []).map((it, i) => {
                if ("sep" in it) return <div key={i} className="sep" />;
                if ("heading" in it) return <div key={i} className="menu-label">{it.heading}</div>;
                const inner = (<>{it.icon && <Icon name={it.icon} size={15} />}{it.label}</>);
                return it.href ? (
                  <Link key={i} href={it.href} className={it.danger ? "danger" : ""} onClick={close}>{inner}</Link>
                ) : (
                  <button key={i} className={it.danger ? "danger" : ""} disabled={it.disabled} onClick={() => { close(); it.onClick?.(); }}>{inner}</button>
                );
              })}
        </div>
      )}
    </div>
  );
}

/** Green primary button with a ▾ part that opens a menu (Karbar "Add Party ▾", "Save Sales Invoice ▾"). */
export function SplitButton({ label, icon, onClick, href, items, type, disabled }: {
  label: string; icon?: IconName; onClick?: () => void; href?: string; items: MenuItem[]; type?: "button" | "submit"; disabled?: boolean;
}) {
  return (
    <Dropdown
      items={items}
      trigger={(toggle) => (
        <span className="split">
          {href ? (
            <Link href={href} className="btn btn-primary">{icon && <Icon name={icon} size={15} />}{label}</Link>
          ) : (
            <button type={type || "button"} className="btn btn-primary" onClick={onClick} disabled={disabled}>{icon && <Icon name={icon} size={15} />}{label}</button>
          )}
          <button type="button" className="btn btn-primary" onClick={toggle} aria-label="More"><Icon name="chevronDown" size={14} /></button>
        </span>
      )}
    />
  );
}

export function MoreButton({ items, label = "More actions" }: { items: MenuItem[]; label?: string }) {
  return (
    <Dropdown items={items} trigger={(t) => (
      <button type="button" className="btn btn-icon btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); t(); }} title={label} aria-label={label}>
        <Icon name="more" size={16} />
      </button>
    )} />
  );
}

/* ============================== Modal ============================== */
export function Modal({ title, onClose, children, footer, width = 520 }: {
  title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" style={{ width: `min(${width}px, 100%)` }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{title}</span>
          <button className="btn btn-icon btn-sm btn-ghost" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-body scroll-thin">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ============================== Small pieces ============================== */
export function Avatar({ name, img, size, soft }: { name: string; img?: string | null; size?: "lg"; soft?: boolean }) {
  const initials = useMemo(() => {
    const w = (name || "?").trim().split(/\s+/);
    const a = Array.from(w[0] || "?")[0] || "?";
    const b = w.length > 1 ? Array.from(w[1])[0] || "" : Array.from(w[0] || "")[1] || "";
    return (a + b).toUpperCase();
  }, [name]);
  return (
    <span className={`avatar ${size || ""} ${soft ? "soft" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {img ? <img src={img} alt="" /> : initials}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const cls = s === "paid" ? "pill-paid" : s === "partial" ? "pill-partial" : s === "unpaid" ? "pill-unpaid" : "pill-muted";
  return <span className={`pill ${cls}`}>{s === "partial" ? "Partial" : s || "--"}</span>;
}

export function Empty({ title, text, action, icon = "statement" }: { title: string; text?: string; action?: React.ReactNode; icon?: IconName }) {
  return (
    <div className="empty">
      <div style={{ width: 84, height: 84, borderRadius: 18, background: "var(--hover)", display: "grid", placeItems: "center", color: "var(--faint)" }}>
        <Icon name={icon} size={40} stroke={1.3} />
      </div>
      <h3>{title}</h3>
      {text && <div style={{ maxWidth: 360 }}>{text}</div>}
      {action && <div style={{ marginTop: ".6rem" }}>{action}</div>}
    </div>
  );
}

export function Kpi({ value, label, tone }: { value: React.ReactNode; label: string; tone?: "pos" | "neg" }) {
  return (
    <div className="kpi">
      <div className={`v ${tone || ""}`}>{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}

export function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <button type="button" className={`switch ${on ? "on" : ""}`} onClick={() => !disabled && onChange(!on)} aria-pressed={on} disabled={disabled} />;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button type="button" key={o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, width = 240, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; width?: number | string; autoFocus?: boolean }) {
  return (
    <div className="search" style={{ width }}>
      <Icon name="search" size={15} />
      <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />
    </div>
  );
}

export function BackButton({ href }: { href?: string }) {
  return href ? (
    <Link href={href} className="back-btn" aria-label="Go back"><Icon name="back" size={18} /></Link>
  ) : (
    <button className="back-btn" onClick={() => history.back()} aria-label="Go back"><Icon name="back" size={18} /></button>
  );
}

/* ============================== Filter select (chip with menu) ============================== */
export function FilterSelect({ value, options, onChange, icon }: { value: string; options: { v: string; l: string }[]; onChange: (v: string) => void; icon?: IconName }) {
  const cur = options.find((o) => o.v === value) || options[0];
  return (
    <Dropdown align="left" trigger={(t) => (
      <button type="button" className="chip" onClick={t}>{icon && <Icon name={icon} size={14} />}{cur?.l}<Icon name="chevronDown" size={13} /></button>
    )}>
      {(close) => options.map((o) => (
        <button key={o.v} onClick={() => { onChange(o.v); close(); }} style={{ fontWeight: o.v === value ? 700 : 400 }}>
          {o.l}{o.v === value && <Icon name="check" size={14} style={{ marginLeft: "auto", color: "var(--brand)" }} />}
        </button>
      ))}
    </Dropdown>
  );
}

export function SortMenu({ value, options, onChange }: { value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <Dropdown trigger={(t) => (<button type="button" className="chip" onClick={t}><Icon name="sort" size={14} />Sort By</button>)}>
      {(close) => options.map((o) => (
        <button key={o.v} onClick={() => { onChange(o.v); close(); }}>
          <span style={{ width: 14 }}>{o.v === value && <Icon name="check" size={14} style={{ color: "var(--brand)" }} />}</span>{o.l}
        </button>
      ))}
    </Dropdown>
  );
}

/* ============================== Date range filter ============================== */
export type DateRange = { key: string; from: string; to: string; label: string };
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export function rangeFor(key: string): DateRange {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const mk = (a: Date, b: Date, label: string): DateRange => ({ key, from: iso(a), to: iso(b), label });
  switch (key) {
    case "today": return mk(now, now, "Today");
    case "yesterday": { const t = new Date(y, m, d - 1); return mk(t, t, "Yesterday"); }
    case "week": { const s = new Date(y, m, d - ((now.getDay() + 6) % 7)); return mk(s, now, "This Week"); }
    case "month": return mk(new Date(y, m, 1), new Date(y, m + 1, 0), "This Month");
    case "last_month": return mk(new Date(y, m - 1, 1), new Date(y, m, 0), "Last Month");
    case "fiscal": { const fy = m >= 6 ? y : y - 1; return mk(new Date(fy, 6, 1), new Date(fy + 1, 5, 30), "This Fiscal Year"); }
    case "year": return mk(new Date(y, 0, 1), new Date(y, 11, 31), "This Year");
    default: return { key: "all", from: "0000-01-01", to: "9999-12-31", label: "All Date" };
  }
}
export function DateFilter({ value, onChange, allowAll = true }: { value: DateRange; onChange: (r: DateRange) => void; allowAll?: boolean }) {
  const [from, setFrom] = useState(value.key === "custom" ? value.from : "");
  const [to, setTo] = useState(value.key === "custom" ? value.to : "");
  const keys = [...(allowAll ? ["all"] : []), "today", "yesterday", "week", "month", "last_month", "fiscal", "year"];
  return (
    <Dropdown align="left" width={250} trigger={(t) => (
      <button type="button" className="chip" onClick={t}>{value.label}<Icon name="calendar" size={14} /></button>
    )}>
      {(close) => (
        <div style={{ display: "grid", gap: 2 }}>
          {keys.map((k) => { const r = rangeFor(k); return (
            <button key={k} onClick={() => { onChange(r); close(); }} style={{ fontWeight: value.key === k ? 700 : 400 }}>{r.label}</button>
          ); })}
          <div className="sep" />
          <div className="menu-label">Custom range</div>
          <div style={{ display: "flex", gap: 6, padding: "0 .5rem" }}>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, padding: ".4rem .5rem .2rem" }}>
            <button className="btn btn-sm" style={{ width: "auto" }} onClick={close}>Cancel</button>
            <button className="btn btn-sm btn-primary" style={{ width: "auto", color: "#fff" }} disabled={!from || !to}
              onClick={() => { onChange({ key: "custom", from, to, label: `${from} → ${to}` }); close(); }}>Apply</button>
          </div>
        </div>
      )}
    </Dropdown>
  );
}

/* ============================== Searchable picker (party / item) ============================== */
export type PickOption = { id: string; label: string; sub?: string; right?: string; rightTone?: "pos" | "neg"; data?: unknown };
export function Picker({
  value, options, onChange, placeholder, onCreate, createLabel, allowFree, freeText, onFreeText, clearable, width, autoFocus,
}: {
  value: string | null; options: PickOption[]; onChange: (id: string | null, opt?: PickOption) => void; placeholder: string;
  onCreate?: (text: string) => void; createLabel?: string; allowFree?: boolean; freeText?: string; onFreeText?: (t: string) => void;
  clearable?: boolean; width?: number | string; autoFocus?: boolean;
}) {
  const cur = options.find((o) => o.id === value) || null;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? options.filter((o) => o.label.toLowerCase().includes(s) || (o.sub || "").toLowerCase().includes(s)) : options;
    return list.slice(0, 80);
  }, [q, options]);
  const display = open ? q : cur ? cur.label : allowFree ? freeText || "" : "";
  function pick(o: PickOption) { onChange(o.id, o); setOpen(false); setQ(""); }
  return (
    <div ref={ref} style={{ position: "relative", width: width || "100%" }}>
      <input
        className="input" value={display} placeholder={placeholder} autoFocus={autoFocus}
        onFocus={() => { setOpen(true); setQ(allowFree && !cur ? freeText || "" : ""); setHi(0); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); if (allowFree) { onFreeText?.(e.target.value); if (cur) onChange(null); } }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, shown.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); if (shown[hi]) pick(shown[hi]); else setOpen(false); }
          else if (e.key === "Tab") setOpen(false);
        }}
        style={{ paddingRight: clearable && cur ? 56 : 30 }}
      />
      <span style={{ position: "absolute", right: 8, top: 10, color: "var(--muted)", pointerEvents: "none" }}><Icon name="chevronDown" size={14} /></span>
      {clearable && cur && !open && (
        <button type="button" onClick={() => onChange(null)} style={{ position: "absolute", right: 28, top: 8, border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }} aria-label="Clear"><Icon name="x" size={14} /></button>
      )}
      {open && (
        <div className="menu scroll-thin" style={{ left: 0, right: 0, top: "calc(100% + 4px)", maxHeight: 280, overflow: "auto" }}>
          {onCreate && (
            <button type="button" onClick={() => { onCreate(q); setOpen(false); }} style={{ color: "var(--brand)", fontWeight: 600 }}>
              <Icon name="plus" size={14} />{createLabel || "Add new"}{q ? ` “${q}”` : ""}
            </button>
          )}
          {shown.length === 0 && <div className="menu-label" style={{ padding: ".6rem" }}>No match</div>}
          {shown.map((o, i) => (
            <button type="button" key={o.id} onMouseEnter={() => setHi(i)} onClick={() => pick(o)}
              style={{ background: i === hi ? "var(--hover)" : undefined, justifyContent: "space-between" }}>
              <span style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.label}</div>
                {o.sub && <div className="sub">{o.sub}</div>}
              </span>
              {o.right && <span className={o.rightTone || ""} style={{ fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>{o.right}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== Image attach (data URLs) ============================== */
export function ImageAttach({ images, onChange, max = 4 }: { images: string[]; onChange: (imgs: string[]) => void; max?: number }) {
  const input = useRef<HTMLInputElement>(null);
  async function add(files: FileList | null) {
    if (!files) return;
    const out = [...images];
    for (const f of Array.from(files).slice(0, max - images.length)) {
      out.push(await shrinkImage(f, 1400));
    }
    onChange(out);
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {images.map((src, i) => (
        <div key={i} style={{ position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
          <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} className="btn btn-icon btn-sm" style={{ position: "absolute", top: -8, right: -8, borderRadius: 99, width: 22, height: 22 }}><Icon name="x" size={12} /></button>
        </div>
      ))}
      {images.length < max && (
        <button type="button" onClick={() => input.current?.click()} style={{ width: 64, height: 64, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", display: "grid", placeItems: "center", color: "var(--muted)", cursor: "pointer" }} title="Attach images">
          <Icon name="camera" size={22} />
        </button>
      )}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

/** Downscale an image file to a JPEG data URL (keeps the database small). */
export function shrinkImage(file: File, maxSide = 600, type = "image/jpeg"): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext("2d")!;
        if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(type, 0.86));
      };
      img.onerror = reject;
      img.src = String(r.result);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ============================== Toast ============================== */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2600); return () => clearTimeout(t); }, [msg]);
  return { toast: setMsg, node: msg ? <div className="toast">{msg}</div> : null };
}

/* ============================== POST helper ============================== */
export async function post<T = Record<string, unknown>>(url: string, body: unknown): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let data = {} as T & { error?: string };
  try { data = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok && !(data as { error?: string }).error, data };
}
