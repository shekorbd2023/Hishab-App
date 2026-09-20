import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { itemStocks } from "@/lib/domain";
import POSClient from "./POSClient";

export const dynamic = "force-dynamic";

export default async function POSPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const items = all<{ id: string; name: string; category: string | null; sales_price: number; code: string | null; unit: string | null }>(
    "SELECT id, name, category, sales_price, code, unit FROM items WHERE business_id = ? ORDER BY name COLLATE NOCASE", [bid]
  );
  const stocks = itemStocks(bid);
  const withStock = items.map((it) => ({ ...it, stock: stocks[it.id] ?? 0 }));
  const accounts = all<{ id: string; name: string }>("SELECT id, name FROM accounts WHERE business_id = ? ORDER BY created_at", [bid]);
  const parties = all<{ id: string; name: string }>("SELECT id, name FROM parties WHERE business_id = ? ORDER BY name COLLATE NOCASE", [bid]);
  return <POSClient items={withStock} accounts={accounts} parties={parties} symbol={ctx.business.currency_symbol} />;
}
