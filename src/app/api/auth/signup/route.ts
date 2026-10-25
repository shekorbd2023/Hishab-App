import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { get, run } from "@/lib/db";
import { uid, nowIso, hashPassword } from "@/lib/util";
import { createSession, createBusinessForUser, SESSION_COOKIE, BUSINESS_COOKIE, cookieOpts } from "@/lib/auth";
import { seedDemo } from "@/lib/seed";

export async function POST(req: Request) {
  const { name, email, password, businessName, demo } = await req.json().catch(() => ({}));
  if (!name || !email || !password || !businessName) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  const existing = (await get("SELECT id FROM users WHERE email = ?", [String(email).trim().toLowerCase()]));
  if (existing) return NextResponse.json({ error: "Email already registered." }, { status: 409 });

  const userId = uid();
  (await run("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?,?,?,?,?)", [
        userId,
        String(email).trim().toLowerCase(),
        String(name).trim(),
        hashPassword(String(password)),
        nowIso(),
      ]));
  const businessId = (await createBusinessForUser(userId, businessName));
  if (demo) (await seedDemo(businessId, userId, name));

  const token = (await createSession(userId));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOpts(req));
  jar.set(BUSINESS_COOKIE, businessId, cookieOpts(req, false));
  return NextResponse.json({ ok: true });
}
