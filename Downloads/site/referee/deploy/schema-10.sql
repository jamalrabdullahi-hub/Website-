-- Garsoore migration 10: record what a shipment ACTUALLY cost, so the assumptions can be corrected.
--
-- Every price on the site rests on four guesses: the freight rate card, the clearance loading, the packed density
-- per category, and the transit window. All four are currently unverified. One real shipment can settle all four,
-- but only if somebody writes down what really happened — so these columns exist to be filled in at arrival, and
-- the console's Calibration page compares them against what was predicted.
--
-- Run once:  npx wrangler d1 execute garsoore-dev-db --remote --file schema-10.sql
ALTER TABLE fbg_consignments ADD COLUMN clearance_usd REAL;   -- what clearing it really cost (agent, docs, handling)
ALTER TABLE fbg_consignments ADD COLUMN duty_usd      REAL;   -- duty actually assessed
ALTER TABLE fbg_consignments ADD COLUMN shipped_at    TEXT;   -- handed to the carrier
ALTER TABLE fbg_consignments ADD COLUMN arrived_at    TEXT;   -- landed in Mogadishu (arrived_at - shipped_at = real transit)
ALTER TABLE fbg_consignments ADD COLUMN note          TEXT;
