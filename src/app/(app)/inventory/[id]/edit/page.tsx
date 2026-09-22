import { requireCtx } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import ItemForm from "../../ItemForm";
import { itemCategories, loadItems } from "../../data";

export const dynamic = "force-dynamic";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const it = loadItems(ctx.business.id).find((i) => i.id === id);
  if (!it) notFound();
  return <ItemForm initial={it} stock={it.stock} categories={itemCategories(ctx.business.id)} />;
}
