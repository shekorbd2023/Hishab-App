import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { get } from "@/lib/db";
import { verifyPassword } from "@/lib/util";
import { createSession, businessesForUser, SESSION_COOKIE, BUSINESS_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const u = get<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = ?",
    [String(email || "").toLowerCase()]
  );
  if (!u || !verifyPassword(String(password || ""), u.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  const token = createSession(u.id);
  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 60 };
  jar.set(SESSION_COOKIE, token, opts);
  const biz = businessesForUser(u.id)[0];
  if (biz) jar.set(BUSINESS_COOKIE, biz.id, { ...opts, httpOnly: false });
  return NextResponse.json({ ok: true });
}
