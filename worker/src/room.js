// Authoritative room state for WhiteBox multiplayer.
//
// This module is PURE (no WebSocket / Durable Object / DOM dependencies) so it
// can be unit-tested in Node and reasoned about independently of the transport.
// The GameRoom Durable Object owns one of these and is the single source of
// truth: clients propose moves and pickups, this module validates and applies
// them, and the server broadcasts snapshots. Clients never set their own score.

import {
  ARENA,
  ORB_SPOTS,
  ORB_PICKUP_RADIUS,
  ROOM,
  clamp,
  distance2D,
  generateRoomCode,
  isPlausibleStep,
} from '../../shared/mp-protocol.js';

export function createRoomState({ code, now = Date.now() } = {}) {
  return {
    code: code || generateRoomCode(),
    // id -> { id, name, x, z, ry, score, lastSeen }
    players: {},
    // orbIds collected this round (server-authoritative)
    collectedOrbs: [],
    createdAt: now,
  };
}

export function playerCount(room) {
  return Object.keys(room.players).length;
}

export function isEmpty(room) {
  return playerCount(room) === 0;
}

// Spread spawns around the center so players do not all stack on one point.
export function addPlayer(room, { id, name, now = Date.now() }) {
  if (playerCount(room) >= ROOM.maxPlayers) return { ok: false, reason: 'room_full' };
  if (room.players[id]) return { ok: true, player: room.players[id], rejoined: true };
  const angle = (playerCount(room) / ROOM.maxPlayers) * Math.PI * 2;
  const player = {
    id,
    name: name || 'Player',
    x: clamp(Math.cos(angle) * 3, ARENA.minX, ARENA.maxX),
    z: clamp(Math.sin(angle) * 3, ARENA.minZ, ARENA.maxZ),
    ry: 0,
    score: 0,
    lastSeen: now,
  };
  room.players[id] = player;
  return { ok: true, player };
}

export function removePlayer(room, id) {
  const existed = Boolean(room.players[id]);
  delete room.players[id];
  return existed;
}

// Validate + apply a proposed move. Rejects teleports beyond ARENA.maxStep.
export function applyMove(room, id, { x, z, ry }, now = Date.now()) {
  const p = room.players[id];
  if (!p) return { ok: false, reason: 'not_joined' };
  const nx = clamp(x, ARENA.minX, ARENA.maxX);
  const nz = clamp(z, ARENA.minZ, ARENA.maxZ);
  if (!isPlausibleStep({ x: p.x, z: p.z }, { x: nx, z: nz })) {
    return { ok: false, reason: 'invalid_move' };
  }
  p.x = nx;
  p.z = nz;
  if (typeof ry === 'number' && Number.isFinite(ry)) p.ry = ry;
  p.lastSeen = now;
  return { ok: true, player: p };
}

// Server-controlled scoring: a pickup only counts if the orb exists, is not
// already collected, and the player is actually near it.
export function applyPickup(room, id, orbId) {
  const p = room.players[id];
  if (!p) return { ok: false, reason: 'not_joined' };
  if (!Number.isInteger(orbId) || orbId < 0 || orbId >= ORB_SPOTS.length) {
    return { ok: false, reason: 'orb_invalid' };
  }
  if (room.collectedOrbs.includes(orbId)) return { ok: false, reason: 'already_collected' };
  const [ox, oz] = ORB_SPOTS[orbId];
  if (distance2D(p.x, p.z, ox, oz) > ORB_PICKUP_RADIUS) {
    return { ok: false, reason: 'too_far' };
  }
  room.collectedOrbs.push(orbId);
  p.score += 1;
  return { ok: true, orbId, score: p.score };
}

function publicPlayer(p) {
  return { id: p.id, name: p.name, x: p.x, z: p.z, ry: p.ry, score: p.score };
}

export function listPlayers(room) {
  return Object.values(room.players).map(publicPlayer);
}

export function snapshot(room, now = Date.now()) {
  return {
    ts: now,
    players: listPlayers(room),
    collectedOrbs: room.collectedOrbs.slice(),
  };
}
