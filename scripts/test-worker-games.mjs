// Node tests for player-game moderation and write rate limits.
//
// These exercise worker/src/games.js and worker/src/moderation.js with an
// in-memory D1/KV double. The route layer is thin by design — it authenticates,
// authorizes, parses, and delegates — so the security-relevant decisions under
// test (pending-by-default, owner/admin write rules, review transitions, and
// flood ceilings) live in these modules.

import assert from 'node:assert/strict';
import {
  createGame,
  deleteGame,
  listGames,
  parseCreateGame,
  reviewGame,
  updateGame,
} from '../worker/src/games.js';
import {
  checkWriteRate,
  parseReviewDecision,
} from '../worker/src/moderation.js';

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

function makeD1() {
  const rows = new Map();

  function statement(sql) {
    return {
      bind(...args) {
        return {
          async all() {
            if (sql.includes('FROM games WHERE creator_id')) {
              const [creatorId, size] = args;
              return {
                results: [...rows.values()]
                  .filter((row) => row.creator_id === creatorId)
                  .sort((a, b) => b.created_at - a.created_at)
                  .slice(0, size),
              };
            }
            if (sql.includes('FROM games WHERE status')) {
              const [status, size] = args;
              return {
                results: [...rows.values()]
                  .filter((row) => row.status === status)
                  .sort((a, b) => b.created_at - a.created_at)
                  .slice(0, size),
              };
            }
            throw new Error(`unmocked SELECT: ${sql}`);
          },
          async first() {
            if (sql.includes('SELECT COUNT(*)')) {
              const [creatorId] = args;
              const n = [...rows.values()].filter((row) => row.creator_id === creatorId).length;
              return { n };
            }
            if (sql.startsWith('SELECT * FROM games WHERE id')) {
              return rows.get(args[0]) || null;
            }
            if (sql.includes('SELECT creator_id FROM games WHERE id')) {
              const row = rows.get(args[0]);
              return row ? { creator_id: row.creator_id } : null;
            }
            if (sql.includes('SELECT thumb_key FROM games WHERE id')) {
              const row = rows.get(args[0]);
              return row ? { thumb_key: row.thumb_key } : null;
            }
            if (sql.includes('SELECT 1 AS ok FROM games WHERE id')) {
              const [id, creatorId] = args;
              const row = rows.get(id);
              const ok = creatorId === undefined ? Boolean(row) : row?.creator_id === creatorId;
              return ok ? { ok: 1 } : null;
            }
            throw new Error(`unmocked SELECT: ${sql}`);
          },
          async run() {
            if (sql.startsWith('INSERT INTO games')) {
              const [
                id, title, description, categories, type, mode,
                creatorId, creatorName, createdAt, status, template, content,
              ] = args;
              rows.set(id, {
                id, title, description, categories, type, mode,
                creator_id: creatorId, creator_name: creatorName,
                created_at: createdAt, status, template, content,
                thumb_key: null,
              });
              return { meta: { changes: 1 } };
            }
            if (sql.includes('SET title = ?') && sql.includes('status = ?')) {
              const [title, description, categories, type, mode, status, template, content, id] = args;
              const row = rows.get(id);
              if (!row) return { meta: { changes: 0 } };
              rows.set(id, {
                ...row, title, description, categories, type, mode, status, template, content,
              });
              return { meta: { changes: 1 } };
            }
            if (sql.includes('SET status = ? WHERE id')) {
              const [status, id] = args;
              const row = rows.get(id);
              if (!row) return { meta: { changes: 0 } };
              rows.set(id, { ...row, status });
              return { meta: { changes: 1 } };
            }
            if (sql.includes('SET thumb_key = ? WHERE id')) {
              const [thumbKey, id] = args;
              const row = rows.get(id);
              if (!row) return { meta: { changes: 0 } };
              rows.set(id, { ...row, thumb_key: thumbKey });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('DELETE FROM games')) {
              const removed = rows.delete(args[0]);
              return { meta: { changes: removed ? 1 : 0 } };
            }
            throw new Error(`unmocked mutation: ${sql}`);
          },
        };
      },
    };
  }

  return { prepare: (sql) => statement(sql) };
}

function makeKV() {
  const store = new Map();
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
  };
}

function requestWithIp(ip) {
  return new Request('https://whitebox.test/v1/games', {
    method: 'POST',
    headers: { 'cf-connecting-ip': ip },
  });
}

const draft = {
  title: 'Maze Courier',
  description: 'Deliver three parcels before the timer runs out.',
  categories: ['Puzzle'],
  type: 'puzzle',
  mode: 'Solo',
};

console.log('moderation');

await test('new games start pending and stay out of the public catalogue', async () => {
  const env = { GAMES: makeD1() };
  const created = await createGame(env, parseCreateGame(draft), 'user-1', 'Ava');
  assert.equal(created.status, 'pending');
  assert.deepEqual(await listGames(env), []);
  assert.equal((await listGames(env, { creatorId: 'user-1' }))[0].status, 'pending');
});

await test('human approval publishes, rejection hides', async () => {
  const env = { GAMES: makeD1() };
  const created = await createGame(env, parseCreateGame(draft), 'user-1', 'Ava');
  const approved = await reviewGame(env, created.id, 'approved');
  assert.equal(approved.status, 'approved');
  assert.equal((await listGames(env))[0].id, created.id);

  const rejected = await reviewGame(env, created.id, 'rejected');
  assert.equal(rejected.status, 'rejected');
  assert.deepEqual(await listGames(env), []);
});

await test('machine-readable decisions cannot slip through as publishes', async () => {
  const env = { GAMES: makeD1() };
  const created = await createGame(env, parseCreateGame(draft), 'user-1', 'Ava');
  assert.throws(() => parseReviewDecision('approve'), /decision_invalid/);
  assert.equal((await listGames(env, { creatorId: 'user-1' }))[0].status, 'pending');
  await assert.rejects(reviewGame(env, created.id, 'auto-approved'), /decision_invalid/);
});

await test('an owner edit to an approved game returns it to review', async () => {
  const env = { GAMES: makeD1() };
  const created = await createGame(env, parseCreateGame(draft), 'user-1', 'Ava');
  await reviewGame(env, created.id, 'approved');
  const edited = await updateGame(env, created.id, { ...draft, title: 'Maze Courier 2' }, 'user-1');
  assert.equal(edited.title, 'Maze Courier 2');
  assert.equal(edited.status, 'pending');
  assert.deepEqual(await listGames(env), []);
});

await test('an admin edit preserves the reviewed state', async () => {
  const env = { GAMES: makeD1() };
  const created = await createGame(env, parseCreateGame(draft), 'user-1', 'Ava');
  await reviewGame(env, created.id, 'approved');
  const edited = await updateGame(env, created.id, { ...draft, title: 'Maze Courier (fixed)' }, 'admin-1', { admin: true });
  assert.equal(edited.status, 'approved');
  assert.equal((await listGames(env))[0].title, 'Maze Courier (fixed)');
});

await test('deletion is an admin action, never an authoring action', async () => {
  const env = { GAMES: makeD1() };
  const created = await createGame(env, parseCreateGame(draft), 'user-1', 'Ava');
  await reviewGame(env, created.id, 'approved');

  const denied = await deleteGame(env, created.id, { admin: false });
  assert.equal(denied.removed, false);
  assert.equal((await listGames(env)).length, 1);

  const removed = await deleteGame(env, created.id, { admin: true });
  assert.equal(removed.removed, true);
  assert.deepEqual(await listGames(env), []);
});

console.log('rate limits');

await test('write floods are refused with a retry delay', async () => {
  const env = { SESSIONS: makeKV() };
  const request = requestWithIp('203.0.113.7');
  let deniedAt = -1;
  let retryAfter = 0;

  // The login ceiling is the cheapest policy to exhaust in a unit test.
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    const check = await checkWriteRate(env, request, 'auth:login');
    if (!check.allowed) {
      deniedAt = attempt;
      retryAfter = check.retryAfterSeconds;
      break;
    }
  }

  assert.equal(deniedAt, 31);
  assert.ok(retryAfter > 0 && retryAfter <= 300);
});

await test('a new window restores the budget', async () => {
  const env = { SESSIONS: makeKV() };
  const request = requestWithIp('203.0.113.8');
  const start = Date.now();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const check = await checkWriteRate(env, request, 'auth:login', null, start);
    assert.equal(check.allowed, true);
  }
  const denied = await checkWriteRate(env, request, 'auth:login', null, start);
  assert.equal(denied.allowed, false);
  const nextWindow = await checkWriteRate(env, request, 'auth:login', null, start + 301_000);
  assert.equal(nextWindow.allowed, true);
});

await test('missing counters degrade open rather than breaking writes', async () => {
  const request = requestWithIp('203.0.113.9');
  const check = await checkWriteRate({}, request, 'games:create', 'user-1');
  assert.equal(check.allowed, true);
  assert.equal(check.enforced, false);
});

console.log(`\n${passed} assertion groups passed`);