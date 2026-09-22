import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import ImportWizard from "../ImportWizard";

export const dynamic = "force-dynamic";

export default async function ImportPartiesPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const names = all<{ name: string }>("SELECT name FROM parties WHERE business_id=?", [ctx.business.id]).map((r) => r.name);
  return <ImportWizard kind="parties" existing={names} />;
}
