// WhiteBox multiplayer Worker — HTTP entry point.
//
// Routes:
//   GET  /health        -> liveness probe
//   POST /rooms         -> mint a fresh room code (JSON { room })
//   GET  /room/:code    -> upgrade to WebSocket, routed to the GameRoom DO
//
// The Durable Object id is derived deterministically from the room code via
// idFromName (Cloudflare hashes the name into a namespace-valid id), so any
// client that knows the code reaches the same room. This config is isolated and
// does NOT touch any existing production deployment.

import { isRoomCode, generateRoomCode } from '../../shared/mp-protocol.js';
import { GameRoom } from './GameRoom.js';
import { verifyGoogleIdToken } from './google.js';
import {
  createSession,
  readSession,
  destroySession,
  sessionCookieHeader,
  clearedSessionCookieHeader,
  publicProfile,
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

const BASE_CORS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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

export default {
  async fetch(request, env) {
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
          { 'Set-Cookie': sessionCookieHeader(request, id) },
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
      return json({ profile: found ? publicProfile(found.record) : null }, 200, authCorsHeaders);
    }

    // POST /auth/logout
    if (url.pathname === '/auth/logout' && request.method === 'POST') {
      if (!authCorsHeaders) {
        return json({ error: 'origin_not_allowed' }, 403, cors);
      }
      await destroySession(env, request);
      return json({ ok: true }, 200, authCorsHeaders, {
        'Set-Cookie': clearedSessionCookieHeader(request),
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
  },
};
