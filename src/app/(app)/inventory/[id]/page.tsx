import { requireCtx } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { itemActivity } from "@/lib/domain";
import { itemCategories, loadItems } from "../data";
import ItemDetail from "./ItemDetail";

export const dynamic = "force-dynamic";

// Karbar item detail: two-pane (items list left, the item with KPIs + Item Activity / Item Details tabs right).
export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const items = loadItems(bid);
  const item = items.find((i) => i.id === id);
  if (!item) notFound();
  const activity = itemActivity(bid, id).reverse();
  return <ItemDetail items={items} item={item} activity={activity} categories={itemCategories(bid)} />;
}
