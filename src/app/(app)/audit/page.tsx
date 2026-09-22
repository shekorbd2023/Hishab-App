import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { Empty } from "@/components/ui";
import AuditClient, { type AuditRow } from "./AuditClient";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  if (ctx.role !== "Owner" && ctx.role !== "Admin") {
    return <div className="card"><Empty title="Owner / Admin only" text="The audit log is visible to the business Owner and Admins." icon="lock" /></div>;
  }
  const rows = all<AuditRow>(
    `SELECT id, user_name, action, entity, entity_id, summary, substr(before_json,1,6000) before_json, substr(after_json,1,6000) after_json, created_at
     FROM audit_log WHERE business_id = ? ORDER BY created_at DESC LIMIT 1000`, [ctx.business.id]);
  return <AuditClient rows={rows} businessName={ctx.business.name} />;
}
