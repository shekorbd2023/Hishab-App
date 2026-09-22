import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import ItemsTable from "./ItemsTable";
import { itemCategories, loadItems } from "./data";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  return <ItemsTable items={loadItems(bid)} categories={itemCategories(bid)} />;
}
