// Public endpoint for shops (the Shekor website): POST a confirmed or cancelled order.
// Auth: Authorization: Bearer <API key from Settings → Integrations>.
import { NextResponse } from "next/server";
import { businessForKey, parseOrder, syncOrder } from "@/lib/integration";
import { run } from "@/lib/db";
import { nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const bid = await businessForKey(req.headers.get("authorization"));
  if (!bid) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  const body = await req.json().catch(() => null);
  let p;
  try { p = parseOrder(body); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  const source = "website";
  try {
    return NextResponse.json(await syncOrder(bid, source, p));
  } catch (e) {
    const msg = (e as Error).message || "Sync failed";
    await run("UPDATE integration_orders SET status='error', error=?, updated_at=? WHERE business_id=? AND source=? AND external_id=?",
      [msg.slice(0, 300), nowIso(), bid, source, p.externalId]).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}

/** Connection test: GET with the key → business name. */
export async function GET(req: Request) {
  const bid = await businessForKey(req.headers.get("authorization"));
  if (!bid) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
