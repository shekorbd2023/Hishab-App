import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, createBusinessForUser, BUSINESS_COOKIE } from "@/lib/auth";
import { seedDemo } from "@/lib/seed";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Business name required." }, { status: 400 });
  const id = createBusinessForUser(user.id, body.name);
  if (body.demo) seedDemo(id, user.id, user.name);
  const jar = await cookies();
  jar.set(BUSINESS_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 60, httpOnly: false, sameSite: "lax" });
  return NextResponse.json({ ok: true, id });
}
