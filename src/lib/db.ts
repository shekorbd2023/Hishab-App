import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { SCHEMA_SQL } from "./schema";

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
  db.exec(SCHEMA_SQL);
  return db;
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
