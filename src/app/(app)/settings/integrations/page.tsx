import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";
import IntegrationsClient from "./IntegrationsClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const manager = ctx.role === "Owner" || ctx.role === "Admin";
  const keys = manager ? await all<{ id: string; name: string; prefix: string; created_at: string; last_used_at: string | null }>(
    "SELECT id, name, prefix, created_at, last_used_at FROM api_keys WHERE business_id=? ORDER BY created_at DESC", [bid]) : [];
  const orders = await all<{ id: string; order_number: string | null; external_id: string; status: string; error: string | null; unmatched: string | null; updated_at: string; document_id: string | null; number: number | null; total: number | null }>(
    `SELECT o.id, o.order_number, o.external_id, o.status, o.error, o.unmatched, o.updated_at, o.document_id, d.number, d.total
       FROM integration_orders o LEFT JOIN documents d ON d.id=o.document_id
      WHERE o.business_id=? AND o.source='website' ORDER BY o.updated_at DESC LIMIT 30`, [bid]);
  const unmatchedRows = await all<{ unmatched: string }>(
    "SELECT unmatched FROM integration_orders WHERE business_id=? AND source='website' AND status='synced' AND unmatched IS NOT NULL AND unmatched != '[]'", [bid]);
  const um = new Map<string, { key: string; name: string; orders: number }>();
  for (const r of unmatchedRows) for (const u of JSON.parse(r.unmatched) as { key: string; name: string }[]) {
    const x = um.get(u.key) || { ...u, orders: 0 }; x.orders++; um.set(u.key, x);
  }
  const maps = await all<{ external_key: string; item_id: string; factor: number; name: string }>(
    `SELECT m.external_key, m.item_id, m.factor, i.name FROM integration_item_map m JOIN items i ON i.id=m.item_id
      WHERE m.business_id=? AND m.source='website' ORDER BY i.name`, [bid]);
  const items = await all<{ id: string; name: string; unit: string | null }>("SELECT id, name, unit FROM items WHERE business_id=? AND type != 'Service' ORDER BY name COLLATE NOCASE", [bid]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") || "https"}://${h.get("x-forwarded-host") || h.get("host")}`;
  return <IntegrationsClient manager={manager} origin={origin} keys={keys} orders={orders} unmatched={[...um.values()]} maps={maps} items={items} />;
}
