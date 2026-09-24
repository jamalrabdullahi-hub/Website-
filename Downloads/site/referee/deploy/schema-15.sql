-- Payment inbox: every payment SMS the Garsoore merchant line receives, matched to orders automatically.
--
-- This exists because a payment gateway is a relationship, and relationships take time. EVC Plus sends the
-- merchant a confirmation SMS for every payment whether or not anyone has approved an API account, so a phone
-- sitting in the office forwarding those messages is a payment feed nobody has to grant us.
--
-- The raw text is kept forever and never edited. Parsers break when an operator changes a message format by one
-- word, and when that happens the only way to recover the payments is to re-read what actually arrived.

CREATE TABLE IF NOT EXISTS payment_sms (
  id          TEXT PRIMARY KEY,          -- PS-XXXXXX
  received_at TEXT NOT NULL,             -- when the handset got it
  ingested_at TEXT NOT NULL,             -- when we did
  sender      TEXT,                      -- the SMS sender id, e.g. EVCPlus
  body        TEXT NOT NULL,             -- verbatim, never rewritten
  sms_hash    TEXT NOT NULL,             -- sender + body + received_at, so a forwarder retrying cannot double credit

  -- what the parser made of it. null means it could not tell, which is a state, not a failure to hide
  amount      REAL,
  currency    TEXT NOT NULL DEFAULT 'USD',
  payer       TEXT,                      -- 252XXXXXXXXX
  payer_name  TEXT,
  reference   TEXT,                      -- the operator's transaction id

  -- NEW      parsed, nothing matched yet
  -- MATCHED  credited against an order
  -- REVIEW   a candidate exists but something did not line up, so a person decides
  -- IGNORED  not a payment, or a duplicate, or deliberately set aside
  state       TEXT NOT NULL DEFAULT 'NEW',
  order_id    TEXT,
  matched_at  TEXT,
  matched_by  TEXT,
  note        TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_hash  ON payment_sms(sms_hash);
CREATE INDEX IF NOT EXISTS        idx_sms_state ON payment_sms(state, received_at DESC);
CREATE INDEX IF NOT EXISTS        idx_sms_payer ON payment_sms(payer);
