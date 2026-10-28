// Vercel Cron (vercel.json) — once a day: email each owner who turned on the daily summary.
import { NextResponse } from "next/server";
import { sendDailySummaries } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const okSecret = secret && req.headers.get("authorization") === `Bearer ${secret}`;
  const fromVercelCron = !secret && (req.headers.get("user-agent") || "").startsWith("vercel-cron/");
  if (!okSecret && !fromVercelCron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sent = await sendDailySummaries();
  return NextResponse.json({ ok: true, sent });
}
