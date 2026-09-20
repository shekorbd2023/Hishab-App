import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import StaffClient from "./StaffClient";

export const dynamic = "force-dynamic";

export default async function StaffsPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const members = all<{ user_id: string; role: string; status: string; joined_at: string; name: string; email: string }>(
    `SELECT m.user_id, m.role, m.status, m.joined_at, u.name, u.email
     FROM business_members m JOIN users u ON u.id = m.user_id
     WHERE m.business_id = ? ORDER BY m.joined_at`, [ctx.business.id]
  );
  return <StaffClient members={members} canManage={ctx.role === "Owner" || ctx.role === "Admin"} ownerId={ctx.business.owner_id} />;
}
