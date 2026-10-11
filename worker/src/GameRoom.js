/* global WebSocketPair */
// GameRoom — one Durable Object per room code. Uses the WebSocket Hibernation API
// (ctx.acceptWebSocket / webSocketMessage / webSocketClose) so idle rooms can
// hibernate without dropping clients. Authoritative: it owns room state, validates
// every client message, and controls scoring. See shared/mp-protocol.js.

import {
  MSG,
  ERR,
  ROOM,
  decodeMessage,
  validateClientMessage,
  encodeMessage,
} from '../../shared/mp-protocol.js';
import {
  createRoomState,
  addPlayer,
  removePlayer,
  applyMove,
  applyPickup,
  listPlayers,
  snapshot,
  isEmpty,
  playerCount,
} from './room.js';

const STORAGE_KEY = 'room';

export class GameRoom {
  constructor(state, env) {
    this.ctx = state;
    this.env = env;
    this.room = null;
    this.rate = new Map();       // key -> { count, start }
    this.broadcastTimer = null;
    this.persistTimer = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('expected a WebSocket upgrade', { status: 426 });
    }
    await this.ensureRoom(url);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // Hibernation API: hand the server socket to the runtime. Identity is
    // assigned later (on JOIN) via serializeAttachment.
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async ensureRoom(url) {
    if (this.room) return;
    const stored = await this.ctx.storage.get(STORAGE_KEY);
    if (stored && stored.players) {
      this.room = stored;
    } else {
      const code = (url?.pathname?.match(/\/room\/([A-Za-z0-9]+)$/) || [])[1]?.toUpperCase();
      this.room = createRoomState({ code });
    }
    // Drop stale players that were connected before a hibernation/eviction; live
    // sockets re-announce themselves on their next JOIN/resync.
    this.room.players = {};
  }

  // --- transport helpers ---------------------------------------------------
  send(ws, obj) {
    try { ws.send(encodeMessage(obj)); } catch { /* socket already closing */ }
  }

  sendError(ws, code, message) {
    this.send(ws, { t: MSG.ERROR, code, message });
  }

  broadcast(obj) {
    const data = encodeMessage(obj);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(data); } catch { /* ignore dead sockets */ }
    }
  }

  allow(key) {
    const now = Date.now();
    let r = this.rate.get(key);
    if (!r || now - r.start > ROOM.rateLimit.windowMs) {
      r = { count: 0, start: now };
      this.rate.set(key, r);
    }
    r.count += 1;
    return r.count <= ROOM.rateLimit.max;
  }

  newPlayerId() {
    return (crypto?.randomUUID?.() || `p-${Date.now()}-${Math.floor(Math.random() * 1e6)}`).slice(0, 32);
  }

  // --- hibernation WebSocket handlers -------------------------------------
  async webSocketMessage(ws, raw) {
    await this.ensureRoom();
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    const decoded = decodeMessage(text);
    if (!decoded.ok) { this.sendError(ws, decoded.code, decoded.message); return; }

    const validated = validateClientMessage(decoded.msg);
    if (!validated.ok) { this.sendError(ws, validated.code, validated.message); return; }
    const msg = validated.msg;

    const att = ws.deserializeAttachment() || {};
    const rateKey = att.playerId || 'pending';
    if (!this.allow(rateKey)) { this.sendError(ws, ERR.RATE_LIMITED, 'too many messages'); return; }

    switch (msg.t) {
      case MSG.JOIN: this.handleJoin(ws, msg); break;
      case MSG.MOVE: this.handleMove(ws, att.playerId, msg); break;
      case MSG.PICKUP: this.handlePickup(ws, att.playerId, msg); break;
      case MSG.PING: this.send(ws, { t: MSG.PONG, ts: msg.ts }); break;
      case MSG.LEAVE: this.handleLeave(ws, att.playerId); break;
      default: this.sendError(ws, ERR.BAD_MESSAGE, 'unhandled type');
    }
    this.scheduleBroadcast();
  }

  webSocketClose(ws) {
    const att = ws.deserializeAttachment() || {};
    if (att.playerId && this.room) {
      removePlayer(this.room, att.playerId);
      this.broadcast({ t: MSG.PRESENCE, players: listPlayers(this.room), left: att.playerId });
      this.schedulePersist();
      if (isEmpty(this.room)) this.scheduleIdleCleanup();
    }
  }

  webSocketError(ws, error) {
    // Nothing to recover from; the runtime will follow with webSocketClose.
    this.ctx.storage.put('lastError', String(error?.message || error)).catch(() => {});
  }

  // --- game logic ----------------------------------------------------------
  handleJoin(ws, msg) {
    const att = ws.deserializeAttachment();
    if (att && att.playerId && this.room.players[att.playerId]) {
      // Resync an already-joined socket (e.g., after reconnect).
      this.send(ws, this.joinedPayload(att.playerId));
      return;
    }
    if (playerCount(this.room) >= ROOM.maxPlayers) {
      this.sendError(ws, ERR.ROOM_FULL, 'room is full');
      try { ws.close(1013, 'room full'); } catch { /* noop */ }
      return;
    }
    const id = this.newPlayerId();
    addPlayer(this.room, { id, name: msg.name });
    ws.serializeAttachment({ playerId: id });
    this.send(ws, this.joinedPayload(id));
    this.broadcast({ t: MSG.PRESENCE, players: listPlayers(this.room), joined: id });
    this.schedulePersist();
  }

  joinedPayload(youId) {
    return {
      t: MSG.JOINED,
      youId,
      room: this.room.code,
      players: listPlayers(this.room),
      collectedOrbs: this.room.collectedOrbs.slice(),
      maxPlayers: ROOM.maxPlayers,
    };
  }

  handleMove(ws, playerId, msg) {
    if (!playerId) { this.sendError(ws, ERR.NOT_JOINED, 'join first'); return; }
    // Invalid moves are ignored (not broadcast); the next snapshot resyncs the
    // client to the authoritative position.
    applyMove(this.room, playerId, msg);
  }

  handlePickup(ws, playerId, msg) {
    if (!playerId) { this.sendError(ws, ERR.NOT_JOINED, 'join first'); return; }
    const res = applyPickup(this.room, playerId, msg.orbId);
    if (res.ok) {
      this.broadcast({ t: MSG.ORB_TAKEN, orbId: res.orbId, byId: playerId });
      this.broadcast({ t: MSG.SCORE, id: playerId, score: res.score });
      this.schedulePersist();
    } else if (res.reason === 'too_far' || res.reason === 'orb_invalid') {
      // Reject attempts to score from across the map or for bogus orbs.
      this.sendError(ws, ERR.ORB_INVALID, 'pickup rejected');
    }
    // 'already_collected' is silently ignored (a race between two clients).
  }

  handleLeave(ws, playerId) {
    if (!playerId) return;
    removePlayer(this.room, playerId);
    ws.serializeAttachment({});
    this.broadcast({ t: MSG.PRESENCE, players: listPlayers(this.room), left: playerId });
    this.schedulePersist();
    try { ws.close(1000, 'left'); } catch { /* noop */ }
  }

  // Throttled authoritative snapshot (never per-frame, never per-message).
  scheduleBroadcast() {
    if (this.broadcastTimer) return;
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null;
      if (this.room) this.broadcast({ t: MSG.SNAPSHOT, ...snapshot(this.room) });
    }, ROOM.snapshotIntervalMs);
  }

  schedulePersist() {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      if (this.room) this.ctx.storage.put(STORAGE_KEY, this.room).catch(() => {});
    }, 500);
  }

  scheduleIdleCleanup() {
    // Alarms survive hibernation; on fire, tear down an empty room.
    this.ctx.storage.setAlarm(Date.now() + ROOM.idleTimeoutMs).catch(() => {});
  }

  async alarm() {
    const stored = await this.ctx.storage.get(STORAGE_KEY);
    const room = this.room || stored;
    if (room && isEmpty(room)) {
      await this.ctx.storage.delete(STORAGE_KEY);
      this.room = createRoomState({ code: room.code });
    }
  }
}
