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
 */
export async function uploadThumb(gameId, blob) {
  const data = await apiFetch(`/v1/games/${encodeURIComponent(gameId)}/thumb`, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
  });
  return Boolean(data?.ok);
}

export async function deleteThumb(gameId) {
  const data = await apiFetch(`/v1/games/${encodeURIComponent(gameId)}/thumb`, {
    method: 'DELETE',
  });
  return Boolean(data?.ok);
}
