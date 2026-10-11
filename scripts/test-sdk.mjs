// Node smoke tests for the pure, environment-agnostic parts of the SDK:
// manifest validation and the multiplayer wire protocol. Run: node scripts/test-sdk.mjs
// (No test framework is installed; these use node:assert and exit non-zero on failure.)

import assert from 'node:assert/strict';
import {
  validateManifest,
  normalizeManifest,
  ENGINES,
} from '../src/sdk/manifest.js';
import {
  PROTOCOL_VERSION,
  MSG,
  ERR,
  MAX_PAYLOAD_BYTES,
  ARENA,
  decodeMessage,
  validateClientMessage,
  isPlausibleStep,
  generateRoomCode,
  isRoomCode,
  sanitizeName,
} from '../shared/mp-protocol.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log('manifest validation');

test('accepts a valid r3f manifest with a loader', () => {
  const { valid, errors } = validateManifest({
    id: 'orb-arena',
    title: 'Orb Arena',
    description: 'd',
    engine: 'r3f',
    categories: ['3D'],
    playModes: ['single'],
    players: { min: 1, max: 1 },
    loader: () => Promise.resolve({ default: () => null }),
  });
  assert.equal(valid, true, errors.join('; '));
});

test('rejects a missing/invalid id', () => {
  assert.equal(validateManifest({ title: 'x', description: 'd', engine: 'react', component: () => null }).valid, false);
  assert.equal(validateManifest({ id: 'Bad ID', title: 'x', description: 'd', engine: 'react', component: () => null }).valid, false);
});

test('rejects an unknown engine', () => {
  const { valid, errors } = validateManifest({ id: 'g', title: 'x', description: 'd', engine: 'unity', component: () => null });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('engine')));
});

test('requires an entry point for available games', () => {
  const { valid, errors } = validateManifest({ id: 'g', title: 'x', description: 'd', engine: 'react' });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('component')));
});

test('allows catalog-only entries via available:false', () => {
  const { valid, errors } = validateManifest({
    id: 'soon', title: 'Coming', description: 'd', engine: 'react', available: false,
  });
  assert.equal(valid, true, errors.join('; '));
});

test('multiplayer games must declare players.max >= 2', () => {
  const bad = validateManifest({
    id: 'mp', title: 'x', description: 'd', engine: 'react', component: () => null,
    playModes: ['multiplayer'], players: { min: 1, max: 1 },
  });
  assert.equal(bad.valid, false);
  const good = validateManifest({
    id: 'mp', title: 'x', description: 'd', engine: 'react', component: () => null,
    playModes: ['multiplayer'], players: { min: 1, max: 8 },
  });
  assert.equal(good.valid, true, good.errors.join('; '));
});

test('normalizeManifest fills defaults', () => {
  const n = normalizeManifest({ id: 'g', title: 'x', description: 'd', engine: 'react', component: () => null });
  assert.equal(n.available, true);
  assert.deepEqual(n.playModes, ['single']);
  assert.deepEqual(n.players, { min: 1, max: 1 });
  assert.deepEqual(n.categories, []);
  assert.ok(ENGINES.includes(n.engine));
});

console.log('multiplayer protocol');

test('room codes are generated and validated', () => {
  const code = generateRoomCode(() => 0.5);
  assert.equal(typeof code, 'string');
  assert.equal(isRoomCode(code), true);
  assert.equal(isRoomCode('nope!'), false);
  assert.equal(isRoomCode('AB'), false);
});

test('sanitizeName strips junk and caps length', () => {
  assert.equal(sanitizeName('  Neo<>{}  '), 'Neo');
  assert.equal(sanitizeName('a'.repeat(60)).length, 24);
  assert.equal(sanitizeName(123), '');
});

test('decodeMessage rejects bad JSON, wrong version, oversize', () => {
  assert.equal(decodeMessage('{not json').ok, false);
  assert.equal(decodeMessage(JSON.stringify({ v: 999, t: MSG.JOIN })).code, ERR.BAD_VERSION);
  const huge = JSON.stringify({ v: PROTOCOL_VERSION, t: MSG.JOIN, pad: 'x'.repeat(MAX_PAYLOAD_BYTES + 10) });
  assert.equal(decodeMessage(huge).code, ERR.PAYLOAD_TOO_LARGE);
  assert.equal(decodeMessage(JSON.stringify({ v: PROTOCOL_VERSION, t: MSG.JOIN })).ok, true);
});

test('validateClientMessage normalizes join and clamps move to the arena', () => {
  const join = validateClientMessage({ v: PROTOCOL_VERSION, t: MSG.JOIN, name: '  Neo  ' });
  assert.equal(join.ok, true);
  assert.equal(join.msg.name, 'Neo');

  const move = validateClientMessage({ v: PROTOCOL_VERSION, t: MSG.MOVE, x: 9999, z: -9999, ry: 1 });
  assert.equal(move.ok, true);
  assert.equal(move.msg.x, ARENA.maxX);
  assert.equal(move.msg.z, ARENA.minZ);

  const badMove = validateClientMessage({ v: PROTOCOL_VERSION, t: MSG.MOVE, x: 'NaN', z: 0 });
  assert.equal(badMove.ok, false);
  assert.equal(badMove.code, ERR.INVALID_MOVE);
});

test('validateClientMessage rejects unknown types', () => {
  const r = validateClientMessage({ v: PROTOCOL_VERSION, t: 'self_destruct' });
  assert.equal(r.ok, false);
  assert.equal(r.code, ERR.BAD_MESSAGE);
});

test('isPlausibleStep blocks teleports', () => {
  assert.equal(isPlausibleStep({ x: 0, z: 0 }, { x: 1, z: 1 }), true);
  assert.equal(isPlausibleStep({ x: 0, z: 0 }, { x: 0, z: 0 }), true); // first step
  assert.equal(isPlausibleStep({ x: 0, z: 0 }, { x: 12, z: 0 }), false);
});

console.log(`\n${passed} assertions groups passed`);
