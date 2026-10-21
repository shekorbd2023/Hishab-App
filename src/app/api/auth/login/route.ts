import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { get } from "@/lib/db";
import { verifyPassword } from "@/lib/util";
import {
  createSession, businessesForUser, SESSION_COOKIE, BUSINESS_COOKIE,
  loginBlocked, loginFailed, loginSucceeded, cookieOpts,
} from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  const em = String(email || "").trim().toLowerCase();
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  const key = em + "|" + ip;
  const wait = loginBlocked(key);
  if (wait) return NextResponse.json({ error: `Too many wrong attempts. Try again in ${wait} minute(s).` }, { status: 429 });
  const u = get<{ id: string; password_hash: string }>("SELECT id, password_hash FROM users WHERE email = ?", [em]);
  if (!u || !verifyPassword(String(password || ""), u.password_hash)) {
    loginFailed(key);
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  loginSucceeded(key);
  const token = createSession(u.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOpts(req));
  const biz = businessesForUser(u.id)[0];
  if (biz) jar.set(BUSINESS_COOKIE, biz.id, cookieOpts(req, false));
  return NextResponse.json({ ok: true });
}
