import { all } from "@/lib/db";

/** Party categories = saved categories (kind=party) ∪ categories already used on parties. */
export function partyCategories(bid: string): string[] {
  const rows = all<{ name: string }>(
    `SELECT name FROM categories WHERE business_id=? AND kind='party'
     UNION SELECT category AS name FROM parties WHERE business_id=? AND category IS NOT NULL AND category != ''`,
    [bid, bid]
  );
  return rows.map((r) => r.name).sort((a, b) => a.localeCompare(b));
}
