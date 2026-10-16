-- Player-created games: templates, creators, and quiz content.
--
-- Three additions, all serving one goal — a player-created game should be
-- playable, not a catalogue entry with a "Soon" badge.
--
--   creators     who may create at all (admin-granted)
--   template     which runtime plays the row
--   content      the row's own payload (quiz questions, for now)
--
-- Kept in the `games` table rather than a parallel table so a created game
-- stays one row with one identity. Moderation, ownership and delete already
-- operate on `games.id`, and splitting the payload out would mean every one of
-- those paths had to join across two tables to stay consistent.

-- --- creators -------------------------------------------------------------
--
-- Creation is opt-in per account, granted by an admin. A plain account can
-- sign in, browse, and play, but publishing is closed. This is the abuse
-- ceiling: a game that can be published is a game that has to be reviewed,
-- and review cost is the thing that does not scale.

CREATE TABLE IF NOT EXISTS creators (
  user_id    TEXT PRIMARY KEY,
  user_name  TEXT,
  granted_at INTEGER NOT NULL,
  granted_by TEXT
);

-- --- template + content ---------------------------------------------------
--
-- `template` names the runtime in the registry that plays this row: a quiz
-- resolves to the player-quiz component and reads `content`. Defaulting to
-- 'entry' preserves today's behaviour for anything created before this
-- migration, so no existing row silently becomes playable with no questions.
ALTER TABLE games ADD COLUMN template TEXT NOT NULL DEFAULT 'entry';
ALTER TABLE games ADD COLUMN content TEXT;

-- The moderation queue needs to distinguish a playable game from a
-- placeholder when reviewing, so template is part of the read path.
CREATE INDEX IF NOT EXISTS idx_games_template ON games (template);