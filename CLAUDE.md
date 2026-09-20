# Hishab — Project Memory

Business-management app for Bangladeshi SMEs (Karbar-style: parties ledger, inventory,
sales/purchase, POS, accounts, expenses, reports). Bilingual EN/BN, BDT (`Tk.`).

## Stack
- Next.js 15 (App Router, TypeScript), `output: "standalone"`.
- DB: **`node:sqlite`** (`DatabaseSync`), NOT Prisma/better-sqlite3. Data dir from
  `SMS_DATA_DIR` (defaults to `./data`). File: `hishab.db`.
- Styling: Tailwind CSS v4 (`@tailwindcss/postcss`). Theme via CSS variables +
  `data-theme` on `<html>`.
- Auth: email/password, scrypt hash, `sessions` table, `hishab_session` cookie.
- No external UI/chart deps — charts are hand-rolled inline SVG.

## Commands
- Local build (Node 22 needs the flag): `NODE_OPTIONS=--experimental-sqlite npm run build`
- Dev: `NODE_OPTIONS=--experimental-sqlite npm run dev`
- Production Docker pins **Node 24** where `node:sqlite` is stable (no flag needed).

## Key conventions & gotchas
- Build trap: `src/lib/db.ts` uses `:memory:` when `NEXT_PHASE=phase-production-build`
  so `next build` workers don't deadlock on the SQLite file (ship-app skill gotcha #1).
- Every domain table has `business_id`; all queries are scoped to the active business.
- Currency renders Western digits with thousands separators (`Tk. 40,711.54`), never
  Bangla numerals, in both locales.
- Money math lives in `src/lib/domain.ts`; balances are DERIVED, never stored:
  - Party balance (+ = receivable / "To Receive", − = payable / "To Give") =
    opening + sales − salesReturn − paymentIn − purchase + paymentOut + purchaseReturn.
  - Account balance = opening + paymentIn − paymentOut + income − expense + transferIn − transferOut.
  - Item stock = opening + purchases + salesReturns − sales − purchaseReturns.
- All documents (sales invoice, purchase bill, quotation, sales/purchase return) share
  the `documents` + `doc_items` tables, keyed by `kind`.
- Doc numbers come from the `counters` table (per business, per kind).
- Every create/update/delete writes an `audit_log` row via `logAudit()`.
- i18n: `src/lib/i18n.ts` dictionaries `en`/`bn`; locale in `hishab_locale` cookie.

## Roles
Owner | Admin | Partner | Staff. Permissions map module → actions in
`business_members.permissions` (JSON). Owner/Admin see the audit log.

## Shipping (ship-app-web-mobile-desktop skill)
Web → Railway (Docker, volume at `/data`). Android → Capacitor wrapper (public repo,
GitHub Actions APK). Windows → Electron + electron-builder (`windows-latest`).
See `DEPLOY.md`.
