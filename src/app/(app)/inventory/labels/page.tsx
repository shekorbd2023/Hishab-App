import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import LabelsClient from "./LabelsClient";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const items = all<{ id: string; name: string; code: string | null; sales_price: number }>(
    "SELECT id, name, code, sales_price FROM items WHERE business_id = ? ORDER BY name COLLATE NOCASE", [ctx.business.id]
  );
  return <LabelsClient items={items} symbol={ctx.business.currency_symbol} businessName={ctx.business.name} />;
}
