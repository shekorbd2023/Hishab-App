import path from "node:path";
import fs from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { createClient, type Client, type InStatement, type Transaction } from "@libsql/client";
import { SCHEMA_SQL, MIGRATIONS } from "./schema";

/* ---- Database connection -------------------------------------------------------
 * Online (Vercel): TURSO_DATABASE_URL + TURSO_AUTH_TOKEN point at the hosted libSQL/Turso database.
 * Local (dev, tests, self-hosted): a SQLite file at <SMS_DATA_DIR>/hishab.db through the same client.
 * Every helper is async. Inside tx(fn) all helpers automatically run on that transaction
 * (AsyncLocalStorage), so callers never pass a transaction handle around. */
const isBuild = process.env.NEXT_PHASE === "phase-production-build";
const remoteUrl = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || "";

const dataDir = process.env.SMS_DATA_DIR || path.join(process.cwd(), "data");
/** Folder that holds hishab.db when running with a local file (desktop / self-hosted). */
export const DATA_DIR = dataDir;
/** True when the data lives on the hosted database (no local files on this machine). */
export const IS_REMOTE_DB = !!remoteUrl;

let _client: Client | null = null;
let _ready: Promise<void> | null = null;

function client(): Client {
  if (_client) return _client;
  if (isBuild) {
    _client = createClient({ url: ":memory:" });
  } else if (remoteUrl) {
    _client = createClient({ url: remoteUrl, authToken: process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN });
  } else {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    _client = createClient({ url: "file:" + path.join(dataDir, "hishab.db") });
  }
  return _client;
}

/** Creates/migrates the schema once per process (cold start). */
function ready(): Promise<void> {
  if (!_ready) {
    const p = init();
    p.catch(() => { _ready = null; }); // let the next request retry after a failed cold start
    _ready = p;
  }
  return _ready;
}

async function init() {
  const c = client();
  if (!remoteUrl && !isBuild) {
    for (const p of ["PRAGMA busy_timeout = 15000", "PRAGMA journal_mode = WAL"]) { try { await c.execute(p); } catch { /* ignore */ } }
  }
  try { await c.execute("PRAGMA foreign_keys = ON"); } catch { /* ignore */ }
  // Migrate older databases BEFORE running the schema (new indexes reference new columns).
  for (const [table, col, ddl] of MIGRATIONS) {
    try {
      const cols = (await c.execute(`PRAGMA table_info(${table})`)).rows as unknown as { name: string }[];
      if (cols.length > 0 && !cols.some((x) => x.name === col)) await c.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
    } catch { /* ignore */ }
  }
  await c.executeMultiple(SCHEMA_SQL);
  if (!isBuild) await runDataFixes(c);
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
async function runDataFixes(c: Client) {
  try {
    const v = Number((await c.execute("PRAGMA user_version")).rows[0]?.user_version) || 0;
    if (v < 1) {
      const isDefault = "(unit IS NULL OR TRIM(unit) = '' OR LOWER(unit) IN ('pcs','pc','piece'))";
      const stmts: InStatement[] = [];
      for (const [name, unit] of Object.entries(SHEKOR_UNITS)) {
        stmts.push({ sql: `UPDATE items SET unit = ? WHERE name = ? AND ${isDefault}`, args: [unit, name] });
        stmts.push({ sql: `UPDATE doc_items SET unit = ? WHERE name = ? AND ${isDefault}`, args: [unit, name] });
      }
      await c.batch(stmts, "write");
      await c.execute("PRAGMA user_version = 1");
    }
  } catch { /* ignore */ }
}

// ---- Query helpers -------------------------------------------------------------
type Row = Record<string, unknown>;
type Value = string | number | bigint | null | ArrayBuffer | Uint8Array | boolean;

const txStore = new AsyncLocalStorage<Transaction>();

function norm(params: unknown[]): Value[] {
  return params.map((v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : (v as Value)));
}
/** libSQL rows are array-like objects with column getters; turn them into plain JSON-safe objects. */
function plain<T>(columns: string[], row: Record<string, unknown>): T {
  const o: Record<string, unknown> = {};
  for (const c of columns) { const v = row[c]; o[c] = typeof v === "bigint" ? Number(v) : v; }
  return o as T;
}
async function exec(sql: string, params: unknown[]) {
  const t = txStore.getStore();
  if (t) return t.execute({ sql, args: norm(params) });
  await ready();
  return client().execute({ sql, args: norm(params) });
}

export async function all<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await exec(sql, params);
  return r.rows.map((row) => plain<T>(r.columns, row as unknown as Record<string, unknown>));
}

export async function get<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const r = await exec(sql, params);
  return r.rows.length ? plain<T>(r.columns, r.rows[0] as unknown as Record<string, unknown>) : undefined;
}

export async function run(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid: number | bigint }> {
  const r = await exec(sql, params);
  return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid ?? 0 };
}

/** Runs many statements atomically in ONE round trip (fast over the network). Not for use inside tx(). */
export async function batchWrite(stmts: { sql: string; params?: unknown[] }[]): Promise<void> {
  if (txStore.getStore()) throw new Error("batchWrite cannot run inside tx()");
  await ready();
  await client().batch(stmts.map((s) => ({ sql: s.sql, args: norm(s.params ?? []) })), "write");
}

/** Runs fn atomically. Nested tx() calls join the outer transaction.
 * Write transactions are queued inside this process (one at a time), and a transaction that
 * hits "database is locked" (another device/server instance writing at the same moment)
 * is retried a few times with a short back-off before giving up. */
let txQueue: Promise<unknown> = Promise.resolve();
const isBusy = (e: unknown) => /SQLITE_BUSY|database is locked|SQLITE_LOCKED/i.test(String((e as { code?: string })?.code ?? "") + " " + String((e as Error)?.message ?? ""));

export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (txStore.getStore()) return fn();
  const turn = txQueue.then(() => runTx(fn), () => runTx(fn));
  txQueue = turn.catch(() => undefined);
  return turn;
}

async function runTx<T>(fn: () => Promise<T>): Promise<T> {
  await ready();
  for (let attempt = 0; ; attempt++) {
    let t: Transaction;
    try {
      t = await client().transaction("write");
    } catch (e) {
      if (isBusy(e) && attempt < 6) { await new Promise((r) => setTimeout(r, 120 * (attempt + 1))); continue; }
      throw e;
    }
    try {
      const out = await txStore.run(t, fn);
      await t.commit();
      return out;
    } catch (e) {
      try { await t.rollback(); } catch { /* ignore */ }
      if (isBusy(e) && attempt < 6) { await new Promise((r) => setTimeout(r, 120 * (attempt + 1))); continue; }
      throw e;
    } finally {
      t.close();
    }
  }
}
