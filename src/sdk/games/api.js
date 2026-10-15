// Client for player-created games (see worker/src/games.js).
//
// Reads go through the same apiFetch as progress, so the Supabase bearer token
// rides along automatically and the origin allow-list is enforced the same way.
// A visitor who isn't signed in can still read the library — creating needs auth.

import { apiFetch } from '../auth/authClient.js';

export async function fetchCreatedGames({ limit = 60 } = {}) {
  const data = await apiFetch(`/v1/games?limit=${encodeURIComponent(limit)}`);
  return Array.isArray(data?.games) ? data.games : [];
}

/**
 * The signed-in player's own submissions in every moderation state. The
 * public catalogue intentionally hides pending and rejected entries, so this
 * separate view is the only way a creator can see what is awaiting review.
 */
export async function fetchMyGames({ limit = 60 } = {}) {
  const data = await apiFetch(`/v1/games?scope=mine&limit=${encodeURIComponent(limit)}`);
  return Array.isArray(data?.games) ? data.games : [];
}

/** One moderation state for the admin queue. Defaults to what needs a human. */
export async function fetchReviewGames({ status = 'pending', limit = 60 } = {}) {
  const data = await apiFetch(
    `/v1/games?scope=review&status=${encodeURIComponent(status)}&limit=${encodeURIComponent(limit)}`,
  );
  return Array.isArray(data?.games) ? data.games : [];
}

/** Human moderation decision. Returns the game in its new state. */
export async function reviewGame(id, decision) {
  const data = await apiFetch(`/v1/games/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
  return data.game;
}

/**
 * Publish a game. Throws on failure with a short reason the Create screen turns
 * into a field-level message.
 */
export async function createGame(draft) {
  const data = await apiFetch('/v1/games', {
    method: 'POST',
    body: JSON.stringify(draft),
  });
  return data.game;
}

export async function deleteGame(id) {
  const data = await apiFetch(`/v1/games/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return Boolean(data?.ok);
}

/**
 * Artwork overrides for built-in games.
 *
 * A built-in game ships a checked-in thumbnail in public/thumbs/, and this
 * returns whatever the owner has replaced it with. Keys are built-in game ids;
 * a missing key means "keep the shipped artwork".
 */
/**
 * Who am I, and am I the owner?
 *
 * The client uses this to hide owner-only controls rather than rendering them
 * for everyone and letting the Worker reject the attempt. Throws 401 when signed
 * out, which callers treat as "not an admin".
 */
export async function fetchMe() {
  return apiFetch('/v1/me');
}

export async function fetchBuiltinThumbs() {
  const data = await apiFetch('/v1/builtin-thumbs');
  return (data && typeof data.thumbs === 'object' && data.thumbs) || {};
}

export async function uploadBuiltinThumb(gameId, blob) {
  const data = await apiFetch(`/v1/builtin/${encodeURIComponent(gameId)}/thumb`, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
  });
  return { url: data?.url || null };
}

export async function deleteBuiltinThumb(gameId) {
  const data = await apiFetch(`/v1/builtin/${encodeURIComponent(gameId)}/thumb`, {
    method: 'DELETE',
  });
  return Boolean(data?.ok);
}

/** Edit an existing game. The thumbnail is left alone — that has its own routes. */
export async function updateGame(id, draft) {
  const data = await apiFetch(`/v1/games/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(draft),
  });
  return data.game;
}

/**
 * URL for a game's uploaded thumbnail, or null when it has none.
 *
 * The Worker returns a ready-made public storage URL on every game, so there is
 * nothing to construct here and no key layout to know about.
 */
export function thumbUrl(game) {
  return game?.thumbUrl || null;
}

/**
 * Upload a compressed thumbnail. The body is raw image bytes, so Content-Type is
 * whatever the blob actually is rather than application/json.
 *
 * Returns the stored object's public URL, so the caller can render the new photo
 * immediately instead of waiting for a refetch that would otherwise leave a
 * freshly-uploaded image blank on the card until the page reloaded.
 */
export async function uploadThumb(gameId, blob) {
  const data = await apiFetch(`/v1/games/${encodeURIComponent(gameId)}/thumb`, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
  });
  return { key: data?.key || null, url: data?.url || null };
}

export async function deleteThumb(gameId) {
  const data = await apiFetch(`/v1/games/${encodeURIComponent(gameId)}/thumb`, {
    method: 'DELETE',
  });
  return Boolean(data?.ok);
}
