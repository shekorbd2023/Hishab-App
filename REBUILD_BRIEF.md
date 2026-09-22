# Hishab rebuild brief (shared by all builders)

Goal: make Hishab look and work like Karbar (my.karbarapp.com) screen-for-screen, but with our own brand
(name "Hishab / হিসাব", navy-and-green "H" logo at /logo.svg). Do NOT copy Karbar's logo, name or code — copy the
*features, layout patterns and flows*. The complete Karbar walkthrough is in
`/home/claude/karbar-notes/karbar-feature-map.md` — read the sections for your area carefully before building.

## Environment
- Project: `/home/claude/hishab` (Next.js 15 App Router, TypeScript, React 19, node:sqlite). No new npm deps.
- A dev server is ALREADY running: http://localhost:3100 (don't start another; don't kill it).
  Log: `/tmp/dev.log`. Login: POST /api/auth/login `{"email":"shekorbd2022@gmail.com","password":"shekor2024"}`
  e.g. `curl -s -c /tmp/cj_$AREA -H 'Content-Type: application/json' -d '{...}' http://localhost:3100/api/auth/login`
  then `curl -s -b /tmp/cj_$AREA http://localhost:3100/<page>`.
- The database already holds the real Shekor business imported from Karbar (198 parties, 58 items, 311 sales
  invoices with line items + additional charges, 36 purchases, returns, 22 payments, 31 expenses, 6 accounts, transfers).
  Use it to check your screens show correct numbers. NEVER delete or reset `data/hishab.db`. If you create test
  records via the API, delete them again afterwards.
- Screenshots: Playwright + Chromium are installed (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). You may write a
  small node script (in /tmp) using `playwright` from `/opt/pw-browsers` or `npx playwright` to log in and
  screenshot your pages at 1440×900 to check the look. Look at them with the Read tool.
- Type-check: `cd /home/claude/hishab && npx tsc --noEmit -p .` — must be clean for YOUR files before you finish.
  Other builders work in parallel; ignore errors in files you don't own.

## Design system (use it — do not invent a new look)
- CSS: `src/app/globals.css` — classes: card, page-head, page-title, toolbar, btn (btn-primary, btn-soft, btn-danger,
  btn-ghost, btn-sm, btn-lg, btn-icon), split, input, input-group, label, field, form-grid, search, seg, switch, chip
  (chip.on), table-wrap + table.tbl (th/td, .num, tr.clickable), sub, pill (pill-paid/unpaid/partial/muted), pos/neg,
  avatar (soft, lg), kpis + kpi, two-pane (pane-list, pane-head, pane-body, list-row(.active), pane-detail),
  menu, modal-*, empty, tabs, row, between, kbd, toast, print-area, print-stage.
  If you need extra CSS, APPEND it at the end of globals.css inside a comment block `/* === <your area> === */`.
  Never edit other sections.
- Components: `src/components/ui.tsx` exports Icon (see names inside), Dropdown, SplitButton, MoreButton, Modal,
  Avatar, StatusPill, Empty, Kpi, Switch, Seg, SearchBox, BackButton, FilterSelect, SortMenu, DateFilter + rangeFor,
  Picker (searchable combobox for party/item with right-side balance), ImageAttach, shrinkImage, useToast, post().
  Don't modify ui.tsx; put new shared bits in your own component file.
- Formatting: `src/lib/format.ts` → fmtDate("2026-09-21") = "21 Sep 2026", tk(n) = "Tk. 4,675", qty(), amountInWords(),
  initials(), TODAY(). Money always Western digits with thousands separators.
- Visual rules (from Karbar): white cards on #f7f8fa, 1px borders, 8px radius, 13–14px text, green primary
  buttons top-right, "Title (count)" page headings, search + filter chips + "Sort By" on list pages, status pills
  PAID/UNPAID/PARTIAL, green = receivable/in, red = payable/out, initials avatars, two-pane list/detail for
  Parties, Items, Accounts. Empty states with an icon + title + one line + primary action.

## Data layer (already built — use it)
- Schema: `src/lib/schema.ts` (documents have charges JSON [{title,amount}], round_off, doc_discount, account_id,
  due_date; doc_items.unit; payments.number/is_auto; expenses/incomes number + lines JSON; account_adjustments
  (add/reduce money); parties email/vat/photo/as_of_date; items location/description/image/secondary_unit;
  businesses email/category/biz_type/division/district/reg_no; accounts bank_name/holder/account_no).
- Query helpers: `all/get/run/tx` from `src/lib/db.ts` (server only). Always scope by business_id.
- Money logic: `src/lib/actions.ts` (computeTotals, createDocument, updateDocument, cloneDocument, recordPayment,
  adjustAccount, peekNumber, takeNumber) and `src/lib/domain.ts` (partyBalances, accountBalances, itemStocks,
  accountLedger, partyLedger, itemActivity, docLabel, sumDocuments…). Balances are always derived.
- Settings: `getSettings(bid)` / `saveSettings` in `src/lib/settings.ts` (BizSettings type lists everything:
  invoice print options, charge_presets, cash_sale_default, prefixes, theme…).
- Auth/context in server components: `const ctx = await requireCtx(); if (!ctx) redirect("/login")` →
  ctx.business (id, name, logo, phone, address, email…), ctx.user, ctx.role. Pages under `src/app/(app)/`
  are wrapped by AppShell automatically.
- APIs (POST JSON, body.op): /api/documents (create|update|duplicate|convert|delete — fields: kind, party_id,
  date, number, notes, lines[{itemId,name,qty,rate,discountType,discountValue,taxRate,unit}], charges[{title,amount}],
  doc_discount, round_off, due_date, paid_amount, account_id, images) · /api/payments (create|update|delete — kind
  in|out, party_id, account_id, document_id, amount, date, note, number, images) · /api/accounts (create|update|
  delete|transfer|adjust|delete_adjustment|delete_transfer) · /api/cashbook (kind expense|income; create|update|
  delete; category, account_id, amount or lines[{name,qty,rate}], date, note, number) · /api/parties · /api/items ·
  /api/settings · /api/business · /api/staff · /api/reminders · /api/export · /api/import.
  You may ADD ops to the API route of your own area; don't change existing ops' behaviour.

## Route map (final — link to these exact paths)
- /dashboard · /insights/sales · /insights/purchase · /insights/expense
- /parties · /parties/[id]
- /inventory · /inventory/[id] · /inventory/add · /inventory/[id]/edit
- Sales: /sales-invoices · /payment-in · /quotations · /sales-return
- Purchase: /purchase · /payment-out · /purchase-return
- Document editor: /documents/new?kind=sales_invoice|purchase_bill|quotation|sales_return|purchase_return[&party=ID]
  and /documents/[id]/edit. (/sales-invoices/create and /purchase/create must redirect to the editor.)
- Preview/print: /doc/[id] (invoice/bill/return/quotation) · /receipt/[id] (payment in/out money receipt)
- /pos (Quick POS)
- /expense · /income · /accounts · /accounts/[id]
- /reports · /reports/[type] (types = Karbar list: sales, purchase, sales-return, purchase-return, day-book,
  all-transactions, profit-and-loss, party-statement, all-party, item-detail, item-list, low-stock-summary,
  stock-quantity, income-expense, expense-category, income-category, cash-in-hand-statement, bank-statement,
  discount, tax-sales, tax-purchase) + our extras (monthly, json-report)
- /staffs · /reminders · /audit · /backup
- /import · /import/parties · /import/items
- /tools/business-card · /tools/greeting-card · /tools/barcode · /tools/bill-gallery
- /help · /tutorials · /whats-new
- /settings → /settings/general · /settings/account · /settings/business-profile · /settings/features/parties ·
  /settings/features/inventory · /settings/features/transactions · /settings/features/invoice-print

## Rules
- Only edit files you own (listed in your task). Create new files freely inside your own route folders.
- Keep pages fast: server components load data; client components only where interaction is needed.
- English UI text is fine (the i18n owner may translate nav labels). Keep Bangla item/party names rendering correctly.
- Finish with: tsc clean for your files, every page you own returns HTTP 200 when logged in, no new errors in
  /tmp/dev.log for your routes, and a short report of what you built + anything left undone.
