import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";
import { run } from "@/lib/db";
import { saveSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "Owner" && ctx.role !== "Admin" && ctx.role !== "Partner")
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const bid = ctx.business.id;
  const b = await req.json();
  run(
    "UPDATE businesses SET name=?, address=?, phone=?, currency_symbol=?, logo=? WHERE id=?",
    [b.name || ctx.business.name, b.address ?? null, b.phone ?? null, b.currency_symbol || "Tk.", b.logo ?? null, bid]
  );
  saveSettings(bid, {
    invoice_footer: b.invoice_footer ?? "",
    default_tax: Number(b.default_tax) || 0,
    show_logo: !!b.show_logo,
  });
  logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "settings", summary: "Updated business settings" });
  return NextResponse.json({ ok: true });
}
