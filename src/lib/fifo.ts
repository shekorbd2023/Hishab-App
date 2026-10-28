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
//  • If more is sold than is in stock, the missing units are costed at the latest known
//    cost and reported as "short" so the user can see the profit is estimated there.
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
};

type Lot = { qty: number; cost: number };
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

  // Bill-level discount / charges are shared out over the document's lines by amount.
  const docSum: Record<string, number> = {};
  for (const l of lines) docSum[l.doc_id] = (docSum[l.doc_id] || 0) + (l.amount || 0);
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

  const take = (itemId: string, qty: number) => {
    const q = (lots[itemId] ||= []);
    let need = qty, cost = 0;
    while (need > EPS && q.length) {
      const lot = q[0];
      const use = Math.min(lot.qty, need);
      cost += use * lot.cost; lot.qty -= use; need -= use;
      if (lot.qty <= EPS) q.shift();
    }
    return { cost, short: need > EPS ? need : 0 };
  };
  const known = (itemId: string) => lastCost[itemId] ?? fallback[itemId] ?? 0;

  for (const e of evs) {
    const q = (lots[e.itemId] ||= []);
    switch (e.type) {
      case "open": case "buy":
        q.push({ qty: e.qty, cost: e.unitCost || 0 });
        lastCost[e.itemId] = e.unitCost || 0;
        break;
      case "adj+":
        q.push({ qty: e.qty, cost: known(e.itemId) });
        break;
      case "pret": case "adj-":
        take(e.itemId, e.qty);
        break;
      case "sale": {
        const t = take(e.itemId, e.qty);
        const cost = t.cost + t.short * known(e.itemId);
        const unit = cost / e.qty;
        lastSaleCost[e.itemId] = unit;
        saleCostByDocItem[`${e.docId}:${e.itemId}`] = unit;
        out.push({ lineId: e.lineId!, docId: e.docId!, docNumber: e.docNumber!, date: e.date, itemId: e.itemId, party: e.party ?? null, qty: e.qty, revenue: r2(e.revenue || 0), cost: r2(cost), shortQty: t.short, isReturn: false });
        break;
      }
      case "sret": {
        const fromSource = e.sourceId ? saleCostByDocItem[`${e.sourceId}:${e.itemId}`] : undefined;
        const unit = fromSource ?? lastSaleCost[e.itemId] ?? known(e.itemId);
        q.unshift({ qty: e.qty, cost: unit }); // returned goods are sold again first
        out.push({ lineId: e.lineId!, docId: e.docId!, docNumber: e.docNumber!, date: e.date, itemId: e.itemId, party: e.party ?? null, qty: -e.qty, revenue: -r2(e.revenue || 0), cost: -r2(unit * e.qty), shortQty: 0, isReturn: true });
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
