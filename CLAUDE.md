# Hishab — Project Memory

Business-management app for Bangladeshi SMEs (Karbar-style: parties ledger, inventory,
sales/purchase, POS, accounts, expenses, reports). Bilingual EN/BN, BDT (`Tk.`).

## Stack
- Next.js 15 (App Router, TypeScript), `output: "standalone"`.
- DB: **`@libsql/client`** (async). Online: `TURSO_DATABASE_URL` + `TURSO_DATABASE_TURSO_AUTH_TOKEN` (set by the Vercel Turso
  integration; `TURSO_AUTH_TOKEN` also accepted). Vercel project `hishab` (team shekorbd2023s-projects), region bom1.
  Local/dev/tests: file `<SMS_DATA_DIR>/hishab.db` (defaults to `./data`). Schema is created/migrated on the
  first query of each cold start (`ready()` in `src/lib/db.ts`).
- All DB helpers are async: `await all/get/run`, `await tx(async () => …)` (AsyncLocalStorage routes helpers
  inside tx to the transaction; nested tx joins; write txs are queued per process and retried on SQLITE_BUSY).
  `batchWrite([...])` = many statements atomically in one round trip (restore uses it).
  NEVER call a DB helper inside `.forEach/.some/.every/.filter` — use for…of or Promise.all.
- Styling: Tailwind CSS v4 (`@tailwindcss/postcss`). Theme via CSS variables +
  `data-theme` on `<html>`.
- Auth: email/password, scrypt hash, `sessions` table, `hishab_session` cookie.
- No external UI/chart deps — charts are hand-rolled inline SVG.

## Commands
- Build: `npm run build` · Dev: `npm run dev` (no flags needed since libSQL).

## Key conventions & gotchas
- Build trap: `src/lib/db.ts` uses `:memory:` when `NEXT_PHASE=phase-production-build`.
- Restore keeps a pre-restore snapshot in the `restore_snapshots` table (last 5 per business), not on disk.
- Every domain table has `business_id`; all queries are scoped to the active business.
- Currency renders Western digits with thousands separators (`Tk. 40,711.54`), never
  Bangla numerals, in both locales.
- Money math lives in `src/lib/domain.ts`; balances are DERIVED, never stored:
  - Party balance (+ = receivable / "To Receive", − = payable / "To Give") =
    opening + sales − salesReturn − paymentIn − purchase + paymentOut + purchaseReturn.
  - Account balance = opening + paymentIn − paymentOut + income − expense + transferIn − transferOut.
  - Item stock = opening + purchases + salesReturns − sales − purchaseReturns.
  - Cost of goods = FIFO (`src/lib/fifo.ts`, replays all stock moves; landed purchase cost incl. bill discount/charges).
    Used by the P&L (default method) and the "Item Wise Profit (FIFO)" report.
- All documents (sales invoice, purchase bill, quotation, sales/purchase return) share
  the `documents` + `doc_items` tables, keyed by `kind`.
- Doc numbers come from the `counters` table (per business, per kind).
- Every create/update/delete writes an `audit_log` row via `logAudit()`.
- i18n: `src/lib/i18n.ts` dictionaries `en`/`bn`; locale in `hishab_locale` cookie.

## Roles
Owner | Admin | Partner | Staff. Permissions map module → actions in
`business_members.permissions` (JSON). Owner/Admin see the audit log.

## Shipping (since v0.4.0 everything uses ONE online database)
Web → Vercel project `hishab` (https://hishab-six.vercel.app), deploys on every push to `main`;
functions in iad1 next to the Turso DB (US East) — keep them in the same region.
Android → Capacitor wrapper loads the site (`capacitor-wrapper/capacitor.config.json`), APK via the
"Build Android APK" workflow (release `apk-latest`). Windows → Electron window onto the site
(`WEB_URL` in `electron/main.js`, offline screen on load failure); the bundled local server is no longer started.

## Security rules (v0.3.0)
- Every write API checks `allowed(ctx, module, action)` (modules: parties, inventory, sales,
  purchase, expense, income, accounts, reports). Payment In → `sales`, Payment Out → `purchase`.
- Any id coming from the client (party/account/item/document) is checked with `belongs()`.
- Parties, items and accounts with transactions can't be deleted (409) — balances are derived,
  so deleting them would silently change the books.
- Staff: nobody can create/modify the Owner or themselves; Admins can't create/modify Admins.
- Restore whitelists columns (PRAGMA table_info), re-maps ids for cross-business backups, and
  snapshots current data to `<data>/backups/before-restore_*.json` first.
- "Today" is the Asia/Dhaka date (`todayIso()` / `TODAY()`), never `new Date().toISOString()`.

- Forgot password (v0.3.1): `/forgot-password` → `/api/auth/forgot` writes an 8-digit one-time code to
  `<data>/PASSWORD-RESET-CODE.txt` (Electron reveals it in Explorer via IPC); `/api/auth/reset` checks it
  (15 min, 5 tries, in-memory, sha256) and signs the user out everywhere. Both routes and the Owner's
  "change password without the current one" (settings `op: account`) work ONLY for local requests
  (`isLocalRequest`: Host, x-forwarded-host and every x-forwarded-for entry must be loopback — Next fills those itself for direct local requests) — never on the web deploy.

## Mobile layout (v0.3.2)
- ≤800px: sidebar is an off-canvas drawer (`.hs-shell.drawer`, closed by default, closes on route change);
  the desktop "mini" preference is ignored on phones. Bottom quick bar `.hs-bnav` (Dashboard, Sales, +, Parties, Inventory).
- ≤640px: `.m-hide` hides secondary columns/buttons; document lists (`.dl-tbl`) and bill lines (`.de-tbl`)
  render as cards via CSS grid-template-areas — keep the `dl-*` / `de-*` cell classes when editing those tables.

## Desktop releases
Bump both package.json versions, push tag `vX.Y.Z` → installed apps auto-update (see DEPLOY.md).
