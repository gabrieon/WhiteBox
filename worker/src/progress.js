// Saved per-game progress for signed-in users.
//
// Separate keys from sessions on purpose: sessions expire after 30 days, but
// a half-finished run should wait for the player indefinitely. The server
// stores and merges these blobs without interpreting them — game data is
// opaque here; validation is purely structural (shape, size, count).

const PROGRESS_PREFIX = 'progress:';
const MAX_GAMES = 20;
const MAX_ENTRY_BYTES = 4096;
const GAME_ID_RE = /^[a-z0-9-]{1,64}$/;

function progressKey(googleSub) {
  return `${PROGRESS_PREFIX}${googleSub}`;
}

function entryBytes(entry) {
  try {
    return new TextEncoder().encode(JSON.stringify(entry)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isValidEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  if (!Number.isFinite(entry.at)) return false;
  return entryBytes(entry) <= MAX_ENTRY_BYTES;
}

export async function readProgress(env, googleSub) {
  if (!env.SESSIONS) return {};
  const raw = await env.SESSIONS.get(progressKey(googleSub));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (GAME_ID_RE.test(id) && isValidEntry(entry)) clean[id] = entry;
    }
    return clean;
  } catch {
    return {};
  }
}

// Merge client entries into the stored map. `null` deletes an entry
// (used when a run finishes or restarts). Throws on invalid input.
export async function mergeProgress(env, googleSub, incoming) {
  const entries = Object.entries(incoming);
  if (entries.length > MAX_GAMES) throw new Error('too_many_games');
  for (const [id, entry] of entries) {
    if (!GAME_ID_RE.test(id)) throw new Error('bad_game_id');
    if (entry !== null && !isValidEntry(entry)) throw new Error('bad_entry');
  }

  const stored = await readProgress(env, googleSub);
  for (const [id, entry] of entries) {
    if (entry === null) delete stored[id];
    else stored[id] = entry;
  }
  const trimmed = Object.fromEntries(Object.entries(stored).slice(0, MAX_GAMES));

  if (env.SESSIONS) {
    // No TTL: progress persists until overwritten or deleted.
    await env.SESSIONS.put(progressKey(googleSub), JSON.stringify(trimmed));
  }
  return trimmed;
}
