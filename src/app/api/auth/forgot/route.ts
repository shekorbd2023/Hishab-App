import { NextResponse } from "next/server";
import { get } from "@/lib/db";
import { isLocalRequest, issueResetCode, RESET_FILE } from "@/lib/reset";

export async function POST(req: Request) {
  if (!isLocalRequest(req))
    return NextResponse.json({ error: "Password reset only works in the Hishab desktop app on your own computer." }, { status: 403 });
  const { email } = await req.json().catch(() => ({}));
  const em = String(email || "").trim().toLowerCase();
  if (!em) return NextResponse.json({ error: "Enter your login email." }, { status: 400 });
  const u = get<{ id: string }>("SELECT id FROM users WHERE email = ?", [em]);
  if (!u) return NextResponse.json({ error: "No account with this email on this computer." }, { status: 404 });
  const r = issueResetCode(em);
  if (!r.ok) return NextResponse.json({ error: `Please wait ${r.wait} seconds before asking for a new code.` }, { status: 429 });
  return NextResponse.json({ ok: true, file: RESET_FILE });
}
