// Pure formatting helpers — safe to import from both server and client components.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-21" → "21 Sep 2026" (Karbar's date style). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "--";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

/** Money with Western digits: "Tk. 4,675" / "Tk. 1,234.50". Negative → "-Tk. 50". */
export function tk(n: number | null | undefined, symbol = "Tk."): string {
  const v = Number(n) || 0;
  const hasFraction = Math.abs(v % 1) > 1e-9;
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 });
  return `${v < 0 ? "-" : ""}${symbol} ${s}`;
}

/** Quantity: up to 3 decimals, no trailing zeros. */
export function qty(n: number | null | undefined): string {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen",
  "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) { parts.push(ONES[Math.floor(n / 100)] + " Hundred"); n %= 100; }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "")); }
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(" ");
}

/** International grouping, like Karbar: 4675 → "Four Thousand Six Hundred Seventy Five". */
function intWords(n: number): string {
  if (n === 0) return "Zero";
  const scales: [number, string][] = [[1e12, "Trillion"], [1e9, "Billion"], [1e6, "Million"], [1e3, "Thousand"]];
  const out: string[] = [];
  for (const [v, name] of scales) {
    if (n >= v) { out.push(below1000(Math.floor(n / v)) + " " + name); n %= v; }
  }
  if (n > 0) out.push(below1000(n));
  return out.join(" ");
}

/** "Four Thousand Six Hundred Seventy Five Taka Only" (+ "and Fifty Paisa"). */
export function amountInWords(amount: number): string {
  const v = Math.abs(Number(amount) || 0);
  const taka = Math.floor(v + 1e-9);
  const paisa = Math.round((v - taka) * 100);
  let s = intWords(taka) + " Taka";
  if (paisa > 0) s += " and " + intWords(paisa) + " Paisa";
  return s + " Only";
}

export function initials(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n) return "?";
  const words = n.split(/\s+/).filter(Boolean);
  const first = Array.from(words[0] || "")[0] || "";
  const second = words.length > 1 ? Array.from(words[1])[0] || "" : Array.from(words[0])[1] || "";
  return (first + second).toUpperCase();
}

export const TODAY = () => new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10); // Asia/Dhaka date
