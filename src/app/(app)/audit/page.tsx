import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import AuditClient from "./AuditClient";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  if (ctx.role !== "Owner" && ctx.role !== "Admin") {
    return <div className="card" style={{ padding: "2rem", textAlign: "center" }}>Audit log is visible to Owner/Admin only.</div>;
  }
  const rows = all<{ id: string; user_name: string | null; action: string; entity: string; summary: string | null; created_at: string }>(
    "SELECT id, user_name, action, entity, summary, created_at FROM audit_log WHERE business_id = ? ORDER BY created_at DESC LIMIT 500", [ctx.business.id]
  );
  return <AuditClient rows={rows} />;
}
