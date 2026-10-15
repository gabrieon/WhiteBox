-- Player-game moderation.
--
-- Every created game is born `pending` and stays invisible to everyone but its
-- creator and an admin until a human explicitly approves it. There is no
-- approved-by-default state for new rows, and there is intentionally no machine
-- judgement anywhere in this path: a status changes only through the admin
-- review endpoint.
--
-- Existing rows predate moderation and were already public, so they are
-- grandfathered to `approved`. Backfilling them as pending instead would
-- silently unpublish live catalogue entries on deploy — exactly the data loss a
-- safety migration must not cause.

ALTER TABLE games ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

UPDATE games SET status = 'approved' WHERE status = 'pending';

-- Public listings and the moderation queue both filter by status first, so this
-- is now the hottest access path on the table.
CREATE INDEX IF NOT EXISTS idx_games_status_created ON games (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_status_creator ON games (status, creator_id, created_at DESC);