import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import BackupClient from "./BackupClient";

export const dynamic = "force-dynamic";

export default async function BackupPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  return <BackupClient canRestore={ctx.role === "Owner" || ctx.role === "Admin"} businessName={ctx.business.name} />;
}
