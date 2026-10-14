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
