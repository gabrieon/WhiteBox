-- Player-created games.
--
-- These are catalogue entries only: a created game has metadata (title,
-- description, tags, artwork type) but no engine attached yet, so the card
-- renders with a "Soon" badge until the build flow lands. Splitting it this way
-- means creation is useful today without pretending a game is playable when it
-- isn't.
--
-- creator_id is the Supabase user id (the `sub` claim of the verified session
-- token). It is never trusted from the request body — the Worker derives it from
-- the verified token, so a client cannot publish games under someone else's name.

CREATE TABLE IF NOT EXISTS games (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  -- JSON array of tag strings, e.g. ["Puzzle","Party"]. Stored as text because
  -- tags are read and written whole, never queried individually yet.
  categories   TEXT NOT NULL DEFAULT '[]',
  -- Artwork key consumed by GameArt (see src/components/GameArt.jsx).
  type         TEXT NOT NULL,
  -- Solo / 1v1 / Party / Ranked.
  mode         TEXT NOT NULL,
  creator_id   TEXT NOT NULL,
  creator_name TEXT,
  created_at   INTEGER NOT NULL
);

-- Library lists newest first, which is the default sort on the browse screen.
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games (created_at DESC);

-- "My games" on the Create screen reads by creator.
CREATE INDEX IF NOT EXISTS idx_games_creator ON games (creator_id, created_at DESC);
