import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { SCHEMA_SQL, MIGRATIONS } from "./schema";

// ---- Build-safe DB (ship-app skill gotcha #1) --------------------------------
// `next build` spawns many worker processes that each import this module and open
// the same SQLite file, deadlocking on WAL. During the build phase, hand each
// worker its own throwaway in-memory DB instead.
const isBuild = process.env.NEXT_PHASE === "phase-production-build";

const dataDir = process.env.SMS_DATA_DIR || path.join(process.cwd(), "data");
if (!isBuild && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = isBuild ? ":memory:" : path.join(dataDir, "hishab.db");

let _db: DatabaseSync | null = null;

function connect(): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA busy_timeout = 15000"); // set FIRST so later stmts wait on locks
  if (!isBuild) {
    try {
      db.exec("PRAGMA journal_mode = WAL");
    } catch {
      /* ignore */
    }
  }
  db.exec("PRAGMA foreign_keys = ON");
  // Migrate older databases BEFORE running the schema (new indexes reference new columns).
  for (const [table, col, ddl] of MIGRATIONS) {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (cols.length > 0 && !cols.some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
    } catch {
      /* ignore */
    }
  }
  db.exec(SCHEMA_SQL);
  if (!isBuild) runDataFixes(db);
  return db;
}

/* ---- One-time data fixes, tracked with PRAGMA user_version -------------------
 * v1: Karbar exported most Shekor items without a unit, so they all showed "PCS".
 *     Loose goods (dates, gur, sweets, loose honey, the 1 kg items) are sold by weight → KG,
 *     the 1-litre oil → LTR; fixed packs (250gm / 500ml …) stay PCS. Only touches items still on
 *     the default unit, so anything the user changed by hand is left alone. */
const SHEKOR_UNITS: Record<string, string> = {
  "Ajwa": "KG", "Irani Maryam": "KG", "Mabroom large": "KG", "Medjool Small": "KG", "Medjool large": "KG",
  "Medjul medium": "KG", "Safawi": "KG", "Sukkari mufattal": "KG", "Mashruk": "KG",
  "Khejurer Box patali gur": "KG", "Khejurer Khuri Patali": "KG", "khejurer bij gur": "KG", "Lal Ata": "KG",
  "Para shondesh": "KG", "Roshkodom": "KG", "Lichi honey -New season": "KG", "Sundaban honey-New season": "KG",
  "Plum honey": "KG", "Black seed Honey 1kg": "KG", "Shorisha Honey 1kg": "KG", "Sundarban Honey 1kg": "KG",
  "Maghi Shorishar Tel 1Litre": "LTR",
};
function runDataFixes(db: DatabaseSync) {
  try {
    const v = Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version) || 0;
    if (v < 1) {
      const isDefault = "(unit IS NULL OR TRIM(unit) = '' OR LOWER(unit) IN ('pcs','pc','piece'))";
      const upItem = db.prepare(`UPDATE items SET unit = ? WHERE name = ? AND ${isDefault}`);
      const upLines = db.prepare(`UPDATE doc_items SET unit = ? WHERE name = ? AND ${isDefault}`);
      db.exec("BEGIN");
      for (const [name, unit] of Object.entries(SHEKOR_UNITS)) { upItem.run(unit, name); upLines.run(unit, name); }
      db.exec("PRAGMA user_version = 1");
      db.exec("COMMIT");
    }
  } catch {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
  }
}

export function getDb(): DatabaseSync {
  if (!_db) _db = connect();
  return _db;
}

// ---- Tiny query helpers ------------------------------------------------------
type Row = Record<string, unknown>;

// node:sqlite returns rows with a null prototype; normalize to plain objects so
// they can be safely serialized / passed to Client Components.
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export function all<T = Row>(sql: string, params: unknown[] = []): T[] {
  const stmt = getDb().prepare(sql);
  return (stmt.all(...(params as never[])) as unknown[]).map((r) => plain<T>(r));
}

export function get<T = Row>(sql: string, params: unknown[] = []): T | undefined {
  const stmt = getDb().prepare(sql);
  const r = stmt.get(...(params as never[]));
  return r === undefined ? undefined : plain<T>(r);
}

export function run(
  sql: string,
  params: unknown[] = []
): { changes: number; lastInsertRowid: number | bigint } {
  const stmt = getDb().prepare(sql);
  const r = stmt.run(...(params as never[]));
  return { changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid };
}

export function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}
