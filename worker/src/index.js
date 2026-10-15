// WhiteBox multiplayer Worker — HTTP entry point.
//
// Routes:
//   GET  /health        -> liveness probe
//   POST /rooms         -> mint a fresh room code (JSON { room })
//   GET  /room/:code    -> upgrade to WebSocket, routed to the GameRoom DO
//   POST /auth/google   -> exchange a Google ID token for a session cookie
//   GET  /auth/session  -> current profile or { profile: null }
//   POST /auth/logout   -> destroy the session
//   GET  /v1/me/progress      -> saved per-game progress for the signed-in user
//   PUT  /v1/me/progress      -> merge per-game progress ({ id: data|null })
//   GET  /v1/games            -> published games (public read)
//   POST /v1/games            -> publish a game as the signed-in player
//   PUT  /v1/games/:id        -> edit one of your own games
//   DELETE /v1/games/:id      -> remove one of your own games
//
// The Durable Object id is derived deterministically from the room code via
// idFromName (Cloudflare hashes the name into a namespace-valid id), so any
// client that knows the code reaches the same room. This config is isolated and
// does NOT touch any existing production deployment.

import { isRoomCode, generateRoomCode } from '../../shared/mp-protocol.js';
import { GameRoom } from './GameRoom.js';
import { verifyGoogleIdToken } from './google.js';
import { readProgress, mergeProgress } from './progress.js';
import { verifySupabaseToken, bearerToken } from './supabaseAuth.js';
import {
  parseCreateGame, listGames, createGame, updateGame, deleteGame,
  setThumb, getThumbKey, ownsGame,
} from './games.js';
import {
  readUpload, putThumb, getThumb, deleteThumb, thumbKey,
} from './thumbs.js';

/**
 * Resolve the caller's identity from whichever auth mode is live: a Supabase
 * session token (`Authorization: Bearer …`) or the legacy cookie session.
 * Returns null when neither verifies.
 */
async function resolveUser(env, request) {
  const token = bearerToken(request);
  if (token) {
    try {
      const { userId, name } = await verifySupabaseToken(token, env);
      return { id: userId, name: name || null };
    } catch {
      return null;
    }
  }
  const found = await readSession(env, request);
  return found
    ? { id: found.record.googleSub, name: found.record.name || found.record.email || null }
    : null;
}

/** Identity only — enough for progress, which is keyed by user alone. */
async function resolveUserId(env, request) {
  const user = await resolveUser(env, request);
  return user ? user.id : null;
}

import {
  createSession,
  readSession,
  destroySession,
  sessionCookieHeader,
  clearedSessionCookieHeader,
  publicProfile,
  refreshSessionIfStale,
} from './session.js';

// The DO class must be exported from the Worker's main module.
export { GameRoom };

// Gameplay endpoints stay open (rooms are unguessable codes and carry no
// personal data). Auth endpoints are different: they set cookies, and the
// browser refuses to send credentials when the response says
// Access-Control-Allow-Origin: *. So auth responses echo a specific allowed
// origin and opt into credentials.
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

// `Authorization` must be listed here, not just Content-Type. Supabase sends the
// session token as a bearer header, which makes every authenticated call a
// "non-simple" request: the browser preflights it and rejects the whole call if
// the preflight response doesn't echo the header back. Leaving it out looked
// fine because simple GETs skip preflight entirely — writes just silently failed
// in the browser with no useful error.
const BASE_CORS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function allowedOrigins(env) {
  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured])];
}

// Returns CORS headers for a credentialed auth response, or null when the
// request origin is not allowed (in which case the caller must reject).
function authCors(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null; // same-origin / non-browser client
  if (!allowedOrigins(env).includes(origin)) return null;
  return {
    ...BASE_CORS,
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function corsFor(request, env) {
  const auth = authCors(request, env);
  if (auth) return auth;
  return { ...BASE_CORS, 'Access-Control-Allow-Origin': '*' };
}

function json(obj, status = 200, cors = BASE_CORS, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors, ...extraHeaders },
  });
}

async function readJsonBody(request) {
  try {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// The request body lives in its own function so the exported worker can wrap it
// in a single error boundary. Without that, any thrown error escapes as a bare
// 500 with no log line and no body, which makes production faults undiagnosable.
export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      // Log the real cause for the console; return a generic reason so internal
      // details (schema, bindings, stack) never reach the client.
      console.error('[whitebox-mp] unhandled error', err?.stack || err);
      return new Response(JSON.stringify({ error: 'internal_error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

async function handleRequest(request, env) {
    const url = new URL(request.url);
    const cors = corsFor(request, env);
    const authCorsHeaders = authCors(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'whitebox-mp' });
    }

    // ---- auth ------------------------------------------------------------

    // POST /auth/google { idToken }
    // Verifies the Google credential server-side, then exchanges it for an
    // opaque HttpOnly session cookie. The token is never persisted.
    if (url.pathname === '/auth/google' && request.method === 'POST') {
      if (!authCorsHeaders) {
        return json({ error: 'origin_not_allowed' }, 403, cors);
      }
      if (!env.GOOGLE_CLIENT_ID) {
        return json({ error: 'auth_not_configured' }, 503, authCorsHeaders);
      }
      const body = await readJsonBody(request);
      if (!body) return json({ error: 'bad_request' }, 400, authCorsHeaders);

      try {
        const profile = await verifyGoogleIdToken(body.idToken, {
          clientId: env.GOOGLE_CLIENT_ID,
        });
        const { id, record } = await createSession(env, profile);
        return json(
          { profile: publicProfile(record) },
          200,
          authCorsHeaders,
          { 'Set-Cookie': sessionCookieHeader(id) },
        );
      } catch (err) {
        const code = err?.message || 'invalid_token';
        return json({ error: code }, 401, authCorsHeaders);
      }
    }

    // GET /auth/session -> current profile or { profile: null }
    if (url.pathname === '/auth/session' && request.method === 'GET') {
      if (!authCorsHeaders) {
        return json({ error: 'origin_not_allowed' }, 403, cors);
      }
      const found = await readSession(env, request);
      // Renew an active session in place so an idle week never signs anyone out.
      const renewed = await refreshSessionIfStale(env, found);
      return json(
        { profile: found ? publicProfile(found.record) : null },
        200,
        authCorsHeaders,
        renewed ? { 'Set-Cookie': renewed } : {},
      );
    }

    // POST /auth/logout
    if (url.pathname === '/auth/logout' && request.method === 'POST') {
      if (!authCorsHeaders) {
        return json({ error: 'origin_not_allowed' }, 403, cors);
      }
      await destroySession(env, request);
      return json({ ok: true }, 200, authCorsHeaders, {
        'Set-Cookie': clearedSessionCookieHeader(),
      });
    }

    // ---- saved progress ----------------------------------------------------
    // Per-game mid-run snapshots for signed-in users. Stored under a separate
    // key from sessions (which expire); progress persists until overwritten or
    // deleted. The server merges but never interprets game data.

    // GET /v1/me/progress -> { progress: { [gameId]: { data, at } } }
    if (url.pathname === '/v1/me/progress' && request.method === 'GET') {
      if (!authCorsHeaders) {
        return json({ error: 'origin_not_allowed' }, 403, cors);
      }
      const userId = await resolveUserId(env, request);
      if (!userId) return json({ error: 'unauthorized' }, 401, authCorsHeaders);
      const progress = await readProgress(env, userId);
      return json({ progress }, 200, authCorsHeaders);
    }

    // PUT /v1/me/progress { progress: { [gameId]: data|null } }
    // Merges into the stored map; null deletes an entry (finished runs).
    if (url.pathname === '/v1/me/progress' && request.method === 'PUT') {
      if (!authCorsHeaders) {
        return json({ error: 'origin_not_allowed' }, 403, cors);
      }
      const userId = await resolveUserId(env, request);
      if (!userId) return json({ error: 'unauthorized' }, 401, authCorsHeaders);
      const body = await readJsonBody(request);
      const incoming = body && typeof body === 'object' ? body.progress : undefined;
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        return json({ error: 'bad_request' }, 400, authCorsHeaders);
      }
      try {
        const progress = await mergeProgress(env, userId, incoming);
        return json({ progress }, 200, authCorsHeaders);
      } catch (err) {
        return json({ error: err?.message || 'invalid_progress' }, 400, authCorsHeaders);
      }
    }

    // ---- created games ----------------------------------------------------
    // GET /v1/games -> { games: [...] }
    // Public read: the library shows every published game to every visitor, so
    // this deliberately does NOT require a session. Browsing is not privileged.
    if (url.pathname === '/v1/games' && request.method === 'GET') {
      if (!authCorsHeaders) {
        return json({ error: 'origin_not_allowed' }, 403, cors);
      }
      const limit = url.searchParams.get('limit');
      const games = await listGames(env, { limit: limit ? Number(limit) : 60 });
      return json({ games }, 200, authCorsHeaders);
    }

    // POST /v1/games { title, description, categories, type, mode }
    // Creates a catalogue entry owned by the caller. The creator is taken from
    // the verified token, so a forged body cannot misattribute authorship.
    if (url.pathname === '/v1/games' && request.method === 'POST') {
      if (!authCorsHeaders) {
        return json({ error: 'origin_not_allowed' }, 403, cors);
      }
      const user = await resolveUser(env, request);
      if (!user) return json({ error: 'unauthorized' }, 401, authCorsHeaders);

      const body = await readJsonBody(request);
      let draft;
      try {
        draft = parseCreateGame(body);
      } catch (err) {
        return json({ error: err?.message || 'bad_request' }, 400, authCorsHeaders);
      }

      try {
        const game = await createGame(env, draft, user.id, user.name);
        return json({ game }, 201, authCorsHeaders);
      } catch (err) {
        return json({ error: err?.message || 'create_failed' }, 400, authCorsHeaders);
      }
    }

    // PUT /v1/games/:id — edit one of your own games.
    // The thumbnail is not touched here: replacing or clearing it has its own
    // routes, so a plain metadata edit can't silently discard a photo.
    const updateMatch = url.pathname.match(/^\/v1\/games\/([A-Za-z0-9-]{1,64})$/);
    if (updateMatch && request.method === 'PUT') {
      if (!authCorsHeaders) {
        return json({ error: 'origin_not_allowed' }, 403, cors);
      }
      const user = await resolveUser(env, request);
      if (!user) return json({ error: 'unauthorized' }, 401, authCorsHeaders);

      const body = await readJsonBody(request);
      let draft;
      try {
        draft = parseCreateGame(body);
      } catch (err) {
        return json({ error: err?.message || 'bad_request' }, 400, authCorsHeaders);
      }

      try {
        const updated = await updateGame(env, updateMatch[1], draft, user.id);
        if (!updated) return json({ error: 'not_found' }, 404, authCorsHeaders);
        return json({ game: updated }, 200, authCorsHeaders);
      } catch (err) {
        return json({ error: err?.message || 'update_failed' }, 400, authCorsHeaders);
      }
    }

    // DELETE /v1/games/:id
    // Ownership is enforced in the query itself, so a player can only ever
    // remove their own game whatever id they send.
    const deleteMatch = url.pathname.match(/^\/v1\/games\/([A-Za-z0-9-]{1,64})$/);
    if (deleteMatch && request.method === 'DELETE') {
      if (!authCorsHeaders) {
        return json({ error: 'origin_not_allowed' }, 403, cors);
      }
      const user = await resolveUser(env, request);
      if (!user) return json({ error: 'unauthorized' }, 401, authCorsHeaders);
      const outcome = await deleteGame(env, deleteMatch[1], user.id);
      if (!outcome.removed) return json({ error: 'not_found' }, 404, authCorsHeaders);
      // Drop the image too, or deleting a game leaks an object in the bucket
      // forever with nothing pointing at it.
      if (outcome.thumbKey) await deleteThumb(env, outcome.thumbKey);
      return json({ ok: true }, 200, authCorsHeaders);
    }

    // PUT /v1/games/:id/thumb  (raw image bytes as the body)
    // The browser compresses to JPEG before sending, so this receives a small
    // file rather than a raw camera photo. Content-Length is checked before the
    // body is read so an oversized upload is refused rather than buffered.
    const thumbMatch = url.pathname.match(/^\/v1\/games\/([A-Za-z0-9-]{1,64})\/thumb$/);
    if (thumbMatch && request.method === 'PUT') {
      if (!authCorsHeaders) {
        return json({ error: 'origin_not_allowed' }, 403, cors);
      }
      const user = await resolveUser(env, request);
      if (!user) return json({ error: 'unauthorized' }, 401, authCorsHeaders);

      const id = thumbMatch[1];
      // Prove ownership before spending bandwidth on the image, not after.
      // This must be a read: probing with a real UPDATE would clear thumb_key
      // first, so a rejected or oversized upload would leave the game pointing
      // at an orphaned object with no thumbnail reference at all.
      if (!(await ownsGame(env, id, user.id))) {
        return json({ error: 'not_found' }, 404, authCorsHeaders);
      }

      let upload;
      try {
        upload = await readUpload(request);
      } catch (err) {
        return json({ error: err?.message || 'image_invalid' }, 400, authCorsHeaders);
      }

      const key = thumbKey(id);
      try {
        await putThumb(env, key, upload.bytes, upload.contentType);
      } catch (err) {
        return json({ error: err?.message || 'storage_not_configured' }, 503, authCorsHeaders);
      }
      await setThumb(env, id, key, user.id);

      return json({ ok: true, key, bytes: upload.bytes.byteLength }, 200, authCorsHeaders);
    }

    // DELETE /v1/games/:id/thumb — go back to the generated artwork.
    if (thumbMatch && request.method === 'DELETE') {
      if (!authCorsHeaders) {
        return json({ error: 'origin_not_allowed' }, 403, cors);
      }
      const user = await resolveUser(env, request);
      if (!user) return json({ error: 'unauthorized' }, 401, authCorsHeaders);
      const id = thumbMatch[1];
      const owned = await setThumb(env, id, null, user.id);
      if (!owned) return json({ error: 'not_found' }, 404, authCorsHeaders);
      await deleteThumb(env, thumbKey(id));
      return json({ ok: true }, 200, authCorsHeaders);
    }

    // GET /v1/thumb/:id — public image bytes.
    //
    // Keyed by game id rather than by bucket key so the key layout can change
    // without breaking links that are already in people's games.
    const serveMatch = url.pathname.match(/^\/v1\/thumb\/([A-Za-z0-9-]{1,64})$/);
    if (serveMatch && request.method === 'GET') {
      const id = serveMatch[1];
      const key = await getThumbKey(env, id);
      if (!key) return json({ error: 'not_found' }, 404, cors);
      const object = await getThumb(env, key);
      if (!object) return json({ error: 'not_found' }, 404, cors);
      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
          'Cache-Control': 'public, max-age=604800',
          // Locked down: an image served from the API origin can still be
          // embedded by any page, so don't let it sniff anything else.
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // ---- multiplayer -----------------------------------------------------

    if (url.pathname === '/rooms' && request.method === 'POST') {
      const code = generateRoomCode();
      // Touch the DO so it exists and is addressable, then hand back the code.
      const id = env.ROOMS.idFromName(code);
      env.ROOMS.get(id);
      return json({ room: code });
    }

    const match = url.pathname.match(/^\/room\/([A-Za-z0-9]+)$/);
    if (match) {
      const code = match[1].toUpperCase();
      if (!isRoomCode(code)) {
        return new Response('invalid room code', { status: 400, headers: cors });
      }
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }

    return new Response('not found', { status: 404, headers: cors });
}
