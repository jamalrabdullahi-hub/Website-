-- Garsoore migration 2: account types, business profiles, admin audit log.
-- Run once:  npx wrangler d1 execute garsoore-dev-db --remote --file schema-2.sql
-- (SQLite cannot do "ADD COLUMN IF NOT EXISTS", so this file is not re-runnable. Re-running is harmless
--  apart from "duplicate column name" errors on the three ALTERs.)

-- users.role: consumer | business | agent | staff | admin      (staff and admin both reach the ops console)
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';       -- active | suspended
ALTER TABLE users ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 0;  -- 1 after an admin sets a temporary PIN
ALTER TABLE users ADD COLUMN created_by TEXT;                             -- admin user id, when created in the panel

-- a business account: a company that sells through Garsoore, buys wholesale, or stores stock with us (FBG)
CREATE TABLE IF NOT EXISTS businesses (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL UNIQUE,
  company     TEXT NOT NULL,
  kind        TEXT NOT NULL,                 -- seller | fbg | buyer | supplier | logistics
  city        TEXT,
  reg_no      TEXT,                          -- company registration / licence number
  contact     TEXT,
  commission  INTEGER,                       -- override of the default take rate, percent (NULL = default)
  status      TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | paused | rejected
  note        TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS businesses_status ON businesses(status, created_at);

-- every admin action, so account changes can always be traced back to a person
CREATE TABLE IF NOT EXISTS admin_log (
  at          TEXT NOT NULL,
  who         TEXT NOT NULL,
  who_name    TEXT NOT NULL,
  action      TEXT NOT NULL,
  target      TEXT,
  detail      TEXT
);
CREATE INDEX IF NOT EXISTS admin_log_at ON admin_log(at);

-- earlier accounts used the label 'customer'
UPDATE users SET role = 'consumer' WHERE role = 'customer';
