-- Shipping manifest: what a forwarder and a customs broker ask for, per consignment.
--
-- Two kinds of fact live here and they must not be confused:
--   DECLARED  what we told the carrier before the goods moved - value, weight, dimensions, battery status
--   MEASURED  what the facility actually found when it weighed and measured the cartons
-- A manifest that quietly overwrites the first with the second destroys the only record of what was declared,
-- which is exactly the record a customs dispute turns on.

CREATE TABLE IF NOT EXISTS manifest_lines (
  id            TEXT PRIMARY KEY,        -- ML-XXXXXX
  consignment   TEXT,                    -- fbg_consignments.id, null until the line is assigned to one
  order_id      TEXT,                    -- the customer order this line fulfils
  po_id         TEXT,                    -- the procurement PO that bought it

  -- what it is
  sku           TEXT NOT NULL,
  product_id    TEXT,                    -- the supplier's own id, which is what they will quote back at us
  description   TEXT NOT NULL,           -- plain English for the declaration, not the marketing title
  category      TEXT,
  hs_code       TEXT,
  origin        TEXT NOT NULL DEFAULT 'CN',

  -- how much of it
  qty           INTEGER NOT NULL,
  packages      INTEGER,                 -- carton count
  unit          TEXT NOT NULL DEFAULT 'pieces',

  -- declared before it moves
  weight_kg     REAL,
  length_cm     REAL,
  width_cm      REAL,
  height_cm     REAL,
  declared_value REAL,                   -- goods value for customs
  currency      TEXT NOT NULL DEFAULT 'USD',

  -- measured at the facility
  actual_kg     REAL,
  actual_cbm    REAL,
  actual_packages INTEGER,

  -- dangerous goods. battery: unknown | none | in_equipment | with_equipment | standalone
  battery       TEXT NOT NULL DEFAULT 'unknown',
  un_number     TEXT,                    -- UN3480 loose cells, UN3481 in or with equipment
  hazmat        TEXT,                    -- pipe separated: magnet|liquid|aerosol|flammable|powder
  dg_declared   INTEGER NOT NULL DEFAULT 0,   -- 1 once a dangerous-goods declaration exists for it

  state         TEXT NOT NULL DEFAULT 'DRAFT',  -- DRAFT | DECLARED | SHIPPED | CLEARED
  note          TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_manifest_cons  ON manifest_lines(consignment);
CREATE INDEX IF NOT EXISTS idx_manifest_order ON manifest_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_manifest_state ON manifest_lines(state, created_at DESC);
