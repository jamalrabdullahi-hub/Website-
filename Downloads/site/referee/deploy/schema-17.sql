-- Garsoore migration 17: the purchaser-agent service.
--
-- The reframe: business.<domain> is not only a wholesale marketplace, it is a SERVICE — a sourcing agent you hire.
-- A trader sends a link (Alibaba / 1688 / Made-in-China / a factory's WhatsApp) or just a description, and someone
-- actually goes and investigates, negotiates, and comes back with one priced offer. That someone is a person in
-- Guangzhou on Garsoore's side, and they are paid out of the goods commission.
--
-- Three new roles sit on top of the existing consumers/businesses:
--   client        the buyer (a trader, or a legacy buyer who already imports and just wants the rail)
--   sales         a SALES AGENT — owns a book of clients, earns 50% of the goods commission
--   china         a CHINA AGENT — in Guangzhou, works the request, sources and quotes; earns a cut of the commission
--
-- The money is unchanged in spirit and precise in form:
--   * commission is on the GOODS value only, never the shipping
--   * the rate steps down with size — 5% small, 3% large (the exact break is a number in deploy/api.js, COMM)
--   * of that commission: sales agent keeps 50%, the China agent takes a cut, Garsoore keeps the remainder
--   * a subscriber ($50/mo) pays no deposit and has no minimum; a non-subscriber posts a 30% quote deposit and must
--     clear a $500 goods minimum, because below that the agent's time costs more than the trade is worth
--
-- Run once:  npx wrangler d1 execute garsoore-dev-db --remote --file schema-17.sql

-- A representative: a person who is either a sales agent (client book) or a China agent (sourcing desk).
-- Kept separate from `agents` (the marketplace wakiil who fronts a per-deal mandate): those two are different jobs
-- and collapsing them would make "who earns this commission" unanswerable.
CREATE TABLE IF NOT EXISTS agent_reps (
  id          TEXT PRIMARY KEY,        -- AR-XXXXXX
  user_id     TEXT NOT NULL UNIQUE,    -- the account
  kind        TEXT NOT NULL,           -- sales | china
  city        TEXT,                    -- sales: their town; china: Guangzhou by default
  status      TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | paused | blocked
  share_pct   REAL,                    -- this rep's share of the goods commission (%). null = the class default
  capacity    INTEGER,                 -- sales: max clients; china: max open jobs
  note        TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_reps_kind   ON agent_reps(kind, status);
CREATE INDEX IF NOT EXISTS agent_reps_status ON agent_reps(status, created_at);

-- Every client carries the sales agent who owns them. "Assign yourself an agent" is just choosing who this is set to.
ALTER TABLE users ADD COLUMN client_agent TEXT;    -- users.id of the sales rep, or null until assigned
ALTER TABLE users ADD COLUMN cust_kind    TEXT;    -- legacy | new — a legacy buyer already imports and joins for the rail

-- A sourcing request now knows who is working it on both sides, and carries its commission.
ALTER TABLE sourcing ADD COLUMN sales_agent_id  TEXT;   -- the sales rep credited for the client
ALTER TABLE sourcing ADD COLUMN china_agent_id  TEXT;   -- the China rep who sources and quotes
ALTER TABLE sourcing ADD COLUMN customer_kind   TEXT;   -- legacy | new, copied off the user at creation
ALTER TABLE sourcing ADD COLUMN commission_goods REAL;  -- the goods value the commission is computed on
ALTER TABLE sourcing ADD COLUMN commission_split TEXT;  -- JSON: {goods, rate, commission, sales, china, platform}
CREATE INDEX IF NOT EXISTS sourcing_china ON sourcing(china_agent_id, state);
CREATE INDEX IF NOT EXISTS sourcing_sales ON sourcing(sales_agent_id, created_at);

-- What a rep has earned. Balances are SUM(amount) per rep, never a stored number — a stored balance can disagree
-- with its own history, and this is somebody's pay. `amount` is signed: + earned, − paid out.
CREATE TABLE IF NOT EXISTS agent_ledger (
  id       TEXT PRIMARY KEY,           -- AL-XXXXXX
  rep_id   TEXT NOT NULL,              -- agent_reps.id
  user_id  TEXT NOT NULL,              -- the rep's user id, for payouts and notifications
  at       TEXT NOT NULL,
  kind     TEXT NOT NULL,              -- commission | payout | adjust
  amount   REAL NOT NULL,              -- signed, USD
  ref      TEXT,                       -- sourcing id / order id the commission came from
  note     TEXT
);
CREATE INDEX IF NOT EXISTS agent_ledger_rep  ON agent_ledger(rep_id, at DESC);
CREATE INDEX IF NOT EXISTS agent_ledger_user ON agent_ledger(user_id, at DESC);
