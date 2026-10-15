-- Artwork overrides for BUILT-IN games.
--
-- Built-in games (WordLock and anything added later) are declared in
-- src/games/registry.js and ship their artwork in public/thumbs/. This table
-- lets the owner swap a built-in game's photo at runtime without a rebuild, by
-- pointing at an object in Supabase Storage.
--
-- Deliberately a separate table rather than a column on `games`: `games` holds
-- player-created entries which own their row. Built-in games have no row at all,
-- and inventing one would blur the line between "a game someone made" and "a
-- game that ships with the site".

CREATE TABLE IF NOT EXISTS builtin_thumbs (
  game_id    TEXT PRIMARY KEY,
  thumb_key  TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);