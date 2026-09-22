-- Treasury: the money leg Garsoore actually runs.
--
-- Somalia has no Visa/Mastercard/PayPal, so customers pay by USSD mobile money (EVC, ZAAD, Sahal,
-- Premier) into a Garsoore merchant wallet, in USD. Chinese suppliers are paid in CNY from a China
-- float that has to be topped up by remittance — hawala, a bank transfer, or a counterpart's account.
-- Those two pools are different currencies, days apart, and neither is the other.
--
-- Two accounts, one signed ledger each:
--   SO_USD  what has been collected in Mogadishu and not yet sent, refunded or spent
--   CN_CNY  what is sitting in China ready to buy with — the float that decides whether an order
--           can be bought instantly or has to wait for the next remittance
--
-- Balances are always SUM(amount) over the account. Nothing stores a balance, because a stored
-- balance is a number that can disagree with its own history.

CREATE TABLE IF NOT EXISTS treasury (
  id      TEXT PRIMARY KEY,           -- TR-XXXXXX
  at      TEXT NOT NULL,
  account TEXT NOT NULL,              -- SO_USD | CN_CNY
  kind    TEXT NOT NULL,              -- collection | remit_out | remit_in | purchase | refund | fee | adjust
  amount  REAL NOT NULL,              -- SIGNED, in the account's own currency
  ref     TEXT,                       -- order id, PO id or remittance id
  note    TEXT,
  by      TEXT
);
CREATE INDEX IF NOT EXISTS idx_treasury_acct ON treasury(account, at DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_ref  ON treasury(ref);

-- One transfer of money from Somalia to China. fx is what we ACTUALLY got, after every fee, which
-- is the only rate that matters: the catalogue prices goods at a fixed FX, and the gap between that
-- assumption and this number is margin leaving the business without anyone deciding it should.
CREATE TABLE IF NOT EXISTS remittances (
  id           TEXT PRIMARY KEY,      -- RM-XXXXXX
  usd_sent     REAL NOT NULL,         -- leaves the Somali pool
  fee_usd      REAL NOT NULL DEFAULT 0,
  fx           REAL,                  -- CNY per USD actually received (net of fees)
  cny_received REAL,                  -- lands in the China pool; null until it lands
  channel      TEXT,                  -- hawala | bank | agent | cash
  reference    TEXT,                  -- the transfer reference from the hawala or bank
  state        TEXT NOT NULL DEFAULT 'SENT',   -- SENT | LANDED | FAILED
  note         TEXT,
  by           TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_remit_state ON remittances(state, created_at DESC);
