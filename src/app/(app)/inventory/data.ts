import { all } from "@/lib/db";
import { itemStocks } from "@/lib/domain";

export type ItemRow = {
  id: string; name: string; category: string | null; type: string; code: string | null;
  sales_price: number; purchase_price: number; mrp_price: number; wholesale_price: number; min_wholesale_qty: number;
  unit: string | null; secondary_unit: string | null; conversion_rate: number; opening_stock: number; low_stock_alert: number;
  location: string | null; description: string | null; image: string | null; created_at: string; stock: number;
};

export function loadItems(bid: string): ItemRow[] {
  const stocks = itemStocks(bid);
  return all<Omit<ItemRow, "stock">>(
    `SELECT id, name, category, type, code, sales_price, purchase_price, mrp_price, wholesale_price, min_wholesale_qty,
            unit, secondary_unit, conversion_rate, opening_stock, low_stock_alert, location, description, image, created_at
     FROM items WHERE business_id = ? ORDER BY name COLLATE NOCASE`, [bid]
  ).map((it) => ({ ...it, stock: Math.round((stocks[it.id] || 0) * 1000) / 1000 }));
}

export function itemCategories(bid: string): string[] {
  return all<{ name: string }>(
    `SELECT name FROM categories WHERE business_id=? AND kind='item'
     UNION SELECT category AS name FROM items WHERE business_id=? AND category IS NOT NULL AND category != ''`, [bid, bid]
  ).map((r) => r.name).sort((a, b) => a.localeCompare(b));
}

export function stockState(it: { stock: number; low_stock_alert: number; type: string }): "in" | "low" | "out" {
  if (it.type === "Service") return "in";
  if (it.stock <= 0) return "out";
  if (it.low_stock_alert > 0 && it.stock <= it.low_stock_alert) return "low";
  return "in";
}
