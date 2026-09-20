-- Garsoore migration 4: procurement — the bridge between a paid order and the China facility.
-- A paid China order becomes a purchase task carrying the source link, quantity, the most the agent may pay, and a
-- reference code that goes on the parcel label. The parcel is then received against that code, joins the same
-- consolidation and freight batch as FBG cargo, and on arrival the customer's order moves itself forward.
-- Run once:  npx wrangler d1 execute garsoore-dev-db --remote --file schema-4.sql

CREATE TABLE IF NOT EXISTS procurement (
  id           TEXT PRIMARY KEY,          -- PO-XXXXXX — also the reference written on the carton
  order_id     TEXT NOT NULL,
  user_id      TEXT NOT NULL,             -- the customer waiting for it
  sku          TEXT,
  vsku         TEXT,
  title        TEXT NOT NULL,
  qty          INTEGER NOT NULL,
  platform     TEXT,                      -- mic | 1688 | jd | taobao | web …
  source_url   TEXT,
  supplier     TEXT,
  target_cny   REAL,                      -- what the catalogue assumed the goods cost (the agent should not exceed it)
  paid_cny     REAL,                      -- what the agent actually paid
  tracking     TEXT,                      -- the Chinese courier number
  cartons      INTEGER,
  kg           REAL,
  cbm          REAL,
  consignment  TEXT,
  state        TEXT NOT NULL,             -- QUEUED | ORDERED | IN_CHINA | CONSOLIDATED | SHIPPED | ARRIVED | CANCELLED
  note         TEXT,
  history      TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS procurement_state ON procurement(state, created_at);
CREATE INDEX IF NOT EXISTS procurement_order ON procurement(order_id);

-- consignments now carry both FBG cargo and Garsoore's own purchases
ALTER TABLE fbg_consignments ADD COLUMN kind TEXT NOT NULL DEFAULT 'mixed';
