-- Garsoore migration 3: FBG — Fulfilment by Garsoore.
--   China receiving → inspect/photograph/weigh → consolidation → freight → Somali warehouse → sell / keep / agent.
-- The importer OWNS the goods the whole way; Garsoore sells the infrastructure (receiving, consolidation, freight,
-- storage, pick & pack, marketplace, agents, settlement) and is paid in fees + a commission on what sells.
-- Run once:  npx wrangler d1 execute garsoore-dev-db --remote --file schema-3.sql

-- each importer gets a suite code; Chinese suppliers ship to the Garsoore China address with that code on the label
CREATE TABLE IF NOT EXISTS fbg_accounts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL UNIQUE,
  suite       TEXT NOT NULL UNIQUE,          -- e.g. GS-4821
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL
);

-- one expected shipment from one Chinese supplier (the customer tells us it is coming, we scan it in)
CREATE TABLE IF NOT EXISTS fbg_inbound (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  supplier      TEXT,
  platform      TEXT,                        -- 1688 | jd | taobao | mic | factory | other
  tracking      TEXT,                        -- Chinese courier tracking number
  title         TEXT NOT NULL,
  qty_expected  INTEGER NOT NULL DEFAULT 1,
  value_usd     INTEGER,                     -- what the importer paid the supplier (for customs + insurance)
  disposition   TEXT NOT NULL DEFAULT 'sell',-- keep | sell | agent  (can be changed until it ships)
  state         TEXT NOT NULL,               -- EXPECTED | RECEIVED | INSPECTED | CONSOLIDATED | SHIPPED | ARRIVED | CLOSED | PROBLEM
  cartons       INTEGER,
  kg            REAL,
  cbm           REAL,
  qty_received  INTEGER,
  photos        TEXT,                        -- JSON array of URLs taken at the China facility
  problem       TEXT,                        -- discrepancy note (short count, damage, wrong item)
  consignment   TEXT,                        -- freight batch id
  history       TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fbg_inbound_user ON fbg_inbound(user_id, created_at);
CREATE INDEX IF NOT EXISTS fbg_inbound_state ON fbg_inbound(state, created_at);

-- a freight batch out of the China facility (several inbounds consolidated into one shipment)
CREATE TABLE IF NOT EXISTS fbg_consignments (
  id          TEXT PRIMARY KEY,
  mode        TEXT NOT NULL,                 -- air | sea
  awb         TEXT,
  kg          REAL,
  cbm         REAL,
  cost_usd    REAL,                          -- what the freight actually cost Garsoore
  state       TEXT NOT NULL,                 -- OPEN | SHIPPED | ARRIVED
  eta         TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- stock in the Somali warehouse, owned by the importer until it sells
CREATE TABLE IF NOT EXISTS fbg_inventory (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  inbound_id    TEXT,
  title         TEXT NOT NULL,
  cat           TEXT,
  icon          TEXT,
  image         TEXT,
  qty_total     INTEGER NOT NULL,
  qty_available INTEGER NOT NULL,
  qty_reserved  INTEGER NOT NULL DEFAULT 0,
  qty_sold      INTEGER NOT NULL DEFAULT 0,
  landed_unit   REAL,                        -- the importer's own cost per unit (goods + freight + fees), for their P&L
  price         INTEGER,                     -- selling price on Garsoore, set by the owner
  disposition   TEXT NOT NULL DEFAULT 'stored',  -- stored | listed | agent | release (ship to owner) | closed
  mandate_id    TEXT,                        -- when handed to an agent
  location      TEXT,
  note          TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fbg_inv_user ON fbg_inventory(user_id, created_at);
CREATE INDEX IF NOT EXISTS fbg_inv_disp ON fbg_inventory(disposition, qty_available);

-- money owed to or by the importer: fees charged, sales credited, payouts made
CREATE TABLE IF NOT EXISTS fbg_ledger (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  at          TEXT NOT NULL,
  kind        TEXT NOT NULL,                 -- receiving | storage | freight | duty | pickpack | commission | sale | payout | adjust
  amount      REAL NOT NULL,                 -- + owed to the importer, - charged to the importer
  ref         TEXT,
  note        TEXT
);
CREATE INDEX IF NOT EXISTS fbg_ledger_user ON fbg_ledger(user_id, at);

-- orders can now be for FBG stock (someone else's goods, sold through Garsoore)
ALTER TABLE orders ADD COLUMN fbg_id TEXT;
