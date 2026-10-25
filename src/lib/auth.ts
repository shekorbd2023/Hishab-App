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

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(); // 60d
  (await run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)", [token, userId, expires]));
  return token;
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = (await get<{ user_id: string; expires_at: string }>(
      "SELECT user_id, expires_at FROM sessions WHERE token = ?",
      [token]
    ));
  if (!s || new Date(s.expires_at) < new Date()) return null;
  const u = (await get<User>("SELECT id, email, name FROM users WHERE id = ?", [s.user_id]));
  return u ?? null;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) (await run("DELETE FROM sessions WHERE token = ?", [token]));
}

export async function businessesForUser(userId: string): Promise<(Business & { role: string })[]> {
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
  const list = (await businessesForUser(userId));
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

export async function getMember(businessId: string, userId: string): Promise<Member | undefined> {
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

/** Permission check for the current member in the active business. */
export async function allowed(ctx: Ctx, module: string, action: string): Promise<boolean> {
  const m = (await getMember(ctx.business.id, ctx.user.id));
  return can(ctx.role, m?.permissions ?? null, module, action);
}

export const ROLES = ["Owner", "Admin", "Partner", "Staff"] as const;
export const isManager = (role: string) => role === "Owner" || role === "Admin" || role === "Partner";

/** True when `id` is a row of `table` inside this business (guards cross-business references). */
export async function belongs(table: "parties" | "accounts" | "items" | "documents", id: unknown, businessId: string): Promise<boolean> {
  if (id === null || id === undefined || id === "") return true;
  return !!(await get(`SELECT id FROM ${table} WHERE id = ? AND business_id = ?`, [String(id), businessId]));
}

/* ---- Login throttling (in-memory, per email+IP) ---------------------------- */
const attempts = new Map<string, { n: number; until: number; first: number }>();
const WINDOW = 15 * 60 * 1000, MAX_TRIES = 8, LOCK = 15 * 60 * 1000;
export function loginBlocked(key: string): number {
  const a = attempts.get(key);
  if (!a) return 0;
  const now = Date.now();
  if (a.until > now) return Math.ceil((a.until - now) / 60000);
  if (now - a.first > WINDOW) attempts.delete(key);
  return 0;
}
export function loginFailed(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.first > WINDOW) { attempts.set(key, { n: 1, until: 0, first: now }); return; }
  a.n++;
  if (a.n >= MAX_TRIES) a.until = now + LOCK;
}
export function loginSucceeded(key: string) { attempts.delete(key); }

/** Session cookie options; `secure` only over HTTPS so the local desktop app (http://127.0.0.1) keeps working. */
export function cookieOpts(req: Request, httpOnly = true) {
  const proto = req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "");
  return { httpOnly, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 60, secure: proto === "https" };
}

export async function createBusinessForUser(ownerId: string, name: string): Promise<string> {
  const id = uid();
  const now = nowIso();
  (await run(
        `INSERT INTO businesses (id, name, owner_id, currency, currency_symbol, created_at)
     VALUES (?,?,?,?,?,?)`,
        [id, name, ownerId, "BDT", "Tk.", now]
      ));
  (await run(
        `INSERT INTO business_members (id, business_id, user_id, role, status, joined_at)
     VALUES (?,?,?,?,?,?)`,
        [uid(), id, ownerId, "Owner", "Accepted", now]
      ));
  // seed defaults
  (await run("INSERT INTO accounts (id, business_id, name, type, opening_balance, created_at) VALUES (?,?,?,?,?,?)", [
        uid(), id, "Cash", "cash", 0, now,
      ]));
  for (const u of ["pcs", "kg", "g", "litre", "box", "dozen"]) {
    (await run("INSERT INTO units (id, business_id, name) VALUES (?,?,?)", [uid(), id, u]));
  }
  for (const c of ["Uncategorized", "Rent", "Utilities", "Salary", "Transport"]) {
    (await run("INSERT INTO categories (id, business_id, kind, name) VALUES (?,?,?,?)", [uid(), id, "expense", c]));
  }
  return id;
}

export async function nextDocNumber(businessId: string, kind: string): Promise<number> {
  const existing = (await get<{ value: number }>(
      "SELECT value FROM counters WHERE business_id = ? AND kind = ?",
      [businessId, kind]
    ));
  if (!existing) {
    (await run("INSERT INTO counters (business_id, kind, value) VALUES (?,?,1)", [businessId, kind]));
    return 1;
  }
  const next = existing.value + 1;
  (await run("UPDATE counters SET value = ? WHERE business_id = ? AND kind = ?", [next, businessId, kind]));
  return next;
}
