// WhiteBox Game SDK — saved-progress sync.
//
// Two layers, deliberately split:
//   * localStorage is the synchronous source of truth games read at mount.
//     It works for guests and signed-in players alike, with zero latency.
//   * the Worker (`/v1/me/progress`) is the backup + cross-device transport.
//     It is only touched when the player is signed in.
//
// Games never know about accounts: they call ctx.saveProgress(data) during
// play and ctx.loadProgress() on mount. Flushing to the server happens in
// GameStage (on exit) and merging from the server happens in App (on sign-in).

import { apiFetch, isConfigured } from './authClient.js';

const KEY_PREFIX = 'whitebox:progress:';

function keyFor(gameId) {
  return `${KEY_PREFIX}${gameId}`;
}

function validEntry(entry) {
  return Boolean(entry)
    && typeof entry === 'object'
    && !Array.isArray(entry)
    && Number.isFinite(entry.at);
}

// --- local layer (synchronous, always available) -----------------------------

export function readLocalProgress(gameId) {
  try {
    const raw = window.localStorage.getItem(keyFor(gameId));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    return validEntry(entry) ? entry : null;
  } catch {
    return null;
  }
}

export function writeLocalProgress(gameId, data) {
  const entry = { data, at: Date.now() };
  try {
    window.localStorage.setItem(keyFor(gameId), JSON.stringify(entry));
  } catch {
    // Private mode etc. — the run simply will not resume.
  }
  return entry;
}

export function clearLocalProgress(gameId) {
  try {
    window.localStorage.removeItem(keyFor(gameId));
  } catch {
    // Already gone or unavailable; nothing to do.
  }
}

// Every locally saved run: { [gameId]: { data, at } }. Used to build the
// Continue Playing row without any network round-trip.
export function listLocalProgress() {
  const out = {};
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      const gameId = key.slice(KEY_PREFIX.length);
      try {
        const entry = JSON.parse(window.localStorage.getItem(key));
        if (validEntry(entry)) out[gameId] = entry;
      } catch {
        // Skip corrupt entries.
      }
    }
  } catch {
    return {};
  }
  return out;
}

// --- server layer (async, signed-in players only) -----------------------------

export async function fetchServerProgress() {
  if (!isConfigured()) return null;
  const data = await apiFetch('/v1/me/progress');
  const progress = data && typeof data === 'object' ? data.progress : null;
  return progress && typeof progress === 'object' ? progress : {};
}

// Push one game's local entry (or null to delete the server copy, e.g. when
// a run finishes or restarts). Resolves quietly; callers must not let a sync
// failure break gameplay.
export async function pushProgress(gameId) {
  if (!isConfigured()) return;
  const entry = readLocalProgress(gameId);
  await apiFetch('/v1/me/progress', {
    method: 'PUT',
    body: JSON.stringify({ progress: { [gameId]: entry } }),
  });
}

// Pull the server map into localStorage, keeping whichever copy is newer per
// game. Runs once per sign-in so a returning player resumes everywhere.
export async function pullProgress() {
  if (!isConfigured()) return {};
  const remote = await fetchServerProgress();
  if (!remote) return listLocalProgress();
  const merged = listLocalProgress();
  for (const [gameId, entry] of Object.entries(remote)) {
    if (!validEntry(entry)) continue;
    const local = merged[gameId];
    if (!local || entry.at > local.at) {
      merged[gameId] = entry;
      try {
        window.localStorage.setItem(keyFor(gameId), JSON.stringify(entry));
      } catch {
        // Storage full/blocked; local copy stays stale, game still playable.
      }
    }
  }
  return merged;
}
