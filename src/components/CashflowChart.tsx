"use client";
// Dashboard "Cashflow" card: Daily / Weekly / Monthly selector + grouped bars (money in vs out). Inline SVG, theme-aware.
import { useState } from "react";
import { Dropdown, Icon } from "./ui";

export type CashSeries = { label: string; in: number; out: number }[];
type Mode = "daily" | "weekly" | "monthly";
const TITLES: Record<Mode, string> = { daily: "Last 7 days", weekly: "Last 8 weeks", monthly: "Last 12 months" };
const NAMES: Record<Mode, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

export default function CashflowChart({ series, symbol = "Tk.", hide = false }: { series: Record<Mode, CashSeries>; symbol?: string; hide?: boolean }) {
  const [mode, setMode] = useState<Mode>("daily");
  const data = series[mode];
  const totIn = data.reduce((a, b) => a + b.in, 0);
  const totOut = data.reduce((a, b) => a + b.out, 0);
  const m = (n: number) => (hide ? `${symbol} ••••` : `${symbol} ${Math.round(n).toLocaleString("en-US")}`);

  return (
    <div className="db-card">
      <div className="db-card-h">
        <h2>Cashflow <span className="text-muted" style={{ fontWeight: 500, fontSize: 13 }}>({TITLES[mode]})</span></h2>
        <Dropdown width={140} trigger={(t) => (
          <button type="button" className="chip" onClick={t}>{NAMES[mode]}<Icon name="chevronDown" size={13} /></button>
        )}>
          {(close) => (Object.keys(NAMES) as Mode[]).map((k) => (
            <button key={k} onClick={() => { setMode(k); close(); }} style={{ fontWeight: k === mode ? 700 : 400 }}>
              {NAMES[k]}{k === mode && <Icon name="check" size={14} style={{ marginLeft: "auto", color: "var(--brand)" }} />}
            </button>
          ))}
        </Dropdown>
      </div>
      <div className="db-card-b">
        <Bars data={data} hideAxis={hide} />
        <div className="db-legend">
          <span><i style={{ background: "var(--brand)" }} />Total Money In: <b>{m(totIn)}</b></span>
          <span><i style={{ background: "var(--red)" }} />Total Money Out: <b>{m(totOut)}</b></span>
        </div>
      </div>
    </div>
  );
}

function short(v: number) {
  if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + "M";
  if (v >= 1000) return (v / 1000).toFixed(v % 1000 ? 1 : 0) + "k";
  return String(Math.round(v));
}

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= v) return k * p;
  return 10 * p;
}

export function Bars({ data, hideAxis }: { data: CashSeries; hideAxis?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 240, padL = 46, padB = 26, padT = 12, padR = 8;
  const max = niceMax(Math.max(0, ...data.flatMap((d) => [d.in, d.out])));
  const plotW = W - padL - padR, plotH = H - padB - padT;
  const gw = plotW / data.length;
  const bw = Math.min(22, gw / 3.2);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Cashflow chart" style={{ display: "block" }}>
        {ticks.map((f) => {
          const y = padT + plotH - f * plotH;
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeDasharray={f === 0 ? undefined : "3 4"} />
              {!hideAxis && <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10.5" fill="var(--muted)">{short(max * f)}</text>}
            </g>
          );
        })}
        {data.map((d, i) => {
          const gx = padL + i * gw + gw / 2;
          const hIn = (d.in / max) * plotH, hOut = (d.out / max) * plotH;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * gw} y={padT} width={gw} height={plotH} fill={hover === i ? "var(--hover)" : "transparent"} />
              <rect x={gx - bw - 1.5} y={padT + plotH - hIn} width={bw} height={Math.max(hIn, d.in > 0 ? 1.5 : 0)} rx="3" fill="var(--brand)" />
              <rect x={gx + 1.5} y={padT + plotH - hOut} width={bw} height={Math.max(hOut, d.out > 0 ? 1.5 : 0)} rx="3" fill="var(--red)" />
              <text x={gx} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--muted)">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && !hideAxis && (
        <div className="menu" style={{ position: "absolute", top: 4, left: `${Math.min(80, ((hover + 0.5) / data.length) * 100)}%`, minWidth: 150, padding: ".5rem .65rem", pointerEvents: "none", fontSize: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{data[hover].label}</div>
          <div className="between"><span className="text-muted">In</span><b className="pos">{Math.round(data[hover].in).toLocaleString("en-US")}</b></div>
          <div className="between"><span className="text-muted">Out</span><b className="neg">{Math.round(data[hover].out).toLocaleString("en-US")}</b></div>
        </div>
      )}
    </div>
  );
}
