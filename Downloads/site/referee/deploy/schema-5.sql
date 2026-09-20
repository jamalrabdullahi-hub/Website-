-- Garsoore migration 5: saved profile details, so people type their address and number once.
-- Run once:  npx wrangler d1 execute garsoore-dev-db --remote --file schema-5.sql
ALTER TABLE users ADD COLUMN city TEXT;
ALTER TABLE users ADD COLUMN address TEXT;       -- default delivery address (district + landmark)
ALTER TABLE users ADD COLUMN pay_method TEXT;    -- EVC Plus | ZAAD | Sahal | Premier Wallet
ALTER TABLE users ADD COLUMN pay_phone TEXT;     -- the mobile-money number they pay from
