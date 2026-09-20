import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { itemStocks } from "@/lib/domain";
import ItemsTable from "./ItemsTable";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const items = all<{
    id: string; name: string; category: string | null; type: string; code: string | null;
    sales_price: number; purchase_price: number; mrp_price: number; wholesale_price: number;
    min_wholesale_qty: number; unit: string | null; opening_stock: number; low_stock_alert: number;
  }>("SELECT * FROM items WHERE business_id = ? ORDER BY name COLLATE NOCASE", [bid]);
  const stocks = itemStocks(bid);
  const withStock = items.map((it) => ({ ...it, stock: stocks[it.id] ?? 0 }));
  return <ItemsTable items={withStock} symbol={ctx.business.currency_symbol} />;
}
