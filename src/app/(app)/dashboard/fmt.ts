// Money / period helpers shared by the dashboard and insights pages (server-safe, no DB access).
import type { BizSettings } from "@/lib/settings";

export type MoneyFmt = (n: number | null | undefined) => string;

/** Money formatter honouring currency symbol/position, number format and privacy mode. */
export function makeMoney(symbol: string, s: Pick<BizSettings, "currency_position" | "number_format" | "privacy_mode">, respectPrivacy = true): MoneyFmt {
  return (n) => {
    const v = Number(n) || 0;
    if (respectPrivacy && s.privacy_mode) return `${symbol} ••••`;
    const frac = Math.abs(v % 1) > 1e-9;
    const body = Math.abs(v).toLocaleString(s.number_format === "indian" ? "en-IN" : "en-US", { minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: 2 });
    const sign = v < 0 ? "-" : "";
    return s.currency_position === "end" ? `${sign}${body} ${symbol}` : `${sign}${symbol} ${body}`;
  };
}

/* ---------- ISO date arithmetic (UTC, dates are plain YYYY-MM-DD) ---------- */
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const D = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(s: string, n: number) { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
export function addMonths(s: string, n: number) { const d = D(s); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); }
export function startOfWeek(s: string) { const d = D(s); return addDays(s, -((d.getUTCDay() + 6) % 7)); } // Monday
export function startOfMonth(s: string) { return s.slice(0, 8) + "01"; }
export function startOfQuarter(s: string) { const m = Number(s.slice(5, 7)); const qm = Math.floor((m - 1) / 3) * 3 + 1; return `${s.slice(0, 4)}-${String(qm).padStart(2, "0")}-01`; }
export const dayLabel = (s: string) => `${Number(s.slice(8, 10))} ${MON[Number(s.slice(5, 7)) - 1]}`;
export const monLabel = (s: string) => `${MON[Number(s.slice(5, 7)) - 1]} ${s.slice(2, 4)}`;

export type Period = "daily" | "weekly" | "monthly" | "quarterly";
export type Bucket = { from: string; to: string; label: string; long: string };

/** The last `n` periods ending with the one containing `today` (oldest first). */
export function buckets(period: Period, today: string, n: number): Bucket[] {
  const out: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    if (period === "daily") {
      const d = addDays(today, -i);
      out.push({ from: d, to: d, label: dayLabel(d), long: i === 0 ? "Today" : dayLabel(d) + " " + d.slice(0, 4) });
    } else if (period === "weekly") {
      const s = addDays(startOfWeek(today), -7 * i);
      out.push({ from: s, to: addDays(s, 6), label: dayLabel(s), long: i === 0 ? "This Week" : `Week of ${dayLabel(s)}` });
    } else if (period === "monthly") {
      const s = addMonths(startOfMonth(today), -i);
      out.push({ from: s, to: addDays(addMonths(s, 1), -1), label: monLabel(s), long: MONTH_LONG[Number(s.slice(5, 7)) - 1] + (s.slice(0, 4) !== today.slice(0, 4) ? " " + s.slice(0, 4) : "") });
    } else {
      const s = addMonths(startOfQuarter(today), -3 * i);
      const q = Math.floor((Number(s.slice(5, 7)) - 1) / 3) + 1;
      out.push({ from: s, to: addDays(addMonths(s, 3), -1), label: `Q${q} ${s.slice(2, 4)}`, long: `Q${q} ${s.slice(0, 4)}` });
    }
  }
  return out;
}

/** Sum a {date → amount} map into buckets. */
export function fill(bks: Bucket[], byDate: Record<string, number>): number[] {
  const out = bks.map(() => 0);
  for (const [d, v] of Object.entries(byDate)) {
    for (let i = 0; i < bks.length; i++) if (d >= bks[i].from && d <= bks[i].to) { out[i] += v; break; }
  }
  return out;
}
