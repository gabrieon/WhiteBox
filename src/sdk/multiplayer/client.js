// WhiteBox Game SDK — browser multiplayer client.
//
// Wraps a WebSocket connection to the Cloudflare Worker / Durable Object room.
// Handles connect, auto-join, heartbeat, throttled movement, snapshot intake and
// reconnection with backoff. The server stays authoritative: this client only
// PROPOSES movement and RECEIVES snapshots/scores. It never submits a score.

import {
  PROTOCOL_VERSION,
  MSG,
  decodeMessage,
  encodeMessage,
} from '../../../shared/mp-protocol.js';

export const ConnState = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  OPEN: 'open',
  JOINED: 'joined',
  RECONNECTING: 'reconnecting',
  CLOSED: 'closed',
  ERROR: 'error',
};

// Resolve the worker URL. In the Vite app this comes from env; in node tests it
// is passed explicitly. Optional chaining keeps this import-safe outside Vite.
export function defaultMultiplayerUrl() {
  return import.meta.env?.VITE_MP_URL || 'ws://127.0.0.1:8787';
}

const MOVE_THROTTLE_MS = 50; // ~20 Hz upstream
const HEARTBEAT_MS = 15_000;
const MAX_RECONNECT_DELAY = 8_000;

export function connectMultiplayer(options = {}) {
  const {
    url = defaultMultiplayerUrl(),
    room,
    name = '',
    autoJoin = true,
    onState = () => {},
    onJoined = () => {},
    onPlayers = () => {},
    onSnapshot = () => {},
    onScore = () => {},
    onError = () => {},
    onRtt = () => {},
  } = options;

  let ws = null;
  let state = ConnState.IDLE;
  let intentionalClose = false;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let lastMoveSent = 0;
  let youId = null;
  let lastRtt = null;

  function setState(next, meta) {
    state = next;
    onState(next, meta);
  }

  function buildUrl() {
    const base = url.replace(/\/$/, '');
    // Route: /room/<CODE>. A fresh room is created by POSTing to /rooms, which
    // returns a code; the caller passes that code in.
    return `${base}/room/${encodeURIComponent(room)}`;
  }

  function clearTimers() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(encodeMessage(obj));
      return true;
    }
    return false;
  }

  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => send({ t: MSG.PING, ts: Date.now() }), HEARTBEAT_MS);
  }

  function handleMessage(raw) {
    const decoded = decodeMessage(raw);
    if (!decoded.ok) {
      onError({ code: decoded.code, message: decoded.message });
      return;
    }
    const msg = decoded.msg;
    switch (msg.t) {
      case MSG.JOINED:
        youId = msg.youId;
        reconnectAttempts = 0;
        setState(ConnState.JOINED, { room: msg.room, youId });
        onJoined({ youId: msg.youId, room: msg.room, players: msg.players || [], score: msg.score });
        onPlayers(msg.players || []);
        startHeartbeat();
        break;
      case MSG.PRESENCE:
        onPlayers(msg.players || []);
        break;
      case MSG.SNAPSHOT:
        onSnapshot(msg);
        break;
      case MSG.SCORE:
        onScore({ id: msg.id, score: msg.score, reason: msg.reason });
        break;
      case MSG.PONG:
        lastRtt = Date.now() - (msg.ts || Date.now());
        onRtt(lastRtt);
        break;
      case MSG.ERROR:
        onError({ code: msg.code, message: msg.message });
        break;
      default:
        break;
    }
  }

  function connect() {
    if (!room) {
      setState(ConnState.ERROR, { message: 'no room code supplied' });
      onError({ code: 'no_room', message: 'connectMultiplayer requires a room code' });
      return;
    }
    intentionalClose = false;
    setState(reconnectAttempts > 0 ? ConnState.RECONNECTING : ConnState.CONNECTING);
    try {
      ws = new WebSocket(buildUrl());
    } catch (err) {
      setState(ConnState.ERROR, { message: String(err) });
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      setState(ConnState.OPEN);
      if (autoJoin) send({ t: MSG.JOIN, name });
    };
    ws.onmessage = (ev) => handleMessage(ev.data);
    ws.onerror = () => {
      onError({ code: 'socket_error', message: 'websocket error' });
    };
    ws.onclose = (ev) => {
      clearTimers();
      if (intentionalClose) {
        setState(ConnState.CLOSED, { code: ev.code });
        return;
      }
      setState(ConnState.RECONNECTING, { code: ev.code });
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (intentionalClose) return;
    reconnectAttempts += 1;
    const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), MAX_RECONNECT_DELAY);
    reconnectTimer = setTimeout(connect, delay);
  }

  connect();

  return {
    get state() { return state; },
    get youId() { return youId; },
    get rtt() { return lastRtt; },

    // Propose a movement. Throttled upstream; the server validates + clamps it.
    sendMove(x, z, ry) {
      const now = Date.now();
      if (now - lastMoveSent < MOVE_THROTTLE_MS) return false;
      lastMoveSent = now;
      return send({ t: MSG.MOVE, x, z, ry, ts: now });
    },

    // Ask the server to collect an orb. The server validates proximity and, if
    // accepted, broadcasts ORB_TAKEN + the new authoritative score. The client
    // never sets its own score.
    sendPickup(orbId) {
      return send({ t: MSG.PICKUP, orbId });
    },

    join(displayName = name) {
      return send({ t: MSG.JOIN, name: displayName });
    },

    leave() {
      send({ t: MSG.LEAVE });
    },

    reconnect() {
      reconnectAttempts = 0;
      clearTimers();
      if (ws) { try { ws.close(); } catch { /* noop */ } }
      connect();
    },

    close() {
      intentionalClose = true;
      clearTimers();
      if (ws) {
        try { ws.close(1000, 'client close'); } catch { /* noop */ }
      }
      ws = null;
      setState(ConnState.CLOSED);
    },
  };
}

// Create a room by asking the worker for a fresh code. Returns the code.
export async function createRoom(baseUrl = defaultMultiplayerUrl()) {
  const http = baseUrl.replace(/^ws/, 'http').replace(/\/$/, '');
  const res = await fetch(`${http}/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error(`createRoom failed: ${res.status}`);
  const data = await res.json();
  if (!data || typeof data.room !== 'string') throw new Error('createRoom: malformed response');
  return data.room;
}

export { PROTOCOL_VERSION };
