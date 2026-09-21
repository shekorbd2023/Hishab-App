import { all, get } from "./db";

export function editorData(bid: string) {
  const parties = all<{ id: string; name: string; type: string }>(
    "SELECT id, name, type FROM parties WHERE business_id = ? ORDER BY name COLLATE NOCASE", [bid]
  );
  const items = all<{ id: string; name: string; sales_price: number; purchase_price: number; wholesale_price: number; code: string | null }>(
    "SELECT id, name, sales_price, purchase_price, wholesale_price, code FROM items WHERE business_id = ? ORDER BY name COLLATE NOCASE", [bid]
  );
  const accounts = all<{ id: string; name: string }>(
    "SELECT id, name FROM accounts WHERE business_id = ? ORDER BY created_at", [bid]
  );
  return { parties, items, accounts };
}

export function peekNextNumber(bid: string, kind: string): number {
  const c = get<{ value: number }>("SELECT value FROM counters WHERE business_id = ? AND kind = ?", [bid, kind]);
  return (c?.value ?? 0) + 1;
}
