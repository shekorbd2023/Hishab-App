// Settings → Notifications (session auth): save email/SMS setup, send a test, send a due reminder.
import { NextResponse } from "next/server";
import { requireCtx, belongs, allowed } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getNotifyConfig, saveNotifyConfig, publicConfig, sendEmail, sendSms, remindParty, type NotifyConfig } from "@/lib/notify";

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bid = ctx.business.id;
  const b = await req.json().catch(() => ({}));
  const owner = ctx.role === "Owner" || ctx.role === "Admin";

  if (b.op === "remind") {
    if (!(await allowed(ctx, "sales", "create"))) return NextResponse.json({ error: "You don't have permission for this." }, { status: 403 });
    if (!(await belongs("parties", b.party_id, bid))) return NextResponse.json({ error: "Party not found" }, { status: 404 });
    const r = await remindParty(bid, b.party_id, b.channel === "email" ? "email" : "sms");
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
  }
  if (!owner) return NextResponse.json({ error: "Only the Owner or an Admin can change notifications." }, { status: 403 });

  if (b.op === "save") {
    const next = await saveNotifyConfig(bid, (b.patch || {}) as Partial<NotifyConfig>);
    await logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "settings", summary: "Changed email / SMS notification settings" });
    return NextResponse.json({ ok: true, config: publicConfig(next) });
  }
  if (b.op === "test_email") {
    const c = await getNotifyConfig(bid);
    const to = String(b.to || c.owner_email || ctx.user.email);
    const r = await sendEmail(bid, c, to, `${ctx.business.name} — Hishab test email`, `<p>✅ Email from <b>Hishab</b> is working.</p><p>হিসাব থেকে ইমেইল ঠিকমতো যাচ্ছে।</p>`, "Email from Hishab is working. হিসাব থেকে ইমেইল ঠিকমতো যাচ্ছে।");
    return r.ok ? NextResponse.json({ ok: true, to }) : NextResponse.json({ error: r.error }, { status: 400 });
  }
  if (b.op === "test_sms") {
    const c = await getNotifyConfig(bid);
    const r = await sendSms(bid, c, String(b.to || ""), `${ctx.business.name}: Hishab থেকে টেস্ট SMS। ঠিকমতো কাজ করছে।`);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
  }
  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
