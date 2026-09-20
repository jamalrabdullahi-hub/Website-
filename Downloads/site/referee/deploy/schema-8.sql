-- Garsoore migration 8: lock the shipping rate onto the order.
--
-- The promise this makes possible: a price quoted to a customer is the price that customer pays, for the life of that
-- order, even if the rate card expires or the provider raises rates the next day. Garsoore absorbs ordinary rate
-- movement; it is never passed back to somebody who already bought.
--
-- Run once:  npx wrangler d1 execute garsoore-dev-db --remote --file schema-8.sql
ALTER TABLE orders ADD COLUMN ship_mode     TEXT;   -- air | sea (null for domestic/FBG stock already in Somalia)
ALTER TABLE orders ADD COLUMN rate_card_id  TEXT;   -- the card that priced this order, e.g. GARSOORE-CN-SOM-AIR-V1
ALTER TABLE orders ADD COLUMN ship_cost     REAL;   -- the contracted freight inside the total, in USD
ALTER TABLE orders ADD COLUMN transit_min   INTEGER;
ALTER TABLE orders ADD COLUMN transit_max   INTEGER;
