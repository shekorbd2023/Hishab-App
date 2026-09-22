// Full SQLite schema for Hishab. Idempotent — safe to run on every connect.
// Money is stored as REAL (BDT). IDs are UUID text. Timestamps are ISO strings.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'BDT',
  currency_symbol TEXT NOT NULL DEFAULT 'Tk.',
  address TEXT,
  phone TEXT,
  logo TEXT,
  email TEXT,
  category TEXT,
  biz_type TEXT,
  division TEXT,
  district TEXT,
  reg_no TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS business_members (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'Staff',          -- Owner | Admin | Partner | Staff
  permissions TEXT,                            -- JSON map module->[view,create,edit,delete]
  status TEXT NOT NULL DEFAULT 'Accepted',     -- Accepted | Pending
  joined_at TEXT NOT NULL,
  UNIQUE(business_id, user_id)
);

CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  type TEXT NOT NULL DEFAULT 'customer',        -- customer | supplier | both
  category TEXT,
  opening_balance REAL NOT NULL DEFAULT 0,      -- signed: + = they owe us
  note TEXT,
  email TEXT,
  vat TEXT,
  photo TEXT,
  as_of_date TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  type TEXT NOT NULL DEFAULT 'Product',         -- Product | Service
  code TEXT,                                     -- item code / barcode
  sales_price REAL NOT NULL DEFAULT 0,
  purchase_price REAL NOT NULL DEFAULT 0,
  mrp_price REAL NOT NULL DEFAULT 0,
  wholesale_price REAL NOT NULL DEFAULT 0,
  min_wholesale_qty REAL NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  opening_stock REAL NOT NULL DEFAULT 0,
  low_stock_alert REAL NOT NULL DEFAULT 0,
  track_batch INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  description TEXT,
  image TEXT,
  secondary_unit TEXT,
  conversion_rate REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'cash',            -- cash | bank | wallet
  opening_balance REAL NOT NULL DEFAULT 0,
  bank_name TEXT,
  holder TEXT,
  account_no TEXT,
  created_at TEXT NOT NULL
);

-- One table for all transactional documents.
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,               -- sales_invoice | purchase_bill | quotation | sales_return | purchase_return
  number INTEGER NOT NULL,
  party_id TEXT REFERENCES parties(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  notes TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  discount_total REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',  -- unpaid | partial | paid (n/a for quotation)
  payment_mode TEXT,
  images TEXT,                             -- JSON array of data URLs
  charges TEXT,                            -- JSON [{title, amount}] additional charges
  round_off REAL NOT NULL DEFAULT 0,
  doc_discount REAL NOT NULL DEFAULT 0,    -- bill-level discount (Tk)
  account_id TEXT,                         -- payment account (payment mode)
  due_date TEXT,
  manual_number TEXT,
  source_id TEXT,                          -- converted/duplicated from
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS doc_items (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 0,
  rate REAL NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT 'flat', -- flat | percent
  discount_value REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  unit TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                 -- in | out
  party_id TEXT REFERENCES parties(id) ON DELETE SET NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  amount REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  mode TEXT,
  note TEXT,
  number INTEGER NOT NULL DEFAULT 0,       -- receipt / voucher no
  is_auto INTEGER NOT NULL DEFAULT 0,      -- 1 = created with its document
  images TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  number INTEGER NOT NULL DEFAULT 0,
  lines TEXT,                              -- JSON [{name, qty, rate, amount}] itemised expense
  images TEXT,
  category TEXT,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  amount REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incomes (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  number INTEGER NOT NULL DEFAULT 0,
  lines TEXT,
  images TEXT,
  category TEXT,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  amount REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  from_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  to_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  amount REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

-- Add Money / Reduce Money on an account (not income/expense; e.g. owner capital, drawings)
CREATE TABLE IF NOT EXISTS account_adjustments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                 -- add | reduce
  amount REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  note TEXT,
  images TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  party_id TEXT REFERENCES parties(id) ON DELETE CASCADE,
  due_date TEXT NOT NULL,
  note TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                 -- party | item | expense | income
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,               -- create | update | delete
  entity TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  json TEXT
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  qty_delta REAL NOT NULL DEFAULT 0,
  reason TEXT,
  date TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS counters (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_parties_biz ON parties(business_id);
CREATE INDEX IF NOT EXISTS idx_items_biz ON items(business_id);
CREATE INDEX IF NOT EXISTS idx_accounts_biz ON accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_documents_biz ON documents(business_id, kind);
CREATE INDEX IF NOT EXISTS idx_docitems_doc ON doc_items(document_id);
CREATE INDEX IF NOT EXISTS idx_payments_biz ON payments(business_id, kind);
CREATE INDEX IF NOT EXISTS idx_expenses_biz ON expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_incomes_biz ON incomes(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_biz ON audit_log(business_id);
CREATE INDEX IF NOT EXISTS idx_adj_biz ON account_adjustments(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_doc ON payments(document_id);
CREATE INDEX IF NOT EXISTS idx_docitems_item ON doc_items(item_id);
`;

// Columns added after v0.1.8 — applied to existing databases on connect (ALTER TABLE ADD COLUMN).
export const MIGRATIONS: [string, string, string][] = [
  ["businesses", "email", "TEXT"], ["businesses", "category", "TEXT"], ["businesses", "biz_type", "TEXT"],
  ["businesses", "division", "TEXT"], ["businesses", "district", "TEXT"], ["businesses", "reg_no", "TEXT"],
  ["parties", "email", "TEXT"], ["parties", "vat", "TEXT"], ["parties", "photo", "TEXT"], ["parties", "as_of_date", "TEXT"],
  ["items", "location", "TEXT"], ["items", "description", "TEXT"], ["items", "image", "TEXT"],
  ["items", "secondary_unit", "TEXT"], ["items", "conversion_rate", "REAL NOT NULL DEFAULT 0"],
  ["accounts", "bank_name", "TEXT"], ["accounts", "holder", "TEXT"], ["accounts", "account_no", "TEXT"],
  ["documents", "charges", "TEXT"], ["documents", "round_off", "REAL NOT NULL DEFAULT 0"],
  ["documents", "doc_discount", "REAL NOT NULL DEFAULT 0"], ["documents", "account_id", "TEXT"],
  ["documents", "due_date", "TEXT"], ["documents", "manual_number", "TEXT"], ["documents", "source_id", "TEXT"],
  ["doc_items", "unit", "TEXT"],
  ["payments", "number", "INTEGER NOT NULL DEFAULT 0"], ["payments", "is_auto", "INTEGER NOT NULL DEFAULT 0"], ["payments", "images", "TEXT"],
  ["expenses", "number", "INTEGER NOT NULL DEFAULT 0"], ["expenses", "lines", "TEXT"], ["expenses", "images", "TEXT"],
  ["incomes", "number", "INTEGER NOT NULL DEFAULT 0"], ["incomes", "lines", "TEXT"], ["incomes", "images", "TEXT"],
];
