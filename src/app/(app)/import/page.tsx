import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import ImportHub from "./ImportHub";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  return <ImportHub canRestore={ctx.role === "Owner" || ctx.role === "Admin"} />;
}
