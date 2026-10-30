// FIFO cost engine — replays every stock movement of every item in date order and
// works out what each sold unit actually cost (oldest stock is sold first).
// Server only. Nothing is stored: the result is derived from the transactions each time,
// like every other balance in Hishab.
//
// Costs used:
//  • Opening stock → the item's purchase price (the only cost Hishab has for it).
//  • Purchase bill line → landed unit cost = (line amount − its share of the bill discount
//    + its share of additional charges such as transport) ÷ qty.
//  • Purchase return → removes the oldest stock (FIFO), no effect on profit.
//  • Sales return → goes back into stock at the cost it was sold at (the original
//    invoice's FIFO cost when the return was made from it, else the item's latest sale cost).
//  • Stock adjustment + → stock at the latest known cost; − → removes the oldest stock.
//  • If more is sold than is in stock (stock goes negative — e.g. the purchase bill was entered
//    with a later date), the missing units wait for the NEXT purchase of that item and take its
//    cost. Only if no purchase ever comes are they costed at the latest known cost / the item's
//    purchase price. Either way they are reported as "short".
//  • Every sale remembers WHERE its cost came from (opening stock, which purchase bill, …) so
//    the invoice profit panel can explain a surprising cost.
import { all } from "./db";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const EPS = 1e-9;

export type SaleLine = {
  lineId: string;
  docId: string;
  docNumber: number;
  date: string;
  itemId: string;
  party: string | null;
  qty: number;
  revenue: number;   // after line + bill discount, excluding tax
  cost: number;      // FIFO cost of the units sold
  shortQty: number;  // units sold with no stock behind them (cost estimated)
  isReturn: boolean; // sales return line: qty/revenue/cost are negative
  sources: CostSource[]; // where the cost came from, oldest first
};

/** One slice of a sale's cost: `qty` units at `unitCost` from `kind` (docId/number when it is a document). */
export type CostSource = {
  kind: "opening" | "purchase" | "sales_return" | "adjustment" | "later_purchase" | "estimate";
  qty: number; unitCost: number; docId?: string; docNumber?: number; date?: string;
};

type Lot = { qty: number; cost: number; src: Omit<CostSource, "qty" | "unitCost"> };
type Ev = {
  key: string; date: string; created: string; prio: number; itemId: string;
  type: "open" | "buy" | "sret" | "adj+" | "pret" | "sale" | "adj-";
  qty: number; unitCost?: number; revenue?: number;
  docId?: string; docNumber?: number; sourceId?: string | null; party?: string | null; lineId?: string;
};
const PRIO: Record<Ev["type"], number> = { open: 0, buy: 1, sret: 2, "adj+": 3, pret: 4, sale: 5, "adj-": 6 };

type DocLine = {
  id: string; item_id: string; qty: number; amount: number; tax_rate: number;
  doc_id: string; kind: string; number: number; date: string; created_at: string;
  doc_discount: number; charges: string | null; source_id: string | null; pname: string | null;
};

/** Run FIFO over the whole history of a business. Returns one row per sales / sales-return line. */
export async function fifoSales(bid: string): Promise<{ lines: SaleLine[]; onHand: Record<string, { qty: number; value: number }> }> {
  const items = await all<{ id: string; opening_stock: number; purchase_price: number; created_at: string; type: string }>(
    "SELECT id, opening_stock, purchase_price, created_at, type FROM items WHERE business_id=?", [bid]);
  const lines = await all<DocLine>(
    `SELECT di.id, di.item_id, di.qty, di.amount, di.tax_rate, d.id doc_id, d.kind, d.number, d.date, d.created_at,
            d.doc_discount, d.charges, d.source_id, p.name pname
       FROM doc_items di JOIN documents d ON d.id=di.document_id LEFT JOIN parties p ON p.id=d.party_id
      WHERE d.business_id=? AND di.item_id IS NOT NULL
        AND d.kind IN ('sales_invoice','purchase_bill','sales_return','purchase_return')`, [bid]);
  const adjs = await all<{ id: string; item_id: string; qty_delta: number; date: string; created_at: string }>(
    "SELECT id, item_id, qty_delta, date, created_at FROM stock_adjustments WHERE business_id=?", [bid]);

  // Bill-level discount / charges are shared out over ALL of the document's lines by amount
  // (lines not linked to an item take their share too — same rule as docProfits below).
  const docSum: Record<string, number> = {};
  for (const r of await all<{ document_id: string; s: number }>(
    `SELECT di.document_id, COALESCE(SUM(di.amount),0) s FROM doc_items di JOIN documents d ON d.id=di.document_id
      WHERE d.business_id=? AND d.kind IN ('sales_invoice','purchase_bill','sales_return','purchase_return') GROUP BY di.document_id`, [bid]))
    docSum[r.document_id] = r.s;
  const chargesOf = (s: string | null) => {
    try { return (JSON.parse(s || "[]") as { amount?: number }[]).reduce((a, c) => a + (Number(c.amount) || 0), 0); } catch { return 0; }
  };
  const exTax = (l: DocLine) => (l.amount || 0) / (1 + (l.tax_rate || 0) / 100);

  const evs: Ev[] = [];
  for (const it of items) {
    if (it.type === "Service") continue;
    if ((it.opening_stock || 0) > 0)
      evs.push({ key: "o" + it.id, date: "0000-00-00", created: it.created_at, prio: 0, itemId: it.id, type: "open", qty: it.opening_stock, unitCost: it.purchase_price || 0 });
  }
  for (const l of lines) {
    if (!(l.qty > 0)) continue;
    const share = docSum[l.doc_id] ? (l.amount || 0) / docSum[l.doc_id] : 0;
    const base = { key: l.id, lineId: l.id, date: l.date, created: l.created_at, itemId: l.item_id, qty: l.qty, docId: l.doc_id, docNumber: l.number, sourceId: l.source_id, party: l.pname };
    if (l.kind === "purchase_bill") {
      const landed = (l.amount || 0) - share * (l.doc_discount || 0) + share * chargesOf(l.charges);
      evs.push({ ...base, prio: PRIO.buy, type: "buy", unitCost: Math.max(0, landed) / l.qty });
    } else if (l.kind === "purchase_return") {
      evs.push({ ...base, prio: PRIO.pret, type: "pret" });
    } else if (l.kind === "sales_invoice") {
      evs.push({ ...base, prio: PRIO.sale, type: "sale", revenue: Math.max(0, exTax(l) - share * (l.doc_discount || 0)) });
    } else if (l.kind === "sales_return") {
      evs.push({ ...base, prio: PRIO.sret, type: "sret", revenue: Math.max(0, exTax(l) - share * (l.doc_discount || 0)) });
    }
  }
  for (const a of adjs) {
    if (!a.qty_delta) continue;
    evs.push({ key: "a" + a.id, date: a.date, created: a.created_at, prio: a.qty_delta > 0 ? PRIO["adj+"] : PRIO["adj-"], itemId: a.item_id, type: a.qty_delta > 0 ? "adj+" : "adj-", qty: Math.abs(a.qty_delta) });
  }
  evs.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.prio - y.prio || (x.created < y.created ? -1 : x.created > y.created ? 1 : 0)));

  const fallback: Record<string, number> = {};
  for (const it of items) fallback[it.id] = it.purchase_price || 0;
  const lots: Record<string, Lot[]> = {};
  const lastCost: Record<string, number> = {};     // latest purchase cost per item
  const lastSaleCost: Record<string, number> = {}; // latest sold unit cost per item
  const saleCostByDocItem: Record<string, number> = {}; // `${docId}:${itemId}` → unit cost
  const out: SaleLine[] = [];
  // Units sold with no stock behind them, waiting for the next purchase of the item.
  const backlog: Record<string, { idx: number; qty: number; estUnit: number }[]> = {};

  const take = (itemId: string, qty: number) => {
    const q = (lots[itemId] ||= []);
    let need = qty, cost = 0;
    const sources: CostSource[] = [];
    while (need > EPS && q.length) {
      const lot = q[0];
      const use = Math.min(lot.qty, need);
      cost += use * lot.cost; lot.qty -= use; need -= use;
      const last = sources[sources.length - 1];
      if (last && last.kind === lot.src.kind && last.docId === lot.src.docId && Math.abs(last.unitCost - lot.cost) < 1e-6) last.qty += use;
      else sources.push({ ...lot.src, qty: use, unitCost: lot.cost });
      if (lot.qty <= EPS) q.shift();
    }
    return { cost, short: need > EPS ? need : 0, sources };
  };
  const known = (itemId: string) => lastCost[itemId] ?? fallback[itemId] ?? 0;

  /** A new lot arrived: first settle earlier sales that were made without stock, at this lot's cost. */
  const settleBacklog = (itemId: string, lot: Lot) => {
    const bl = backlog[itemId];
    while (bl && bl.length && lot.qty > EPS) {
      const b = bl[0];
      const use = Math.min(b.qty, lot.qty);
      const sale = out[b.idx];
      sale.cost = r2(sale.cost + use * (lot.cost - b.estUnit));
      const est = sale.sources.find((x) => x.kind === "estimate");
      if (est) { est.qty -= use; if (est.qty <= EPS) sale.sources.splice(sale.sources.indexOf(est), 1); }
      sale.sources.push({ kind: "later_purchase", qty: use, unitCost: lot.cost, docId: lot.src.docId, docNumber: lot.src.docNumber, date: lot.src.date });
      saleCostByDocItem[`${sale.docId}:${itemId}`] = sale.cost / sale.qty;
      lastSaleCost[itemId] = sale.cost / sale.qty;
      b.qty -= use; lot.qty -= use;
      if (b.qty <= EPS) bl.shift();
    }
  };

  for (const e of evs) {
    const q = (lots[e.itemId] ||= []);
    switch (e.type) {
      case "open": case "buy": {
        const lot: Lot = { qty: e.qty, cost: e.unitCost || 0, src: e.type === "open" ? { kind: "opening" } : { kind: "purchase", docId: e.docId, docNumber: e.docNumber, date: e.date } };
        lastCost[e.itemId] = e.unitCost || 0;
        settleBacklog(e.itemId, lot);
        if (lot.qty > EPS) q.push(lot);
        break;
      }
      case "adj+": {
        const lot: Lot = { qty: e.qty, cost: known(e.itemId), src: { kind: "adjustment", date: e.date } };
        settleBacklog(e.itemId, lot);
        if (lot.qty > EPS) q.push(lot);
        break;
      }
      case "pret": case "adj-":
        take(e.itemId, e.qty);
        break;
      case "sale": {
        const t = take(e.itemId, e.qty);
        const est = known(e.itemId);
        const cost = t.cost + t.short * est;
        const unit = cost / e.qty;
        lastSaleCost[e.itemId] = unit;
        saleCostByDocItem[`${e.docId}:${e.itemId}`] = unit;
        if (t.short > EPS) t.sources.push({ kind: "estimate", qty: t.short, unitCost: est });
        out.push({ lineId: e.lineId!, docId: e.docId!, docNumber: e.docNumber!, date: e.date, itemId: e.itemId, party: e.party ?? null, qty: e.qty, revenue: r2(e.revenue || 0), cost: r2(cost), shortQty: t.short, isReturn: false, sources: t.sources });
        if (t.short > EPS) (backlog[e.itemId] ||= []).push({ idx: out.length - 1, qty: t.short, estUnit: est });
        break;
      }
      case "sret": {
        const fromSource = e.sourceId ? saleCostByDocItem[`${e.sourceId}:${e.itemId}`] : undefined;
        const unit = fromSource ?? lastSaleCost[e.itemId] ?? known(e.itemId);
        const lot: Lot = { qty: e.qty, cost: unit, src: { kind: "sales_return", docId: e.docId, docNumber: e.docNumber, date: e.date } };
        settleBacklog(e.itemId, lot);
        if (lot.qty > EPS) q.unshift(lot); // returned goods are sold again first
        out.push({ lineId: e.lineId!, docId: e.docId!, docNumber: e.docNumber!, date: e.date, itemId: e.itemId, party: e.party ?? null, qty: -e.qty, revenue: -r2(e.revenue || 0), cost: -r2(unit * e.qty), shortQty: 0, isReturn: true, sources: [{ kind: "sales_return", qty: e.qty, unitCost: unit, docId: e.docId, docNumber: e.docNumber, date: e.date }] });
        break;
      }
    }
  }
  const onHand: Record<string, { qty: number; value: number }> = {};
  for (const [id, q] of Object.entries(lots)) onHand[id] = { qty: q.reduce((a, l) => a + l.qty, 0), value: r2(q.reduce((a, l) => a + l.qty * l.cost, 0)) };
  return { lines: out, onHand };
}

export type ItemProfit = { itemId: string; qty: number; revenue: number; cost: number; profit: number; shortQty: number; lines: SaleLine[] };

/** Per-item FIFO profit for sales (and sales returns) dated within [from, to]. */
export async function itemProfits(bid: string, from: string, to: string): Promise<Record<string, ItemProfit>> {
  const { lines } = await fifoSales(bid);
  const res: Record<string, ItemProfit> = {};
  for (const l of lines) {
    if (l.date < from || l.date > to) continue;
    const x = (res[l.itemId] ||= { itemId: l.itemId, qty: 0, revenue: 0, cost: 0, profit: 0, shortQty: 0, lines: [] });
    x.qty += l.qty; x.revenue += l.revenue; x.cost += l.cost; x.shortQty += l.shortQty; x.lines.push(l);
  }
  for (const x of Object.values(res)) { x.revenue = r2(x.revenue); x.cost = r2(x.cost); x.profit = r2(x.revenue - x.cost); }
  return res;
}

export type DocProfitLine = { lineId: string; name: string; itemId: string | null; qty: number; unit: string | null; revenue: number; cost: number | null; profit: number | null; shortQty: number; sources: CostSource[] };
export type DocProfit = { docId: string; number: number; kind: string; date: string; party: string | null; revenue: number; cost: number; profit: number; unlinked: number; lines: DocProfitLine[] };

/**
 * FIFO profit of each sales invoice / sales return dated within [from, to] (or one document),
 * product by product. Lines without a linked item have no cost (counted in `unlinked`).
 */
export async function docProfits(bid: string, opts: { from?: string; to?: string; docId?: string; partyId?: string } = {}): Promise<DocProfit[]> {
  const { lines: fifo } = await fifoSales(bid);
  const byLine = new Map(fifo.map((l) => [l.lineId, l]));
  const where = ["d.business_id=?", "d.kind IN ('sales_invoice','sales_return')"];
  const params: unknown[] = [bid];
  if (opts.docId) { where.push("d.id=?"); params.push(opts.docId); }
  if (opts.from) { where.push("d.date>=?"); params.push(opts.from); }
  if (opts.to) { where.push("d.date<=?"); params.push(opts.to); }
  if (opts.partyId) { where.push("d.party_id=?"); params.push(opts.partyId); }
  const rows = await all<{ doc_id: string; number: number; kind: string; date: string; created_at: string; pname: string | null; line_id: string | null; item_id: string | null; name: string | null; qty: number | null; unit: string | null; amount: number | null; tax_rate: number | null; doc_discount: number; line_sum: number }>(
    `SELECT d.id doc_id, d.number, d.kind, d.date, d.created_at, p.name pname, di.id line_id, di.item_id, di.name, di.qty, di.unit, di.amount, di.tax_rate, d.doc_discount,
            (SELECT COALESCE(SUM(amount),0) FROM doc_items WHERE document_id=d.id) line_sum
       FROM documents d LEFT JOIN parties p ON p.id=d.party_id LEFT JOIN doc_items di ON di.document_id=d.id
      WHERE ${where.join(" AND ")} ORDER BY d.date DESC, d.created_at DESC, di.rowid`, params);
  const out = new Map<string, DocProfit>();
  for (const r of rows) {
    let d = out.get(r.doc_id);
    if (!d) { d = { docId: r.doc_id, number: r.number, kind: r.kind, date: r.date, party: r.pname, revenue: 0, cost: 0, profit: 0, unlinked: 0, lines: [] }; out.set(r.doc_id, d); }
    if (!r.line_id) continue;
    const sign = r.kind === "sales_return" ? -1 : 1;
    const f = byLine.get(r.line_id);
    let line: DocProfitLine;
    if (f) {
      line = { lineId: r.line_id, name: r.name || "", itemId: r.item_id, qty: f.qty, unit: r.unit, revenue: f.revenue, cost: f.cost, profit: r2(f.revenue - f.cost), shortQty: f.shortQty, sources: f.sources };
    } else {
      // unlinked line (no item): revenue only, same discount/tax treatment as FIFO lines
      const share = r.line_sum ? (r.amount || 0) / r.line_sum : 0;
      const rev = Math.max(0, (r.amount || 0) / (1 + (r.tax_rate || 0) / 100) - share * (r.doc_discount || 0));
      line = { lineId: r.line_id, name: r.name || "", itemId: r.item_id, qty: sign * (r.qty || 0), unit: r.unit, revenue: r2(sign * rev), cost: null, profit: null, shortQty: 0, sources: [] };
      d.unlinked += line.revenue;
    }
    d.lines.push(line);
    d.revenue += line.revenue;
    if (line.cost !== null) d.cost += line.cost;
  }
  for (const d of out.values()) { d.revenue = r2(d.revenue); d.cost = r2(d.cost); d.unlinked = r2(d.unlinked); d.profit = r2(d.revenue - d.unlinked - d.cost); }
  return [...out.values()];
}
