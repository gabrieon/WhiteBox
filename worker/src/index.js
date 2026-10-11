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

// The DO class must be exported from the Worker's main module.
export { GameRoom };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Upgrade',
  'Access-Control-Max-Age': '86400',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'whitebox-mp' });
    }

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
        return new Response('invalid room code', { status: 400, headers: CORS });
      }
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }

    return new Response('not found', { status: 404, headers: CORS });
  },
};
