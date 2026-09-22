import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import ItemForm from "../ItemForm";
import { itemCategories } from "../data";

export const dynamic = "force-dynamic";

export default async function AddItemPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  return <ItemForm categories={itemCategories(ctx.business.id)} />;
}
