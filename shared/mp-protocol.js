// Shared, environment-agnostic WebSocket protocol for WhiteBox multiplayer.
// Imported by BOTH the Cloudflare Worker (server) and the browser client, so
// validation rules can never drift between the two sides.
//
// Every message is JSON: { v: PROTOCOL_VERSION, t: TYPE, ...payload }.
// The server is authoritative: clients propose inputs, the server validates and
// broadcasts snapshots + scores. Clients never submit scores directly.

export const PROTOCOL_VERSION = 1;

// Hard cap on a single inbound frame. Anything larger is rejected/closed.
export const MAX_PAYLOAD_BYTES = 2048;

export const MSG = {
  // client -> server
  JOIN: 'join',
  MOVE: 'move',
  PICKUP: 'pickup',
  PING: 'ping',
  LEAVE: 'leave',
  // server -> client
  JOINED: 'joined',
  PRESENCE: 'presence',
  SNAPSHOT: 'snapshot',
  SCORE: 'score',
  ORB_TAKEN: 'orb_taken',
  PONG: 'pong',
  ERROR: 'error',
};

export const ERR = {
  BAD_MESSAGE: 'bad_message',
  BAD_VERSION: 'bad_version',
  ROOM_FULL: 'room_full',
  RATE_LIMITED: 'rate_limited',
  PAYLOAD_TOO_LARGE: 'payload_too_large',
  NOT_JOINED: 'not_joined',
  INVALID_MOVE: 'invalid_move',
  ORB_INVALID: 'orb_invalid',
  INTERNAL: 'internal',
};

// World bounds for the shared arena. The server clamps/validates movement to
// these so a client cannot teleport anywhere it likes.
export const ARENA = {
  minX: -14,
  maxX: 14,
  minZ: -14,
  maxZ: 14,
  // Maximum distance a player may move in one update, in world units.
  maxStep: 3.0,
};

// Canonical orb layout for the arena. Both the client scene and the authoritative
// server read THIS list, so a client can never invent an orb that isn't there.
// Coordinates are [x, z] on the arena floor (y is fixed).
export const ORB_SPOTS = [
  [-9, -9], [9, -9], [-9, 9], [9, 9],
  [0, -11], [0, 11], [-11, 0], [11, 0],
  [0, 0], [-5, 6], [6, -5], [5, 6],
];

// A pickup is only accepted if the player is within this distance of the orb.
export const ORB_PICKUP_RADIUS = 2.2;

export function distance2D(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

export const ROOM = {
  maxPlayers: 8,
  codeLength: 5,
  // Server broadcasts an authoritative snapshot at this cadence (ms).
  snapshotIntervalMs: 100,
  // A room with no connections for this long is torn down (ms).
  idleTimeoutMs: 60_000,
  // Inbound messages allowed per window, and the window length.
  rateLimit: { max: 40, windowMs: 1000 },
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

export function generateRoomCode(random = Math.random) {
  let code = '';
  for (let i = 0; i < ROOM.codeLength; i += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function isRoomCode(value) {
  return typeof value === 'string'
    && value.length === ROOM.codeLength
    && [...value].every((c) => CODE_ALPHABET.includes(c));
}

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function sanitizeName(name) {
  if (typeof name !== 'string') return '';
  return name
    .replace(/\s+/g, ' ')
    .replace(/[^\w \-./]/g, '')
    .trim()
    .slice(0, 24);
}

// Decode + structurally validate a raw inbound text frame.
export function decodeMessage(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, code: ERR.BAD_MESSAGE, message: 'expected a text frame' };
  }
  const bytes = new TextEncoder().encode(raw).length;
  if (bytes > MAX_PAYLOAD_BYTES) {
    return { ok: false, code: ERR.PAYLOAD_TOO_LARGE, message: `payload exceeds ${MAX_PAYLOAD_BYTES} bytes` };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, code: ERR.BAD_MESSAGE, message: 'invalid JSON' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, code: ERR.BAD_MESSAGE, message: 'expected a JSON object' };
  }
  if (data.v !== PROTOCOL_VERSION) {
    return { ok: false, code: ERR.BAD_VERSION, message: `unsupported protocol version: ${data.v}` };
  }
  if (typeof data.t !== 'string') {
    return { ok: false, code: ERR.BAD_MESSAGE, message: 'missing message type' };
  }
  return { ok: true, msg: data };
}

function normalizeMove(msg) {
  const { x, z, ry } = msg;
  if (!isFiniteNumber(x) || !isFiniteNumber(z)) {
    return { ok: false, code: ERR.INVALID_MOVE, message: 'move requires finite x and z' };
  }
  return {
    ok: true,
    msg: {
      v: PROTOCOL_VERSION,
      t: MSG.MOVE,
      x: clamp(x, ARENA.minX, ARENA.maxX),
      z: clamp(z, ARENA.minZ, ARENA.maxZ),
      ry: isFiniteNumber(ry) ? ry : 0,
      ts: isFiniteNumber(msg.ts) ? msg.ts : Date.now(),
    },
  };
}

// Validate + normalize a message that came FROM a client. Returns a safe object
// the server can trust, or a structured error to send back / close with.
export function validateClientMessage(msg) {
  switch (msg.t) {
    case MSG.JOIN:
      return { ok: true, msg: { v: PROTOCOL_VERSION, t: MSG.JOIN, name: sanitizeName(msg.name) } };
    case MSG.MOVE:
      return normalizeMove(msg);
    case MSG.PICKUP: {
      const id = msg.orbId;
      if (!Number.isInteger(id) || id < 0 || id >= ORB_SPOTS.length) {
        return { ok: false, code: ERR.ORB_INVALID, message: `orbId out of range: ${id}` };
      }
      return { ok: true, msg: { v: PROTOCOL_VERSION, t: MSG.PICKUP, orbId: id } };
    }
    case MSG.PING:
      return { ok: true, msg: { v: PROTOCOL_VERSION, t: MSG.PING, ts: isFiniteNumber(msg.ts) ? msg.ts : Date.now() } };
    case MSG.LEAVE:
      return { ok: true, msg: { v: PROTOCOL_VERSION, t: MSG.LEAVE } };
    default:
      return { ok: false, code: ERR.BAD_MESSAGE, message: `unknown client message type: ${msg.t}` };
  }
}

// Anti-teleport check: reject a move that jumps further than maxStep from the
// last accepted position for that player.
export function isPlausibleStep(prev, next) {
  if (!prev) return true;
  const dx = next.x - prev.x;
  const dz = next.z - prev.z;
  return Math.hypot(dx, dz) <= ARENA.maxStep;
}

export function encodeMessage(obj) {
  return JSON.stringify({ v: PROTOCOL_VERSION, ...obj });
}
