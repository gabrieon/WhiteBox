// Real two-client multiplayer integration test against a locally running Worker
// (wrangler dev / miniflare). Uses Node's built-in WebSocket — no browser needed.
//
// Start the worker first:  npm run worker:dev
// Then run:                node scripts/test-multiplayer.mjs
//
// Verifies the server is authoritative: presence, movement sync, server-side
// scoring with proximity validation, rejection of client-submitted scores and
// malformed messages, disconnect cleanup, per-room isolation, payload limits.

import assert from 'node:assert/strict';
import {
  PROTOCOL_VERSION,
  MSG,
  ERR,
  ORB_SPOTS,
  MAX_PAYLOAD_BYTES,
} from '../shared/mp-protocol.js';

const HTTP = process.env.MP_HTTP || 'http://127.0.0.1:8787';
const WS = process.env.MP_WS || 'ws://127.0.0.1:8787';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitHealthy(timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${HTTP}/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error(`worker did not become healthy at ${HTTP}`);
}

async function createRoom() {
  const res = await fetch(`${HTTP}/rooms`, { method: 'POST' });
  assert.equal(res.ok, true, 'POST /rooms should succeed');
  const data = await res.json();
  assert.ok(data.room, 'room code returned');
  return data.room;
}

class Client {
  constructor(name, url) {
    this.name = name;
    this.msgs = [];
    this.ws = new WebSocket(url);
    this.opened = new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(new Error(`${name} ws error: ${e?.message || e}`));
    });
    this.ws.onmessage = (ev) => {
      try { this.msgs.push(JSON.parse(ev.data)); } catch { /* ignore */ }
    };
  }

  send(obj) { this.ws.send(JSON.stringify({ v: PROTOCOL_VERSION, ...obj })); }
  sendRaw(str) { this.ws.send(str); }
  find(pred) { return this.msgs.find(pred); }

  async waitFor(pred, timeoutMs = 6000, label = 'message') {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const hit = this.find(pred);
      if (hit) return hit;
      await sleep(50);
    }
    throw new Error(`${this.name}: timed out waiting for ${label}`);
  }

  close() { try { this.ws.close(); } catch { /* noop */ } }
}

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const roomUrl = (code) => `${WS}/room/${code}`;

async function main() {
  console.log(`waiting for worker at ${HTTP} ...`);
  await waitHealthy();
  console.log('worker healthy\nmultiplayer integration');

  const code = await createRoom();

  const A = new Client('A', roomUrl(code));
  const B = new Client('B', roomUrl(code));
  await Promise.all([A.opened, B.opened]);

  let aId; let bId;

  await test('both clients join and receive identity', async () => {
    A.send({ t: MSG.JOIN, name: 'Alice' });
    B.send({ t: MSG.JOIN, name: 'Bob' });
    const aj = await A.waitFor((m) => m.t === MSG.JOINED, 6000, 'JOINED');
    const bj = await B.waitFor((m) => m.t === MSG.JOINED, 6000, 'JOINED');
    assert.ok(aj.youId && bj.youId, 'server assigns player ids');
    assert.notEqual(aj.youId, bj.youId, 'ids are distinct');
    assert.equal(aj.room, code, 'room code echoed');
    aId = aj.youId; bId = bj.youId;
    // Whoever joined second sees both players in the JOINED payload.
    assert.equal(bj.players.length, 2, 'second joiner sees 2 players');
  });

  await test('each client sees the other via presence', async () => {
    const pres = await A.waitFor((m) => m.t === MSG.PRESENCE && m.players.length === 2, 6000, 'PRESENCE with 2');
    const ids = pres.players.map((p) => p.id).sort();
    assert.deepEqual(ids, [aId, bId].sort(), 'presence lists both players');
  });

  await test('movement by A is visible to B via snapshot', async () => {
    A.send({ t: MSG.MOVE, x: 3.5, z: 0, ry: 0 });
    const snap = await B.waitFor(
      (m) => m.t === MSG.SNAPSHOT && m.players.some((p) => p.id === aId && Math.abs(p.x - 3.5) < 0.001),
      6000,
      'SNAPSHOT with A at x=3.5',
    );
    assert.ok(snap, 'B received an authoritative snapshot containing A');
  });

  await test('server rejects a pickup from too far away', async () => {
    const farOrb = ORB_SPOTS.findIndex(([x, z]) => Math.hypot(x - 3.5, z - 0) > 2.2);
    assert.ok(farOrb >= 0, 'there is an orb out of range');
    const mark = A.msgs.length;
    A.send({ t: MSG.PICKUP, orbId: farOrb });
    const err = await A.waitFor((m) => m.t === MSG.ERROR && m.code === ERR.ORB_INVALID && A.msgs.indexOf(m) >= mark, 6000, 'ORB_INVALID');
    assert.ok(err, 'far pickup rejected');
  });

  await test('server awards a score for a valid nearby pickup', async () => {
    // Walk A to the orb at [0,0] (index 8) in legal steps (< maxStep each).
    A.send({ t: MSG.MOVE, x: 1.5, z: 0 });
    await sleep(120);
    A.send({ t: MSG.MOVE, x: 0, z: 0 });
    await sleep(120);
    const target = ORB_SPOTS.findIndex(([x, z]) => x === 0 && z === 0);
    A.send({ t: MSG.PICKUP, orbId: target });

    const scoreMsg = await B.waitFor((m) => m.t === MSG.SCORE && m.id === aId && m.score === 1, 6000, 'SCORE=1 for A');
    assert.equal(scoreMsg.score, 1, 'server set the score (not the client)');
    const taken = await B.waitFor((m) => m.t === MSG.ORB_TAKEN && m.orbId === target && m.byId === aId, 6000, 'ORB_TAKEN');
    assert.ok(taken, 'orb removal broadcast to other client');
  });

  await test('a second client cannot re-collect the same orb', async () => {
    const target = ORB_SPOTS.findIndex(([x, z]) => x === 0 && z === 0);
    const mark = B.msgs.length;
    B.send({ t: MSG.PICKUP, orbId: target });
    await sleep(500);
    const newScore = B.msgs.slice(mark).find((m) => m.t === MSG.SCORE && m.id === bId);
    assert.equal(newScore, undefined, 'B got no score for an already-collected orb');
  });

  await test('clients cannot submit their own score', async () => {
    const mark = A.msgs.length;
    A.send({ t: MSG.SCORE, id: aId, score: 999 });
    const err = await A.waitFor((m) => m.t === MSG.ERROR && A.msgs.indexOf(m) >= mark, 6000, 'ERROR for score submit');
    assert.equal(err.code, ERR.BAD_MESSAGE, 'score is a server->client type only');
  });

  await test('server rejects an unsupported protocol version', async () => {
    const mark = A.msgs.length;
    A.sendRaw(JSON.stringify({ v: 999, t: MSG.PING }));
    const err = await A.waitFor((m) => m.t === MSG.ERROR && A.msgs.indexOf(m) >= mark, 6000, 'BAD_VERSION');
    assert.equal(err.code, ERR.BAD_VERSION);
  });

  await test('server rejects an oversized payload', async () => {
    const mark = A.msgs.length;
    const big = JSON.stringify({ v: PROTOCOL_VERSION, t: MSG.JOIN, pad: 'x'.repeat(MAX_PAYLOAD_BYTES + 64) });
    A.sendRaw(big);
    const err = await A.waitFor((m) => m.t === MSG.ERROR && A.msgs.indexOf(m) >= mark, 6000, 'PAYLOAD_TOO_LARGE');
    assert.equal(err.code, ERR.PAYLOAD_TOO_LARGE);
  });

  await test('server rejects an impossible teleport', async () => {
    const mark = A.msgs.length;
    A.send({ t: MSG.MOVE, x: 14, z: 14 }); // far beyond maxStep from (0,0)
    await sleep(400);
    // The move is ignored; the next snapshot still shows A near the origin.
    const snap = await A.waitFor((m) => m.t === MSG.SNAPSHOT && A.msgs.indexOf(m) >= mark, 6000, 'SNAPSHOT');
    const me = snap.players.find((p) => p.id === aId);
    assert.ok(Math.hypot(me.x, me.z) < 3, 'teleport was not applied');
  });

  await test('disconnect cleans up player state', async () => {
    B.close();
    const pres = await A.waitFor((m) => m.t === MSG.PRESENCE && m.left === bId, 8000, 'PRESENCE left=B');
    assert.ok(pres, 'A is told B left');
    assert.equal(pres.players.some((p) => p.id === bId), false, 'B removed from players');
  });

  await test('rooms are isolated from one another', async () => {
    const code2 = await createRoom();
    assert.notEqual(code2, code);
    const C = new Client('C', roomUrl(code2));
    await C.opened;
    C.send({ t: MSG.JOIN, name: 'Cara' });
    const cj = await C.waitFor((m) => m.t === MSG.JOINED, 6000, 'JOINED');
    assert.equal(cj.room, code2);
    assert.equal(cj.players.length, 1, 'C is alone in its own room');
    // A must not learn about C.
    const mark = A.msgs.length;
    await sleep(400);
    const sawC = A.msgs.slice(mark).some((m) => JSON.stringify(m).includes(cj.youId));
    assert.equal(sawC, false, 'no cross-room leakage');
    C.close();
  });

  A.close();
  console.log(`\n${passed} multiplayer checks passed`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
