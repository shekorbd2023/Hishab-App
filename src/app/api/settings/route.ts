import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { getSettings, saveSettings, SETTINGS_DEFAULTS, type BizSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/util";

const BIZ_FIELDS = ["name", "phone", "email", "address", "logo", "category", "biz_type", "division", "district", "reg_no", "currency_symbol"] as const;

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bid = ctx.business.id;
  const b = await req.json();
  const manager = ctx.role === "Owner" || ctx.role === "Admin" || ctx.role === "Partner";

  // --- My Account (any member can edit their own profile)
  if (b.op === "account") {
    const name = String(b.name || "").trim();
    if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    run("UPDATE users SET name=? WHERE id=?", [name, ctx.user.id]);
    if (b.new_password) {
      const u = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id=?", [ctx.user.id]);
      if (!u || !verifyPassword(String(b.current_password || ""), u.password_hash)) return NextResponse.json({ error: "Current password is wrong." }, { status: 400 });
      if (String(b.new_password).length < 6) return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });
      run("UPDATE users SET password_hash=? WHERE id=?", [hashPassword(String(b.new_password)), ctx.user.id]);
    }
    return NextResponse.json({ ok: true });
  }

  if (!manager) return NextResponse.json({ error: "Only the owner, admin or partner can change settings." }, { status: 403 });

  // --- Business profile fields (+ logo)
  if (b.op === "business") {
    const sets: string[] = [], vals: unknown[] = [];
    for (const f of BIZ_FIELDS) if (f in b) { sets.push(`${f}=?`); vals.push(b[f] === "" ? null : b[f]); }
    if (sets.length) run(`UPDATE businesses SET ${sets.join(", ")} WHERE id=?`, [...vals, bid]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "business", summary: "Updated business profile" });
    return NextResponse.json({ ok: true });
  }

  // --- Partial BizSettings update
  if (b.op === "settings") {
    const patch: Partial<BizSettings> = {};
    for (const [k, v] of Object.entries(b.patch || {})) if (k in SETTINGS_DEFAULTS) (patch as Record<string, unknown>)[k] = v;
    saveSettings(bid, patch);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "settings", summary: `Updated settings: ${Object.keys(patch).join(", ")}` });
    return NextResponse.json({ ok: true, settings: getSettings(bid) });
  }

  // --- Legacy form (old /settings page)
  run("UPDATE businesses SET name=?, address=?, phone=?, currency_symbol=?, logo=? WHERE id=?",
    [b.name || ctx.business.name, b.address ?? null, b.phone ?? null, b.currency_symbol || "Tk.", b.logo ?? null, bid]);
  saveSettings(bid, { invoice_footer: b.invoice_footer ?? "", default_tax: Number(b.default_tax) || 0, show_logo: !!b.show_logo, show_business_logo: !!b.show_logo });
  logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "settings", summary: "Updated business settings" });
  return NextResponse.json({ ok: true });
}
