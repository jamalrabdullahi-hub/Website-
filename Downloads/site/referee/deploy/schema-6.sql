-- Garsoore migration 6: notifications.
-- People should not have to open the site to learn that their payment cleared or their goods are ready.
-- Run once:  npx wrangler d1 execute garsoore-dev-db --remote --file schema-6.sql
CREATE TABLE IF NOT EXISTS notifications (
  id       TEXT PRIMARY KEY,
  user_id  TEXT NOT NULL,
  at       TEXT NOT NULL,
  kind     TEXT NOT NULL,      -- order | quote | mandate | fbg | money
  title    TEXT NOT NULL,
  body     TEXT,
  href     TEXT,               -- where to go when tapped
  read_at  TEXT
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, at);
