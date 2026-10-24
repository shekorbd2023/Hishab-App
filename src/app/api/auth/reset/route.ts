import { NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { hashPassword } from "@/lib/util";
import { checkResetCode, isLocalRequest } from "@/lib/reset";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  if (!isLocalRequest(req))
    return NextResponse.json({ error: "Password reset only works in the Hishab desktop app on your own computer." }, { status: 403 });
  const { email, code, new_password } = await req.json().catch(() => ({}));
  const em = String(email || "").trim().toLowerCase();
  const pw = String(new_password || "");
  if (pw.length < 6) return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });
  const u = get<{ id: string; name: string }>("SELECT id, name FROM users WHERE email = ?", [em]);
  if (!u) return NextResponse.json({ error: "No account with this email on this computer." }, { status: 404 });
  const r = checkResetCode(em, String(code || ""));
  if (r === "wrong") return NextResponse.json({ error: "Wrong code. Check the file and try again." }, { status: 400 });
  if (r !== "ok") return NextResponse.json({ error: "This code has expired. Ask for a new one." }, { status: 400 });
  run("UPDATE users SET password_hash=? WHERE id=?", [hashPassword(pw), u.id]);
  run("DELETE FROM sessions WHERE user_id=?", [u.id]); // sign out everywhere
  for (const b of all<{ business_id: string }>("SELECT business_id FROM business_members WHERE user_id=?", [u.id]))
    logAudit({ businessId: b.business_id, userId: u.id, userName: u.name, action: "update", entity: "user", entityId: u.id, summary: "Password reset with a one-time code (desktop)" });
  return NextResponse.json({ ok: true });
}
