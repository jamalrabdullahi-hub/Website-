-- Garsoore migration 9: PIN recovery.
--
-- The account is a phone number and a PIN. There is no email, so there is no "reset link" — and until now there was
-- no way back in at all: /auth/pin needs the OLD pin, and an admin could change a person's role but not their PIN.
-- The first customer to forget theirs was permanently locked out of their orders and their escrow, and nobody could
-- help them. That is what this fixes.
--
-- How it works: the customer asks for a reset, a human calls the number on file and satisfies themselves it is really
-- them, then issues a one-time PIN. It is shown to staff exactly once, it forces a change at next sign-in, and every
-- session is killed so a stolen one is worthless. Every issue is written to admin_log with the name of whoever did it.
--
-- Run once:  npx wrangler d1 execute garsoore-dev-db --remote --file schema-9.sql
CREATE TABLE IF NOT EXISTS pin_resets (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,                 -- null when the phone has no account (we still record the attempt, quietly)
  phone       TEXT NOT NULL,
  at          TEXT NOT NULL,
  state       TEXT NOT NULL,        -- open | issued | rejected
  handled_by  TEXT,
  handled_name TEXT,
  handled_at  TEXT,
  note        TEXT
);
CREATE INDEX IF NOT EXISTS pin_resets_state ON pin_resets(state, at);
