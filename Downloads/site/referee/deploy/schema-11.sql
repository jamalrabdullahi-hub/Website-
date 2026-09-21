-- Garsoore migration 11: managed wholesale sourcing.
--
-- The customer this exists for: a Somali trader with capital but not with logistics knowledge. They can find stock on
-- Alibaba. What stops them is everything after that — what an incoterm is, how goods get from a factory to a port,
-- how they get OUT of the port in Mogadishu. They do not want to learn it. They want somebody to do it.
--
-- So: they send a link or a description, Garsoore's agent contacts the supplier, negotiates, checks the listing is
-- real, and comes back with one price. A deposit buys that agent's time.
--
-- The deposit rules are the contract, and they are deliberately symmetrical:
--   * the deposit is a percentage of the GOODS value only, never of the shipping
--   * a subscriber pays no deposit at all
--   * if Garsoore cannot deliver it — dead listing, scam, supplier will not sell — the deposit is refunded IN FULL,
--     because that failure is ours and the trader should not pay for our bad listing
--   * if the trader walks away mid-negotiation, Garsoore keeps a share that grows with each day the agent was left
--     hanging, because that time was really spent and cannot be recovered
--
-- Run once:  npx wrangler d1 execute garsoore-dev-db --remote --file schema-11.sql
CREATE TABLE IF NOT EXISTS sourcing (
  id            TEXT PRIMARY KEY,        -- SR-XXXXXX
  user_id       TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  state         TEXT NOT NULL,           -- AWAITING_DEPOSIT | SOURCING | QUOTED | ACCEPTED | ORDERED | DELIVERED
                                         -- | CANCELLED | UNSOURCEABLE | DECLINED
  title         TEXT NOT NULL,
  url           TEXT,                    -- the Alibaba / 1688 / Made-in-China listing they pointed at
  platform      TEXT,
  qty           INTEGER NOT NULL,
  unit          TEXT,                    -- pieces | cartons | sets ...
  target_unit   REAL,                    -- what they hope to pay per unit, if they said
  goods_est     REAL NOT NULL,           -- estimated goods value: the base the deposit is taken on
  city          TEXT,
  notes         TEXT,

  -- deposit
  deposit_due   REAL NOT NULL,
  deposit_paid  REAL,
  deposit_txn   TEXT,
  deposit_at    TEXT,                    -- when it cleared: the clock for the cancellation decay starts here
  waived        INTEGER NOT NULL DEFAULT 0,   -- 1 = covered by an active subscription

  -- what the agent came back with
  quote_unit    REAL,
  quote_goods   REAL,
  quote_ship    REAL,
  quote_total   REAL,
  quote_eta     INTEGER,
  quote_note    TEXT,
  quoted_at     TEXT,
  supplier      TEXT,                    -- internal: who the agent found. Never shown to the customer.

  -- ending
  closed_at     TEXT,
  close_reason  TEXT,
  forfeit       REAL,                    -- what Garsoore kept of the deposit, and why, in the history
  refund        REAL,
  order_id      TEXT,                    -- the order this became, once accepted

  history       TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS sourcing_user  ON sourcing(user_id, created_at);
CREATE INDEX IF NOT EXISTS sourcing_state ON sourcing(state, created_at);

-- a subscription removes the deposit requirement while it is live
ALTER TABLE users ADD COLUMN sub_until TEXT;
