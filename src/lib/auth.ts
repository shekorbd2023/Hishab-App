import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { all, get, run } from "./db";
import { uid, nowIso } from "./util";

export const SESSION_COOKIE = "hishab_session";
export const BUSINESS_COOKIE = "hishab_business";
export const LOCALE_COOKIE = "hishab_locale";

export type User = { id: string; email: string; name: string };
export type Business = {
  id: string;
  name: string;
  owner_id: string;
  currency: string;
  currency_symbol: string;
  address: string | null;
  phone: string | null;
  logo: string | null;
};
export type Member = { role: string; permissions: string | null; status: string };

export function createSession(userId: string): string {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(); // 60d
  run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)", [token, userId, expires]);
  return token;
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = get<{ user_id: string; expires_at: string }>(
    "SELECT user_id, expires_at FROM sessions WHERE token = ?",
    [token]
  );
  if (!s || new Date(s.expires_at) < new Date()) return null;
  const u = get<User>("SELECT id, email, name FROM users WHERE id = ?", [s.user_id]);
  return u ?? null;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) run("DELETE FROM sessions WHERE token = ?", [token]);
}

export function businessesForUser(userId: string): (Business & { role: string })[] {
  return all<Business & { role: string }>(
    `SELECT b.*, m.role FROM businesses b
     JOIN business_members m ON m.business_id = b.id
     WHERE m.user_id = ? AND m.status = 'Accepted'
     ORDER BY b.created_at ASC`,
    [userId]
  );
}

export async function getActiveBusiness(
  userId: string
): Promise<{ business: Business; role: string } | null> {
  const list = businessesForUser(userId);
  if (list.length === 0) return null;
  const jar = await cookies();
  const wanted = jar.get(BUSINESS_COOKIE)?.value;
  const chosen = list.find((b) => b.id === wanted) ?? list[0];
  const { role, ...business } = chosen;
  return { business: business as Business, role };
}

export type Ctx = { user: User; business: Business; role: string };

export async function requireCtx(): Promise<Ctx | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const ab = await getActiveBusiness(user.id);
  if (!ab) return null;
  return { user, business: ab.business, role: ab.role };
}

export function getMember(businessId: string, userId: string): Member | undefined {
  return get<Member>(
    "SELECT role, permissions, status FROM business_members WHERE business_id = ? AND user_id = ?",
    [businessId, userId]
  );
}

// Owner/Admin/Partner can do everything; Staff limited by permissions JSON.
export function can(role: string, permissions: string | null, module: string, action: string): boolean {
  if (role === "Owner" || role === "Admin" || role === "Partner") return true;
  if (!permissions) return action === "view";
  try {
    const p = JSON.parse(permissions) as Record<string, string[]>;
    return (p[module] || []).includes(action);
  } catch {
    return action === "view";
  }
}

export function createBusinessForUser(ownerId: string, name: string): string {
  const id = uid();
  const now = nowIso();
  run(
    `INSERT INTO businesses (id, name, owner_id, currency, currency_symbol, created_at)
     VALUES (?,?,?,?,?,?)`,
    [id, name, ownerId, "BDT", "Tk.", now]
  );
  run(
    `INSERT INTO business_members (id, business_id, user_id, role, status, joined_at)
     VALUES (?,?,?,?,?,?)`,
    [uid(), id, ownerId, "Owner", "Accepted", now]
  );
  // seed defaults
  run("INSERT INTO accounts (id, business_id, name, type, opening_balance, created_at) VALUES (?,?,?,?,?,?)", [
    uid(), id, "Cash", "cash", 0, now,
  ]);
  for (const u of ["pcs", "kg", "g", "litre", "box", "dozen"]) {
    run("INSERT INTO units (id, business_id, name) VALUES (?,?,?)", [uid(), id, u]);
  }
  for (const c of ["Uncategorized", "Rent", "Utilities", "Salary", "Transport"]) {
    run("INSERT INTO categories (id, business_id, kind, name) VALUES (?,?,?,?)", [uid(), id, "expense", c]);
  }
  return id;
}

export function nextDocNumber(businessId: string, kind: string): number {
  const existing = get<{ value: number }>(
    "SELECT value FROM counters WHERE business_id = ? AND kind = ?",
    [businessId, kind]
  );
  if (!existing) {
    run("INSERT INTO counters (business_id, kind, value) VALUES (?,?,1)", [businessId, kind]);
    return 1;
  }
  const next = existing.value + 1;
  run("UPDATE counters SET value = ? WHERE business_id = ? AND kind = ?", [next, businessId, kind]);
  return next;
}
