-- Gacan ka Gacan: people selling to each other. Garsoore takes nothing.
--
-- This is deliberately NOT the order engine. No escrow, no procurement, no manifest, no money through Garsoore
-- at all: a seller posts, a buyer calls, they meet. It exists so the site is worth opening on a day nobody is
-- importing, and so a person who came to sell a phone sees the China catalogue on the way past.
--
-- Because no money moves, the only real risks are the listings themselves: a scam, an illegal item, or a number
-- that belongs to somebody who never posted. Hence a report path and a hard cap per account.

CREATE TABLE IF NOT EXISTS h2h_listings (
  id          TEXT PRIMARY KEY,           -- HH-XXXXXX
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  descr       TEXT,
  price       REAL,                       -- null = "waa la heshiin karaa" (negotiable)
  currency    TEXT NOT NULL DEFAULT 'USD',
  cat         TEXT NOT NULL,              -- PHN | HOM | VEH | CLO | FRN | ELC | OTHER
  condition   TEXT NOT NULL DEFAULT 'used',   -- new | used | parts
  city        TEXT NOT NULL DEFAULT 'Muqdisho',
  district    TEXT,
  phone       TEXT NOT NULL,              -- the seller's contact, shown to signed-in viewers only
  images      TEXT NOT NULL DEFAULT '[]',
  state       TEXT NOT NULL DEFAULT 'LIVE',   -- LIVE | SOLD | HIDDEN | REMOVED
  views       INTEGER NOT NULL DEFAULT 0,
  reports     INTEGER NOT NULL DEFAULT 0,
  bumped_at   TEXT NOT NULL,              -- ordering key; a free market still needs a "recent" that means something
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_h2h_live ON h2h_listings(state, bumped_at DESC);
CREATE INDEX IF NOT EXISTS idx_h2h_user ON h2h_listings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_h2h_cat  ON h2h_listings(cat, state, bumped_at DESC);

CREATE TABLE IF NOT EXISTS h2h_reports (
  id         TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  user_id    TEXT,
  reason     TEXT,
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_h2h_rep ON h2h_reports(listing_id);
