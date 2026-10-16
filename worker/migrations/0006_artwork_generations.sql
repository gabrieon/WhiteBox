-- AI-generated artwork: quota accounting.
--
-- One row per image the Worker actually requested from Gemini. The table is an
-- accounting ledger, not a content store — the generated image itself is never
-- written here, it goes to Supabase Storage through the player's own token.
--
-- Why D1 and not KV, when the burst limiter already uses KV: KV is eventually
-- consistent, so two requests in the same instant both read a stale counter and
-- both pass. For a burst limiter that is acceptable. For a daily allowance drawn
-- against a shared per-project API quota it is not — the whole point of the cap
-- is that it cannot be raced past, and "eventually consistent" means it can.
-- D1 gives a strongly consistent read-then-insert with no window.
--
-- The index exists because every quota check is "count rows for this user since
-- <boundary>", which is a range scan on user_id alone.

CREATE TABLE IF NOT EXISTS artwork_generations (
  id          TEXT PRIMARY KEY,
  -- Supabase user id of the person who ran the generation. This is who spent
  -- the quota, regardless of which game the image was for.
  user_id     TEXT NOT NULL,
  -- The game the artwork was generated for. Not enforced as a foreign key
  -- because a deleted game should not refund the quota that was already spent.
  game_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artwork_user_time
  ON artwork_generations (user_id, created_at);

-- Admin reporting: what the shared per-project quota is being spent on.
CREATE INDEX IF NOT EXISTS idx_artwork_time
  ON artwork_generations (created_at);