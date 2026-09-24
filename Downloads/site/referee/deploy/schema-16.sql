-- Garsoore migration 16: the real freight spine — consignment → clearance → pickup.
--
-- The two fantasies this replaces:
--   1. an owned "Garsoore China Facility". Garsoore does not own a China warehouse and is not going to. The
--      consolidation point is the FORWARDER'S warehouse: they give us a receiving address and a client code,
--      suppliers ship to it, the forwarder consolidates and books the main leg. We borrow their shed, not build one.
--   2. a Cainiao carrier API. Cainiao is AliExpress e-commerce logistics and runs no consolidated B2B lane into
--      Mogadishu. The carrier on this lane is a China→Somalia forwarder (or a DDP/consolidation specialist) whose
--      integration is whatever they actually offer — a tracking webhook, a poll endpoint, or a portal we copy from.
--
-- The lane, as it really is:
--   supplier → forwarder's China warehouse (consolidation) → ONE AWB/BL → Mogadishu
--            → arrived at PORT OF MOGADISHU (sea) or ADEN ADDE / MGQ (air cargo)
--            → import clearance RUN BY GARSOORE → port/airport pickup → last mile → customer.
--
-- Garsoore clears and picks up itself, so the commercial terms are FOB / EXW / port-to-port, NOT DDP. DDP would put
-- the import clearance (and the duty) on the forwarder, which is exactly the leg Garsoore runs.
--
-- Run once:  npx wrangler d1 execute garsoore-dev-db --remote --file schema-16.sql

-- A consolidated batch: several purchase orders travelling as one handover, one AWB/BL, one mode.
-- It moves through the lane above; every child order's status is derived from this batch's status, so the customer
-- is never told a status the goods are not actually in.
CREATE TABLE IF NOT EXISTS consignments (
  id            TEXT PRIMARY KEY,        -- CN-XXXXXX — also the reference we give the forwarder
  forwarder     TEXT NOT NULL,           -- provider id (see legacy `forwarders` config); e.g. astaan | dtfu | manual
  warehouse_code TEXT,                   -- OUR client/suite code at that forwarder's China warehouse
  receive_code  TEXT,                    -- the code suppliers write on the label for THIS batch
  mode          TEXT NOT NULL,           -- air | sea
  arrival_port  TEXT NOT NULL,           -- PORT_MOGADISHU | AIRPORT_MGQ

  -- the single carriage document: AWB for air, Bill of Lading for sea
  doc_type      TEXT,                    -- AWB | BL
  doc_no        TEXT,
  carrier       TEXT,                    -- the airline/vessel/line, for our records only — never shown to a customer

  reference     TEXT,                    -- the forwarder's own batch/order id
  packages      INTEGER,
  chargeable_kg REAL,                    -- billed weight (volumetric or actual, whichever the forwarder charged on)
  cbm           REAL,
  declare_value REAL,                    -- goods value for the customs declaration
  cost_usd      REAL,                    -- what the main leg actually cost Garsoore (the forwarder's invoice)

  -- OPEN collecting lines → SEALED closed for changes → HANDED_OVER doc issued → IN_TRANSIT → ARRIVED_PORT
  -- → IN_CLEARANCE → CLEARED → COLLECTED → CLOSED   (branch: HELD for a customs hold)
  state         TEXT NOT NULL DEFAULT 'OPEN',
  cut_off       TEXT,                    -- last day the forwarder accepts cartons into this batch
  departed_at   TEXT,
  eta           TEXT,
  arrived_at    TEXT,
  cleared_at    TEXT,
  collected_at  TEXT,
  history       TEXT NOT NULL DEFAULT '[]',  -- append-only state transitions, so the batch keeps its own record too
  note          TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cons_state ON consignments(state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cons_forwarder ON consignments(forwarder, created_at DESC);

-- The import entry, run by Garsoore at Mogadishu. One consignment = one entry, cleared once.
-- Clearing is a fixed cost (agent, documents, terminal handling, delivery order) that does not care what is inside;
-- the ad valorem duty does. They are kept apart on purpose, exactly as data/customs.json models them.
CREATE TABLE IF NOT EXISTS clearance (
  id            TEXT PRIMARY KEY,        -- CL-XXXXXX
  consignment   TEXT NOT NULL,
  entry_no      TEXT,                    -- the customs entry / declaration number
  broker        TEXT,                    -- the clearing agent we used
  declared_value REAL,                   -- goods value on the entry (the manifest total, not what we charged)
  duty_usd      REAL NOT NULL DEFAULT 0, -- ad valorem duty on CIF, as assessed
  terminal_usd  REAL NOT NULL DEFAULT 0, -- terminal handling / port or airport charges
  handling_usd  REAL NOT NULL DEFAULT 0, -- broker fee + documents + delivery order
  other_usd     REAL NOT NULL DEFAULT 0, -- anything else, named in the note
  total_usd     REAL NOT NULL DEFAULT 0, -- what clearance actually cost us, all in
  currency      TEXT NOT NULL DEFAULT 'USD',
  state         TEXT NOT NULL DEFAULT 'DRAFT',  -- DRAFT | SUBMITTED | ASSESSED | RELEASED | HELD
  docs          TEXT,                    -- JSON: bill of lading, invoice, packing list, permits...
  released_at   TEXT,
  note          TEXT,
  by            TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clear_cons  ON clearance(consignment);
CREATE INDEX IF NOT EXISTS idx_clear_state ON clearance(state, created_at DESC);

-- Append-only tracking. Every event that moves a consignment — a forwarder webhook, a poll, or a person reading a
-- WhatsApp message — lands here in the same shape, so the customer's timeline cannot tell which kind produced it.
-- Never edited: the raw payload is kept for the argument later.
CREATE TABLE IF NOT EXISTS shipment_events (
  id          TEXT PRIMARY KEY,          -- EV-XXXXXX
  consignment TEXT,                      -- which batch it belongs to
  shipment    TEXT,                      -- legacy shipments.id, when the event came through that table
  at          TEXT NOT NULL,             -- when it happened on the ground
  code        TEXT,                      -- the provider's own code (normalised where we recognise it)
  text        TEXT,                      -- human sentence, as received or typed
  place       TEXT,                      -- city / port / facility
  source      TEXT NOT NULL DEFAULT 'manual',  -- webhook | poll | manual
  raw         TEXT,                      -- the provider's payload, verbatim
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ev_cons ON shipment_events(consignment, at);
CREATE INDEX IF NOT EXISTS idx_ev_ship ON shipment_events(shipment, at);

-- The forwarder roster. Non-secret config only — the API key / webhook secret lives in Worker secrets, never here.
-- `tracking` says how we hear from them; `active=0` parks a provider without deleting the history that points at it.
CREATE TABLE IF NOT EXISTS forwarders (
  id            TEXT PRIMARY KEY,        -- astaan | dtfu | cainiao(legacy) | manual ...
  label         TEXT NOT NULL,
  country_from  TEXT NOT NULL DEFAULT 'CN',
  receiving_address TEXT,                -- their China warehouse address, per-client code shown separately
  contact       TEXT,
  tracking      TEXT NOT NULL DEFAULT 'manual',  -- webhook | poll | portal | manual
  terms         TEXT,                    -- FOB | EXW | DDP | port-to-port ...
  active        INTEGER NOT NULL DEFAULT 1,
  note          TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- A purchase line now records what actually arrived at the forwarder, not just what we hoped for, and the batch it
-- was consolidated into. Declaration (what we told the forwarder) and receipt (what they found) stay separate.
ALTER TABLE procurement ADD COLUMN forwarder_ref TEXT;      -- the forwarder's inbound reference for this parcel
ALTER TABLE procurement ADD COLUMN received_kg REAL;        -- measured at the forwarder warehouse
ALTER TABLE procurement ADD COLUMN received_cartons INTEGER;
ALTER TABLE procurement ADD COLUMN received_at TEXT;        -- when the forwarder confirmed receipt
