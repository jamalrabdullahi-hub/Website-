-- Garsoore migration 7: buy-for-me service lines on a quote request.
-- A quote is no longer only "what does this cost" — it carries the services the buyer asked us to perform on the
-- goods before they ship (inspect, test, repack...). Staff see them when pricing; the buyer sees what they bought.
-- Run once:  npx wrangler d1 execute garsoore-dev-db --remote --file schema-7.sql
ALTER TABLE quotes ADD COLUMN services TEXT;      -- JSON array of service keys, e.g. ["test","repack"]
ALTER TABLE quotes ADD COLUMN qty INTEGER;        -- how many units the buyer wants (business buys in multiples)
ALTER TABLE quotes ADD COLUMN service_fee INTEGER;-- what the services came to, in USD, at quote time
