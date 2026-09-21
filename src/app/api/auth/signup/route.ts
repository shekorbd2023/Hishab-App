import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { get, run } from "@/lib/db";
import { uid, nowIso, hashPassword } from "@/lib/util";
import { createSession, createBusinessForUser, SESSION_COOKIE, BUSINESS_COOKIE } from "@/lib/auth";
import { seedDemo } from "@/lib/seed";

export async function POST(req: Request) {
  const { name, email, password, businessName, demo } = await req.json();
  if (!name || !email || !password || !businessName) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  const existing = get("SELECT id FROM users WHERE email = ?", [String(email).toLowerCase()]);
  if (existing) return NextResponse.json({ error: "Email already registered." }, { status: 409 });

  const userId = uid();
  run("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?,?,?,?,?)", [
    userId,
    String(email).toLowerCase(),
    name,
    hashPassword(password),
    nowIso(),
  ]);
  const businessId = createBusinessForUser(userId, businessName);
  if (demo) seedDemo(businessId, userId, name);

  const token = createSession(userId);
  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 60 };
  jar.set(SESSION_COOKIE, token, opts);
  jar.set(BUSINESS_COOKIE, businessId, { ...opts, httpOnly: false });
  return NextResponse.json({ ok: true });
}
