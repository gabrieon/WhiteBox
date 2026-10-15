// Player-created games, stored in the D1 `GAMES` database.
//
// Everything here treats the request body as hostile. The browser sends whatever
// it likes; nothing reaches the database without passing the shape, length and
// vocabulary checks below, and the creator identity is taken from the verified
// session token rather than from the body — otherwise anyone could publish a
// game under someone else's name by editing one field.

const MAX_TITLE = 60;
const MAX_DESCRIPTION = 280;
const MAX_TAGS = 4;
const MAX_TAG_LEN = 24;
const MAX_GAMES_PER_USER = 50;
const MAX_PAGE_SIZE = 100;

// Must match the keys of `artByType` in src/components/GameArt.jsx. A created
// game picks one and gets that composition as its artwork.
const ART_TYPES = [
  'reaction', 'country', 'visual', 'test', 'puzzle', 'language', 'audio',
  'ai', 'map', 'strategy', 'brand', 'drawing', 'flag', 'typing', 'memory',
  'versus', 'word', 'arena', 'arena-online', '2d',
];

const MODES = ['Solo', '1v1', 'Party', 'Ranked'];

// Control characters (C0 range plus DEL) survive a length check and then wreck
// layout: a title containing a newline renders as two lines in the card. Stripped
// before trimming so whitespace-only input collapses to empty.
function stripControlChars(value) {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (code < 32 || code === 127) continue;
    out += ch;
  }
  return out;
}

class ValidationError extends Error {}

import { publicUrl } from './thumbStore.js';

function cleanText(value, { max, field, required }) {
  if (value === undefined || value === null) {
    if (required) throw new ValidationError(`${field}_required`);
    return '';
  }
  if (typeof value !== 'string') throw new ValidationError(`${field}_invalid`);

  const trimmed = stripControlChars(value).trim();
  if (!trimmed) {
    if (required) throw new ValidationError(`${field}_required`);
    return '';
  }
  if (trimmed.length > max) throw new ValidationError(`${field}_too_long`);
  return trimmed;
}

// Tags are lower-cased and de-duplicated so the category chips don't show
// "Puzzle" and "puzzle" as two different filters.
function cleanCategories(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError('categories_invalid');
  if (value.length > MAX_TAGS) throw new ValidationError('too_many_categories');

  const out = [];
  for (const entry of value) {
    const tag = cleanText(entry, { max: MAX_TAG_LEN, field: 'category' });
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (!out.some((t) => t.toLowerCase() === key)) out.push(tag);
  }
  return out;
}

function cleanEnum(value, allowed, field) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new ValidationError(`${field}_invalid`);
  }
  return value;
}

/**
 * Validate and normalise a create request.
 * @returns {{title:string, description:string, categories:string[], type:string, mode:string}}
 * @throws {ValidationError} with a short machine-readable reason.
 */
export function parseCreateGame(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('bad_request');
  }

  const title = cleanText(body.title, { max: MAX_TITLE, field: 'title', required: true });
  // Required, but a short description is allowed — an empty one just reads as a
  // blank card, which is better than rejecting the whole submission.
  const description = cleanText(body.description, { max: MAX_DESCRIPTION, field: 'description', required: true });

  return {
    title,
    description,
    categories: cleanCategories(body.categories),
    type: cleanEnum(body.type, ART_TYPES, 'type'),
    mode: cleanEnum(body.mode, MODES, 'mode'),
  };
}

function rowToGame(row, env) {
  let categories = [];
  try {
    const parsed = JSON.parse(row.categories);
    if (Array.isArray(parsed)) categories = parsed.filter((c) => typeof c === 'string');
  } catch {
    // A row whose tags are unreadable should still render — fall back to none.
  }

  // The bucket is public, so the browser can load the image straight from
  // storage. Proxying through the Worker would only add a hop and spend
  // request quota transferring bytes Cloudflare could serve for free.
  const thumbKeyValue = row.thumb_key || null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categories,
    type: row.type,
    mode: row.mode,
    creatorId: row.creator_id,
    creatorName: row.creator_name || null,
    createdAt: row.created_at,
    // Set when the player uploaded a photo instead of taking the generated SVG
    // artwork. Null means "use GameArt", which is the default.
    thumbKey: thumbKeyValue,
    thumbUrl: thumbKeyValue ? publicUrl(env, thumbKeyValue) : null,
    // A created game has metadata but no engine attached yet. Marking it
    // unplayable is what puts the "Soon" badge on the card, so the library
    // never implies you can launch something that has no code.
    playable: false,
    origin: 'user',
  };
}

/** Newest first. `limit` is capped server-side regardless of what is asked for. */
export async function listGames(env, { limit = 60, creatorId = null } = {}) {
  if (!env.GAMES) return [];

  const size = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(limit) || 60));

  const result = creatorId
    ? await env.GAMES.prepare(
      'SELECT * FROM games WHERE creator_id = ? ORDER BY created_at DESC LIMIT ?',
    ).bind(creatorId, size).all()
    : await env.GAMES.prepare(
      'SELECT * FROM games ORDER BY created_at DESC LIMIT ?',
    ).bind(size).all();

  return (result.results || []).map((row) => rowToGame(row, env));
}

/**
 * Insert a game on behalf of an already-authenticated creator.
 * `creatorId`/`creatorName` come from the verified token, never the body.
 */
export async function createGame(env, draft, creatorId, creatorName) {
  if (!env.GAMES) throw new ValidationError('storage_not_configured');

  // Per-user cap. Checked before insert rather than relying on a unique index
  // because this is a soft product limit, not an integrity constraint.
  const existing = await env.GAMES.prepare(
    'SELECT COUNT(*) AS n FROM games WHERE creator_id = ?',
  ).bind(creatorId).first();

  if ((existing?.n ?? 0) >= MAX_GAMES_PER_USER) {
    throw new ValidationError('game_limit_reached');
  }

  const id = crypto.randomUUID();
  const createdAt = Date.now();

  await env.GAMES.prepare(
    `INSERT INTO games (id, title, description, categories, type, mode, creator_id, creator_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    draft.title,
    draft.description,
    JSON.stringify(draft.categories),
    draft.type,
    draft.mode,
    creatorId,
    creatorName || null,
    createdAt,
  ).run();

  return rowToGame({
    id,
    title: draft.title,
    description: draft.description,
    categories: JSON.stringify(draft.categories),
    type: draft.type,
    mode: draft.mode,
    creator_id: creatorId,
    creator_name: creatorName || null,
    created_at: createdAt,
    thumb_key: null,
  }, env);
}

/**
 * Update a game the caller owns. Returns the updated row, or null when the game
 * doesn't exist or belongs to someone else — the two are deliberately
 * indistinguishable so this endpoint can't be used to probe for ids.
 */
export async function updateGame(env, id, draft, creatorId) {
  if (!env.GAMES) throw new ValidationError('storage_not_configured');

  const result = await env.GAMES.prepare(
    `UPDATE games
        SET title = ?, description = ?, categories = ?, type = ?, mode = ?
      WHERE id = ? AND creator_id = ?`,
  ).bind(
    draft.title,
    draft.description,
    JSON.stringify(draft.categories),
    draft.type,
    draft.mode,
    id,
    creatorId,
  ).run();

  if ((result.meta?.changes ?? 0) === 0) return null;

  const row = await env.GAMES.prepare('SELECT * FROM games WHERE id = ?').bind(id).first();
  return rowToGame(row, env);
}

/** True when this creator owns the game. Read-only: never mutates as a side effect. */
export async function ownsGame(env, id, creatorId) {
  if (!env.GAMES) return false;
  const row = await env.GAMES.prepare(
    'SELECT 1 AS ok FROM games WHERE id = ? AND creator_id = ?',
  ).bind(id, creatorId).first();
  return Boolean(row);
}

/**
 * Attach an uploaded thumbnail to a game the caller owns.
 *
 * Ownership is enforced in the UPDATE itself, so this returns false both when the
 * game doesn't exist and when it belongs to someone else — the two cases are
 * deliberately indistinguishable to the caller.
 */
export async function setThumb(env, gameId, key, creatorId) {
  if (!env.GAMES) throw new ValidationError('storage_not_configured');
  const result = await env.GAMES.prepare(
    'UPDATE games SET thumb_key = ? WHERE id = ? AND creator_id = ?',
  ).bind(key, gameId, creatorId).run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function getThumbKey(env, gameId) {
  if (!env.GAMES) return null;
  const row = await env.GAMES.prepare(
    'SELECT thumb_key FROM games WHERE id = ?',
  ).bind(gameId).first();
  return row?.thumb_key || null;
}

export async function deleteGame(env, id, creatorId) {
  if (!env.GAMES) return { removed: false, thumbKey: null };

  // Read the key before deleting: afterwards the row is gone and there is no way
  // to know which object in the bucket is now orphaned.
  const row = await env.GAMES.prepare(
    'SELECT thumb_key FROM games WHERE id = ? AND creator_id = ?',
  ).bind(id, creatorId).first();

  // creator_id in the WHERE clause is the authorization check: a player can only
  // ever delete their own game, regardless of what id they send.
  const result = await env.GAMES.prepare(
    'DELETE FROM games WHERE id = ? AND creator_id = ?',
  ).bind(id, creatorId).run();

  return {
    removed: (result.meta?.changes ?? 0) > 0,
    thumbKey: row?.thumb_key || null,
  };
}
