import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";
import { getNotifyConfig, publicConfig } from "@/lib/notify";
import NotificationsClient from "./NotificationsClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const manager = ctx.role === "Owner" || ctx.role === "Admin";
  const cfg = publicConfig(await getNotifyConfig(bid));
  const logs = await all<{ id: string; channel: string; recipient: string; subject: string | null; status: string; error: string | null; created_at: string }>(
    "SELECT id, channel, recipient, subject, status, error, created_at FROM notify_log WHERE business_id=? ORDER BY created_at DESC LIMIT 25", [bid]);
  return <NotificationsClient manager={manager} initial={cfg} logs={logs} userEmail={ctx.user.email} />;
}
