// Integration API: a shop (the Shekor website) pushes confirmed orders here and they
// become sales invoices. Server only.
//
// Auth: each business makes API keys in Settings → Integrations. Only the sha256 of a key is
// stored; the key is shown once. The website sends it as `Authorization: Bearer hk_…`.
//
// Idempotent: the same order (source + external id) always maps to the same invoice —
// sending it again updates that invoice; sending status "cancelled" removes it (only while
// no payment other than the automatic one has been recorded against it).
import { createHash, randomBytes } from "node:crypto";
import { all, get, run, tx } from "./db";
import { uid, nowIso, todayIso } from "./util";
import { createDocument, updateDocument, type LineInput, type Charge } from "./actions";
import { logAudit } from "./audit";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function newApiKey(): { key: string; prefix: string; hash: string } {
  const key = "hk_" + randomBytes(24).toString("base64url");
  return { key, prefix: key.slice(0, 9), hash: sha256(key) };
}

/** Business id for a Bearer key, or null. Touches last_used_at at most once a minute. */
export async function businessForKey(authHeader: string | null): Promise<string | null> {
  const m = /^Bearer\s+(hk_[A-Za-z0-9_-]{20,})\s*$/.exec(authHeader || "");
  if (!m) return null;
  const row = await get<{ id: string; business_id: string; last_used_at: string | null }>(
    "SELECT id, business_id, last_used_at FROM api_keys WHERE key_hash=?", [sha256(m[1])]);
  if (!row) return null;
  const now = nowIso();
  if (!row.last_used_at || now.slice(0, 16) !== row.last_used_at.slice(0, 16))
    await run("UPDATE api_keys SET last_used_at=? WHERE id=?", [now, row.id]);
  return row.business_id;
}

/* ============================== Order payload ============================== */
export type OrderLine = { key: string; title: string; variant?: string | null; price: number; quantity: number; unit?: string | null };
export type OrderPayload = {
  externalId: string;
  orderNumber?: string | null;
  status: "confirmed" | "cancelled";
  date?: string | null;          // YYYY-MM-DD (Dhaka); defaults to today
  customer: { name: string; phone?: string | null; address?: string | null; email?: string | null };
  items: OrderLine[];
  deliveryFee?: number;
  discount?: number;
  discountNote?: string | null;
  note?: string | null;
};

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const numOr = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/** Validate an untrusted body into an OrderPayload (throws a readable message). */
export function parseOrder(b: unknown): OrderPayload {
  const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
  const externalId = str(o.externalId, 100);
  if (!externalId) throw new Error("externalId is required");
  const status = o.status === "cancelled" ? "cancelled" : "confirmed";
  const c = (o.customer && typeof o.customer === "object" ? o.customer : {}) as Record<string, unknown>;
  const name = str(c.name, 120) || "Website Customer";
  const date = str(o.date, 10);
  const items = (Array.isArray(o.items) ? o.items : []).slice(0, 200).map((x) => {
    const i = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    return {
      key: str(i.key, 150) || str(i.title, 150), title: str(i.title, 200) || "Item", variant: str(i.variant, 80) || null,
      price: Math.max(0, numOr(i.price)), quantity: Math.max(0, numOr(i.quantity)), unit: str(i.unit, 20) || null,
    };
  }).filter((i) => i.quantity > 0);
  if (status === "confirmed" && !items.length) throw new Error("items are required");
  return {
    externalId, status, orderNumber: str(o.orderNumber, 60) || null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    customer: { name, phone: str(c.phone, 30) || null, address: str(c.address, 500) || null, email: str(c.email, 120) || null },
    items, deliveryFee: Math.max(0, numOr(o.deliveryFee)), discount: Math.max(0, numOr(o.discount)),
    discountNote: str(o.discountNote, 100) || null, note: str(o.note, 500) || null,
  };
}

/* ============================== Matching ============================== */
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export function normName(s: string): string {
  return s.toLowerCase()
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(/গ্রাম|grams?|gm\b/g, "g").replace(/কেজি|kgs?\b/g, "kg").replace(/মিলি|ml\b/g, "ml").replace(/লিটার|litre|liter/g, "l")
    .replace(/[\s\-_()[\],.·/|]+/g, "");
}
const phoneKey = (p: string | null | undefined) => { const d = (p || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };

type Matched = { itemId: string | null; factor: number };
async function matcher(bid: string, source: string) {
  const maps = await all<{ external_key: string; item_id: string; factor: number }>(
    "SELECT external_key, item_id, factor FROM integration_item_map WHERE business_id=? AND source=?", [bid, source]);
  const byKey = new Map(maps.map((m) => [m.external_key, m]));
  const items = await all<{ id: string; name: string; code: string | null }>("SELECT id, name, code FROM items WHERE business_id=?", [bid]);
  const byCode = new Map(items.filter((i) => i.code).map((i) => [i.code!.trim(), i.id]));
  const byName = new Map<string, string | null>();
  for (const i of items) { const k = normName(i.name); byName.set(k, byName.has(k) ? null : i.id); } // ambiguous names → no auto match
  return (l: OrderLine): Matched => {
    const m = byKey.get(l.key);
    if (m && items.some((i) => i.id === m.item_id)) return { itemId: m.item_id, factor: m.factor || 1 };
    const code = byCode.get(l.key);
    if (code) return { itemId: code, factor: 1 };
    const cands = l.variant ? [`${l.title} ${l.variant}`, `${l.variant} ${l.title}`] : [l.title];
    for (const c of cands) { const id = byName.get(normName(c)); if (id) return { itemId: id, factor: 1 }; }
    return { itemId: null, factor: 1 };
  };
}

async function findOrCreateParty(bid: string, c: OrderPayload["customer"]): Promise<string> {
  const pk = phoneKey(c.phone);
  if (pk) {
    for (const p of await all<{ id: string; phone: string | null }>("SELECT id, phone FROM parties WHERE business_id=? AND phone IS NOT NULL AND phone != ''", [bid]))
      if (phoneKey(p.phone) === pk) return p.id;
  }
  const id = uid();
  await run("INSERT INTO parties (id, business_id, name, phone, address, email, type, category, opening_balance, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [id, bid, c.name, c.phone, c.address, c.email, "customer", "Website", 0, nowIso()]);
  await logAudit({ businessId: bid, userName: "Website", action: "create", entity: "party", entityId: id, summary: `Created party ${c.name} from a website order` });
  return id;
}

export type SyncResult = { ok: true; status: "synced" | "cancelled"; documentId: string | null; invoiceNumber: number | null; unmatched: { key: string; name: string }[] };

/** Create, update or cancel the sales invoice for one shop order. */
export async function syncOrder(bid: string, source: string, p: OrderPayload): Promise<SyncResult> {
  return tx(async () => {
    const now = nowIso();
    const cur = await get<{ id: string; document_id: string | null }>(
      "SELECT id, document_id FROM integration_orders WHERE business_id=? AND source=? AND external_id=?", [bid, source, p.externalId]);
    const doc = cur?.document_id
      ? await get<{ id: string; number: number }>("SELECT id, number FROM documents WHERE id=? AND business_id=?", [cur.document_id, bid])
      : undefined;
    const label = p.orderNumber || p.externalId;

    const save = async (status: string, documentId: string | null, unmatched: unknown[]) => {
      if (cur) await run("UPDATE integration_orders SET order_number=?, document_id=?, status=?, unmatched=?, payload=?, error=NULL, updated_at=? WHERE id=?",
        [p.orderNumber, documentId, status, JSON.stringify(unmatched), JSON.stringify(p), now, cur.id]);
      else await run("INSERT INTO integration_orders (id, business_id, source, external_id, order_number, document_id, status, unmatched, payload, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [uid(), bid, source, p.externalId, p.orderNumber, documentId, status, JSON.stringify(unmatched), JSON.stringify(p), now, now]);
    };

    if (p.status === "cancelled") {
      if (doc) {
        const manual = await get<{ n: number }>("SELECT COUNT(*) n FROM payments WHERE document_id=? AND is_auto=0", [doc.id]);
        if (manual && manual.n > 0) throw new Error(`Invoice #${doc.number} has payments recorded, so it was not removed. Remove the payment in Hishab first.`);
        await run("DELETE FROM payments WHERE document_id=? AND is_auto=1", [doc.id]);
        await run("DELETE FROM documents WHERE id=? AND business_id=?", [doc.id, bid]);
        await logAudit({ businessId: bid, userName: "Website", action: "delete", entity: "sales_invoice", entityId: doc.id, summary: `Website order ${label} cancelled — removed Sales #${doc.number}` });
      }
      await save("cancelled", null, []);
      return { ok: true, status: "cancelled", documentId: null, invoiceNumber: null, unmatched: [] };
    }

    const match = await matcher(bid, source);
    const units = new Map((await all<{ id: string; unit: string | null }>("SELECT id, unit FROM items WHERE business_id=?", [bid])).map((i) => [i.id, i.unit]));
    const unmatched: { key: string; name: string }[] = [];
    const lines: LineInput[] = p.items.map((l) => {
      const m = match(l);
      const name = l.variant ? `${l.title} (${l.variant})` : l.title;
      if (!m.itemId) unmatched.push({ key: l.key, name });
      const f = m.factor > 0 ? m.factor : 1;
      return { itemId: m.itemId, name, qty: Math.round(l.quantity * f * 1000) / 1000, rate: Math.round((l.price / f) * 100) / 100, unit: (m.itemId && units.get(m.itemId)) || l.unit || null };
    });
    const charges: Charge[] = p.deliveryFee ? [{ title: "Delivery charge", amount: p.deliveryFee }] : [];
    const notes = [`Website order ${label}`, p.discountNote ? `Discount: ${p.discountNote}` : "", p.note || ""].filter(Boolean).join(" · ");
    const partyId = await findOrCreateParty(bid, p.customer);
    const input = {
      businessId: bid, kind: "sales_invoice" as const, partyId, date: p.date || todayIso(), notes, lines, charges,
      docDiscount: p.discount || 0, paidAmount: 0, createdBy: undefined,
    };
    // Re-syncing an order must not wipe money already recorded with the invoice in Hishab
    // (updateDocument replaces the automatic "received with invoice" payment with paidAmount).
    let keep: { paid: number; accountId: string | null } = { paid: 0, accountId: null };
    if (doc) {
      const auto = await get<{ s: number; acc: string | null }>(
        "SELECT COALESCE(SUM(amount),0) s, MAX(account_id) acc FROM payments WHERE document_id=? AND is_auto=1", [doc.id]);
      const cur = await get<{ account_id: string | null }>("SELECT account_id FROM documents WHERE id=?", [doc.id]);
      keep = { paid: auto?.s || 0, accountId: cur?.account_id ?? auto?.acc ?? null };
    }
    const res = doc
      ? await updateDocument(doc.id, { ...input, number: doc.number, paidAmount: keep.paid, accountId: keep.accountId })
      : await createDocument(input);
    await logAudit({ businessId: bid, userName: "Website", action: doc ? "update" : "create", entity: "sales_invoice", entityId: res.id,
      summary: `${doc ? "Updated" : "Created"} Sales #${res.number} from website order ${label} — ${res.total}${unmatched.length ? ` (${unmatched.length} product(s) not linked to an item)` : ""}` });
    await save("synced", res.id, unmatched);
    return { ok: true, status: "synced", documentId: res.id, invoiceNumber: res.number, unmatched };
  });
}

/** After a product is mapped, re-sync the orders that had it unmatched. */
export async function resyncUnmatched(bid: string, source: string, key: string): Promise<number> {
  const rows = await all<{ payload: string; unmatched: string | null }>(
    "SELECT payload, unmatched FROM integration_orders WHERE business_id=? AND source=? AND status='synced' AND unmatched LIKE ?", [bid, source, "%" + JSON.stringify(key).slice(1, -1) + "%"]);
  let n = 0;
  for (const r of rows) {
    const um = JSON.parse(r.unmatched || "[]") as { key: string }[];
    if (!um.some((u) => u.key === key)) continue;
    try { await syncOrder(bid, source, JSON.parse(r.payload) as OrderPayload); n++; } catch { /* keep going */ }
  }
  return n;
}
