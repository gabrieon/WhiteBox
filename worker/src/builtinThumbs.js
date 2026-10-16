// Artwork overrides for built-in games.
//
// A built-in game is declared in src/games/registry.js and ships a checked-in
// thumbnail in public/thumbs/. Changing that normally means editing the repo and
// redeploying. These overrides let the owner swap the photo at runtime.
//
// Separate from player-created games on purpose. Those own a row in `games`;
// built-ins have no row, and minting one would conflate "a game a person made"
// with "a game that ships with the site" across moderation, ownership and deletes.

import { publicUrl, putThumb, deleteThumb } from './thumbStore.js';
import { readUpload } from './thumbs.js';

const BUILTIN_PREFIX = 'builtin';

// Only these ids may change built-in artwork. Configured as a Worker var rather
// than hardcoded so a new owner is a config change, not a code change.
function isAdmin(env, userId) {
  // A missing caller can never be an admin, and returning true for it would let
  // an unauthenticated request through every `!isAdmin(...)` guard in the app.
  if (!userId || typeof userId !== 'string') return false;
  const raw = env.ADMIN_USER_IDS || '';
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return false;
  return ids.includes(userId);
}

/** Public map of game id -> thumbnail URL. Safe to read unauthenticated. */
export async function listBuiltinThumbs(env) {
  if (!env.GAMES) return {};
  const result = await env.GAMES.prepare('SELECT game_id, thumb_key FROM builtin_thumbs').all();
  const out = {};
  for (const row of result.results || []) {
    const url = publicUrl(env, row.thumb_key);
    if (url) out[row.game_id] = url;
  }
  return out;
}

function builtinKey(gameId) {
  return `${BUILTIN_PREFIX}/${gameId}/thumb`;
}

/**
 * Replace a built-in game's artwork.
 * @returns {{url: string}} on success, or throws with a reason.
 */
export async function setBuiltinThumb(env, gameId, userId, request) {
  // The reason names the problem. A bare `not_allowed` is indistinguishable from
  // "you are not the owner" and from "no admins are configured", which is how a
  // misconfigured ADMIN_USER_IDS list presents as an unexplained failure.
  if (!isAdmin(env, userId && userId.id)) throw new Error('not_admin');
  if (!env.GAMES) throw new Error('storage_not_configured');

  // readUpload already throws short, machine-readable reasons
  // (image_too_large, image_not_an_image, image_empty) that the route surfaces
  // verbatim — no need to wrap or reword them.
  const upload = await readUpload(request);

  const key = builtinKey(gameId);
  const stored = await putThumb(env, key, upload.bytes, upload.contentType, userId.token);

  await env.GAMES.prepare(
    `INSERT INTO builtin_thumbs (game_id, thumb_key, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (game_id) DO UPDATE SET thumb_key = excluded.thumb_key,
                                           updated_at = excluded.updated_at`,
  ).bind(gameId, key, Date.now()).run();

  return stored;
}

/** Restore the shipped artwork by dropping the override. */
export async function clearBuiltinThumb(env, gameId, userId) {
  if (!isAdmin(env, userId && userId.id)) throw new Error('not_admin');
  if (!env.GAMES) return false;

  const row = await env.GAMES.prepare(
    'SELECT thumb_key FROM builtin_thumbs WHERE game_id = ?',
  ).bind(gameId).first();

  const result = await env.GAMES.prepare(
    'DELETE FROM builtin_thumbs WHERE game_id = ?',
  ).bind(gameId).run();

  if (row?.thumb_key) {
    // Best-effort: the override is already gone, so a storage failure leaves an
    // orphaned object rather than a built-in game pointing at a broken image.
    try {
      await deleteThumb(env, row.thumb_key, userId.token);
    } catch (err) {
      console.error('[whitebox-mp] builtin thumb cleanup failed', row.thumb_key, err?.message);
    }
  }

  return (result.meta?.changes ?? 0) > 0;
}

export { isAdmin };