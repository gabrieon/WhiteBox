-- Uploaded thumbnail support for player-created games.
--
-- Stored as a key, not bytes: the image itself lives in R2 (whitebox-thumbs),
-- and this column just points at it. Keeping the bucket separate means the
-- games table stays cheap to query — listing the library never pulls image data.
--
-- thumb_key is NULL when a game uses its generated SVG artwork instead, which
-- is the default and costs nothing to serve.

ALTER TABLE games ADD COLUMN thumb_key TEXT;

-- Serving an image should never depend on a table scan; the key is unique per
-- game and the bucket lookup is a single GET.
CREATE INDEX IF NOT EXISTS idx_games_thumb ON games (thumb_key);
