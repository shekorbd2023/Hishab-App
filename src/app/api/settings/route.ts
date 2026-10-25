import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { getSettings, saveSettings, SETTINGS_DEFAULTS, type BizSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/util";
import { isLocalRequest } from "@/lib/reset";

const BIZ_FIELDS = ["name", "phone", "email", "address", "logo", "category", "biz_type", "division", "district", "reg_no", "currency_symbol"] as const;

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bid = ctx.business.id;
  const b = await req.json().catch(() => ({}));
  const manager = ctx.role === "Owner" || ctx.role === "Admin" || ctx.role === "Partner";

  // --- My Account (any member can edit their own profile)
  if (b.op === "account") {
    const name = String(b.name || "").trim();
    if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    (await run("UPDATE users SET name=? WHERE id=?", [name, ctx.user.id]));
    if (b.new_password) {
      const u = (await get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id=?", [ctx.user.id]));
      // The Owner, signed in on the desktop app on their own computer, may set a new password without the old one.
      const ownerOnDesktop = ctx.role === "Owner" && isLocalRequest(req) && !b.current_password;
      if (!u || (!ownerOnDesktop && !verifyPassword(String(b.current_password || ""), u.password_hash))) return NextResponse.json({ error: "Current password is wrong." }, { status: 400 });
      if (String(b.new_password).length < 6) return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });
      (await run("UPDATE users SET password_hash=? WHERE id=?", [hashPassword(String(b.new_password)), ctx.user.id]));
      (await logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "user", entityId: ctx.user.id, summary: ownerOnDesktop ? "Password changed by Owner on desktop (no current password)" : "Password changed" }));
    }
    return NextResponse.json({ ok: true });
  }

  if (!manager) return NextResponse.json({ error: "Only the owner, admin or partner can change settings." }, { status: 403 });

  // --- Business profile fields (+ logo)
  if (b.op === "business") {
    const sets: string[] = [], vals: unknown[] = [];
    for (const f of BIZ_FIELDS) if (f in b) { sets.push(`${f}=?`); vals.push(b[f] === "" ? null : b[f]); }
    if (sets.length) (await run(`UPDATE businesses SET ${sets.join(", ")} WHERE id=?`, [...vals, bid]));
    (await logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "business", summary: "Updated business profile" }));
    return NextResponse.json({ ok: true });
  }

  // --- Partial BizSettings update
  if (b.op === "settings") {
    const patch: Partial<BizSettings> = {};
    for (const [k, v] of Object.entries(b.patch || {})) if (k in SETTINGS_DEFAULTS) (patch as Record<string, unknown>)[k] = v;
    (await saveSettings(bid, patch));
    (await logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "settings", summary: `Updated settings: ${Object.keys(patch).join(", ")}` }));
    return NextResponse.json({ ok: true, settings: (await getSettings(bid)) });
  }

  // --- Legacy form (old /settings page) — only when no op is given, so a typo'd op can't wipe the profile
  if (b.op) return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  (await run("UPDATE businesses SET name=?, address=?, phone=?, currency_symbol=?, logo=? WHERE id=?",
        [b.name || ctx.business.name, b.address ?? null, b.phone ?? null, b.currency_symbol || "Tk.", b.logo ?? null, bid]));
  (await saveSettings(bid, { invoice_footer: b.invoice_footer ?? "", default_tax: Number(b.default_tax) || 0, show_logo: !!b.show_logo, show_business_logo: !!b.show_logo }));
  (await logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "settings", summary: "Updated business settings" }));
  return NextResponse.json({ ok: true });
}
