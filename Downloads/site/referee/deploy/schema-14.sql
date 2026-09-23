-- Shipments: one handover of goods from the China facility to whoever carries them to Mogadishu.
--
-- Deliberately NOT a Cainiao table. The contract is the same whoever carries it - we hand over goods, customs
-- data and a service level; we get back an order id, a tracking number, a label and a stream of events. Cainiao,
-- Maersk, DSV or a man with a WhatsApp number all fit that shape, and which one Garsoore uses is not yet decided.
-- Writing one carrier's field names into the schema would make the second carrier a rewrite.

CREATE TABLE IF NOT EXISTS shipments (
  id             TEXT PRIMARY KEY,        -- SH-XXXXXX, our own reference and the one we print on the carton
  consignment    TEXT,                    -- fbg_consignments.id when it travels as part of one

  provider       TEXT NOT NULL,           -- manual | cainiao | maersk | ...
  provider_order TEXT,                    -- their logistics order id
  tracking_no    TEXT,
  label_url      TEXT,
  routing        TEXT,                    -- presort / routing code they hand back, printed on the label

  service        TEXT NOT NULL,           -- air | sea | express
  origin         TEXT,                    -- the Garsoore China facility
  dest_name      TEXT,
  dest_phone     TEXT,
  dest_address   TEXT,
  dest_city      TEXT NOT NULL DEFAULT 'Mogadishu',
  dest_country   TEXT NOT NULL DEFAULT 'SO',

  -- what was handed over, summed from the manifest lines at the moment of handover
  packages       INTEGER,
  weight_kg      REAL,
  cbm            REAL,
  declared_value REAL,
  currency       TEXT NOT NULL DEFAULT 'USD',

  -- CREATED before anyone has it; the rest mirror what the carrier reports back
  state          TEXT NOT NULL DEFAULT 'CREATED',  -- CREATED | BOOKED | PICKED_UP | IN_TRANSIT | CUSTOMS | ARRIVED | DELIVERED | CANCELLED | FAILED
  last_event     TEXT,
  events         TEXT NOT NULL DEFAULT '[]',       -- append only, newest last, each {at, code, text, place}
  pickup         TEXT,                             -- what they told us about collection
  raw            TEXT,                             -- their last response verbatim, for the argument later

  note           TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ship_state ON shipments(state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ship_track ON shipments(tracking_no);

ALTER TABLE manifest_lines ADD COLUMN shipment TEXT;   -- which handover carried this line
CREATE INDEX IF NOT EXISTS idx_manifest_ship ON manifest_lines(shipment);
