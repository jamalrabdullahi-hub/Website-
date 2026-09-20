-- Garsoore D1 schema. Apply:  npx wrangler d1 execute garsoore-dev-db --remote --file schema.sql
-- Idempotent (IF NOT EXISTS) so it can be re-run after adding tables.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  phone       TEXT NOT NULL UNIQUE,          -- normalised 252XXXXXXXXX
  name        TEXT NOT NULL DEFAULT '',
  pin_hash    TEXT NOT NULL,                 -- pbkdf2-sha256$iterations$salt$hash
  role        TEXT NOT NULL DEFAULT 'customer',   -- customer | staff
  ref_code    TEXT NOT NULL UNIQUE,          -- this user's referral code
  referred_by TEXT,                          -- user id of the referrer
  credit      INTEGER NOT NULL DEFAULT 0,    -- store credit in whole USD (referral rewards, refunds to credit)
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,              -- sha-256 of the cookie value (the raw token is never stored)
  user_id     TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  phone       TEXT NOT NULL,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS login_attempts_phone ON login_attempts(phone, at);

CREATE TABLE IF NOT EXISTS orders (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  basket      TEXT,
  sku         TEXT NOT NULL,
  vsku        TEXT,
  quote_id    TEXT,
  title       TEXT NOT NULL,
  icon        TEXT,
  variant     TEXT,
  qty         INTEGER NOT NULL,
  unit        INTEGER NOT NULL,              -- USD per unit, server-priced
  discount    INTEGER NOT NULL DEFAULT 0,
  credit_used INTEGER NOT NULL DEFAULT 0,
  fee         INTEGER NOT NULL DEFAULT 0,    -- delivery fee charged
  total       INTEGER NOT NULL,              -- what the customer pays
  flow        TEXT NOT NULL,                 -- china | local
  state       TEXT NOT NULL,
  eta_days    INTEGER NOT NULL DEFAULT 0,
  pickup      TEXT NOT NULL,
  address     TEXT,
  pay         TEXT NOT NULL,
  pay_phone   TEXT,
  pay_txn     TEXT,                          -- mobile-money transaction reference typed by the customer
  escrow      TEXT NOT NULL DEFAULT 'none',  -- none | held | released | refunded
  code        TEXT NOT NULL,                 -- 6-digit pickup code
  econ        TEXT,                          -- JSON: revenue / cogs / gross (internal, staff only)
  history     TEXT NOT NULL,                 -- JSON [{state, at, by?}]
  dispute     TEXT,                          -- JSON
  review      TEXT,                          -- JSON {stars, text, at, by}
  cancel_reason TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS orders_state ON orders(state, created_at);
CREATE INDEX IF NOT EXISTS orders_sku ON orders(sku);

CREATE TABLE IF NOT EXISTS quotes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  status      TEXT NOT NULL,                 -- pending | quoted | declined
  title       TEXT NOT NULL,
  icon        TEXT,
  platform    TEXT,
  ref         TEXT,
  url         TEXT,
  seller      TEXT,
  kg          REAL,
  estimate    INTEGER,
  note        TEXT,
  total       INTEGER,
  eta_days    INTEGER,
  staff_note  TEXT,
  quoted_at   TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS quotes_status ON quotes(status, created_at);

-- anonymous funnel events (view -> cart -> checkout -> paid). No personal data.
CREATE TABLE IF NOT EXISTS events (
  name        TEXT NOT NULL,
  sku         TEXT,
  sid         TEXT,                          -- random per-browser id, not linked to a person
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_name ON events(name, at);

-- ---------------------------------------------------------------- selling & buying agents (wakiillo)
-- A mandate consigns a sale (or a purchase) to an agent. The agent's income is the spread between the
-- principal's floor (or ceiling, when buying) and the price actually achieved.
--   mode 'liquidity' : principal takes the floor price, fast; the agent keeps the whole spread (markup capped)
--   mode 'margin'    : the principal keeps seller_pct of the spread; worse for the agent, so slower to place
CREATE TABLE IF NOT EXISTS agents (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  cats        TEXT NOT NULL DEFAULT '[]',   -- JSON array of category ids
  cities      TEXT NOT NULL DEFAULT '[]',
  capacity    INTEGER NOT NULL DEFAULT 5,   -- how many live mandates they can carry
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | paused | blocked
  note        TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mandates (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,                -- the principal (seller or buyer)
  agent_id    TEXT,                         -- NULL while unassigned
  side        TEXT NOT NULL,                -- sell | buy
  mode        TEXT NOT NULL,                -- liquidity | margin
  title       TEXT NOT NULL,
  cat         TEXT,
  qty         INTEGER NOT NULL DEFAULT 1,
  unit        TEXT,
  floor       INTEGER NOT NULL,             -- sell: net to the seller. buy: the most the buyer will pay
  cap_pct     INTEGER NOT NULL,             -- how far past the floor the agent may price (buyer protection)
  seller_pct  INTEGER NOT NULL DEFAULT 0,   -- principal's share of the spread (0 in liquidity mode)
  ask         INTEGER,                      -- the agent's current price
  city        TEXT,
  notes       TEXT,
  state       TEXT NOT NULL,                -- OPEN | ASSIGNED | LISTED | NEGOTIATING | SOLD | SETTLED | CANCELLED | EXPIRED
  best_offer  INTEGER,
  deal_price  INTEGER,
  split       TEXT,                         -- JSON payout breakdown once sold
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mandates_state ON mandates(state, created_at);
CREATE INDEX IF NOT EXISTS mandates_user ON mandates(user_id, created_at);
CREATE INDEX IF NOT EXISTS mandates_agent ON mandates(agent_id, state);

-- every action an agent takes on someone else's mandate is logged and shown to the principal
CREATE TABLE IF NOT EXISTS mandate_events (
  mandate_id  TEXT NOT NULL,
  at          TEXT NOT NULL,
  who         TEXT NOT NULL,                -- user id
  who_name    TEXT NOT NULL,
  kind        TEXT NOT NULL,                -- created | assigned | ask | offer | counter | sold | settled | cancelled | note
  amount      INTEGER,
  text        TEXT
);
CREATE INDEX IF NOT EXISTS mandate_events_m ON mandate_events(mandate_id, at);
