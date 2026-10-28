// Settings → Integrations (session auth): API keys and website product ↔ item links.
import { NextResponse } from "next/server";
import { requireCtx, belongs } from "@/lib/auth";
import { run, get } from "@/lib/db";
import { uid, nowIso } from "@/lib/util";
import { logAudit } from "@/lib/audit";
import { newApiKey, resyncUnmatched } from "@/lib/integration";

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "Owner" && ctx.role !== "Admin") return NextResponse.json({ error: "Only the Owner or an Admin can change integrations." }, { status: 403 });
  const bid = ctx.business.id;
  const b = await req.json().catch(() => ({}));
  const audit = (action: "create" | "update" | "delete", summary: string) =>
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action, entity: "integration", summary });

  if (b.op === "create_key") {
    const name = String(b.name || "Shekor website").trim().slice(0, 60) || "API key";
    const k = newApiKey();
    await run("INSERT INTO api_keys (id, business_id, name, prefix, key_hash, created_by, created_at) VALUES (?,?,?,?,?,?,?)",
      [uid(), bid, name, k.prefix, k.hash, ctx.user.id, nowIso()]);
    await audit("create", `Created API key "${name}" (${k.prefix}…)`);
    return NextResponse.json({ ok: true, key: k.key });
  }
  if (b.op === "revoke_key") {
    const row = await get<{ name: string; prefix: string }>("SELECT name, prefix FROM api_keys WHERE id=? AND business_id=?", [b.id, bid]);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await run("DELETE FROM api_keys WHERE id=? AND business_id=?", [b.id, bid]);
    await audit("delete", `Revoked API key "${row.name}" (${row.prefix}…)`);
    return NextResponse.json({ ok: true });
  }
  if (b.op === "map_item") {
    const key = String(b.key || "").slice(0, 150);
    if (!key) return NextResponse.json({ error: "Missing product" }, { status: 400 });
    if (!b.itemId) {
      await run("DELETE FROM integration_item_map WHERE business_id=? AND source='website' AND external_key=?", [bid, key]);
      return NextResponse.json({ ok: true, resynced: 0 });
    }
    if (!(await belongs("items", b.itemId, bid))) return NextResponse.json({ error: "Item not found" }, { status: 400 });
    const factor = Number(b.factor) > 0 ? Number(b.factor) : 1;
    await run(`INSERT INTO integration_item_map (business_id, source, external_key, item_id, factor) VALUES (?,?,?,?,?)
      ON CONFLICT(business_id, source, external_key) DO UPDATE SET item_id=excluded.item_id, factor=excluded.factor`, [bid, "website", key, b.itemId, factor]);
    await audit("update", `Linked website product "${String(b.name || key).slice(0, 80)}" to an item (× ${factor})`);
    const resynced = await resyncUnmatched(bid, "website", key);
    return NextResponse.json({ ok: true, resynced });
  }
  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
