// Tests for AI artwork generation.
//
// What is worth testing here is not the happy path — that is Gemini's job. It is
// the three things standing between a player and the site's shared API quota:
// ownership of the game, the prompt bounds, and the daily allowance.

import assert from 'node:assert/strict';
import {
  DEFAULT_DAILY_LIMIT,
  MAX_PROMPT_LENGTH,
  dailyLimit,
  generationUsage,
  pacificDayStart,
  parsePrompt,
  quotaStatus,
  reserveGeneration,
} from '../worker/src/artwork.js';

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

/**
 * Minimal D1 stand-in for the generation ledger.
 *
 * `rows` is the whole table. `failReads` makes the counter unreadable, which is
 * the case that matters: it is the difference between a working quota and no
 * quota at all.
 */
function ledgerEnv(rows = [], { failReads = false } = {}) {
  return {
    rows,
    env: {
      GAMES: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async first() {
                  if (sql.includes('COUNT(*)')) {
                    if (failReads) throw new Error('d1 unavailable');
                    const n = rows.filter(
                      (r) => r.user_id === args[0] && r.created_at >= args[1],
                    ).length;
                    return { n };
                  }
                  throw new Error(`unmocked: ${sql}`);
                },
                async run() {
                  if (sql.startsWith('INSERT INTO artwork_generations')) {
                    rows.push({
                      user_id: args[1], game_id: args[2], created_at: args[3],
                    });
                    return { meta: { changes: 1 } };
                  }
                  throw new Error(`unmocked: ${sql}`);
                },
              };
            },
          };
        },
      },
    },
  };
}

const NOW = Date.UTC(2026, 9, 16, 18, 0, 0);

console.log('quota window');

await test('resets at midnight Pacific, matching Gemini', () => {
  // 18:00 UTC is 10:00 Pacific (UTC-8). The window must start at Pacific
  // midnight, not UTC midnight, or the two counters disagree for most of a day.
  const start = pacificDayStart(NOW);
  assert.equal(start, Date.UTC(2026, 9, 16, 8, 0, 0));
  // A call just before Pacific midnight belongs to the previous day.
  assert.equal(
    pacificDayStart(Date.UTC(2026, 9, 17, 7, 59, 0)),
    Date.UTC(2026, 9, 16, 8, 0, 0),
  );
  assert.equal(
    pacificDayStart(Date.UTC(2026, 9, 17, 8, 0, 0)),
    Date.UTC(2026, 9, 17, 8, 0, 0),
  );
});

console.log('daily allowance');

await test('counts only this account, since the window opened', async () => {
  const { env, rows } = ledgerEnv();
  const start = pacificDayStart(NOW);
  rows.push(
    { user_id: 'me', game_id: 'a', created_at: NOW - 1000 },
    { user_id: 'me', game_id: 'b', created_at: NOW - 2000 },
    // Someone else spending their own allowance is not my problem.
    { user_id: 'someone-else', game_id: 'c', created_at: NOW - 1000 },
    // Mine, but from before today's window opened.
    { user_id: 'me', game_id: 'd', created_at: start - 1000 },
  );

  const quota = await quotaStatus(env, 'me', NOW);
  assert.equal(quota.used, 2);
  assert.equal(quota.limit, DEFAULT_DAILY_LIMIT);
  assert.equal(quota.remaining, DEFAULT_DAILY_LIMIT - 2);
  assert.equal(quota.allowed, true);
});

await test('refuses once the allowance is spent', async () => {
  const rows = Array.from({ length: DEFAULT_DAILY_LIMIT }, (_, i) => ({
    user_id: 'me', game_id: `g${i}`, created_at: NOW - i,
  }));
  const { env } = ledgerEnv(rows);

  const quota = await quotaStatus(env, 'me', NOW);
  assert.equal(quota.allowed, false);
  assert.equal(quota.remaining, 0);
});

await test('the limit is configurable and ignores nonsense', async () => {
  assert.equal(dailyLimit({ ARTWORK_DAILY_LIMIT: '3' }), 3);
  assert.equal(dailyLimit({}), DEFAULT_DAILY_LIMIT);
  for (const bad of ['0', '-5', 'abc', '', '2.5']) {
    assert.equal(
      dailyLimit({ ARTWORK_DAILY_LIMIT: bad }),
      DEFAULT_DAILY_LIMIT,
      `ARTWORK_DAILY_LIMIT=${bad} should fall back`,
    );
  }
});

await test('a reservation is visible to the next check immediately', async () => {
  // This is the property that makes the cap un-raceable: the read and the
  // insert land on the same strongly consistent store, so a concurrent request
  // cannot both read the pre-reservation count.
  const { env } = ledgerEnv();
  assert.equal((await quotaStatus(env, 'me', NOW)).remaining, DEFAULT_DAILY_LIMIT);
  assert.equal(await reserveGeneration(env, 'me', 'game-1', NOW), true);
  assert.equal((await quotaStatus(env, 'me', NOW)).remaining, DEFAULT_DAILY_LIMIT - 1);
});

await test('an unreadable ledger fails CLOSED', async () => {
  // Fail-open here would mean: during a D1 outage, every account gets a fresh
  // allowance, and the site burns through the shared quota exactly when it is
  // already unhealthy.
  const { env } = ledgerEnv([], { failReads: true });
  // The handler logs, as it must in production. Silenced here so a deliberate
  // failure does not put a scary line in CI.
  const realError = console.error;
  console.error = () => {};
  try {
    const quota = await quotaStatus(env, 'me', NOW);
    assert.equal(quota.allowed, false);
    assert.equal(quota.enforced, true);
  } finally {
    console.error = realError;
  }
});

await test('a missing database fails closed and cannot be reserved', async () => {
  const quota = await quotaStatus({}, 'me', NOW);
  assert.equal(quota.allowed, false);
  assert.equal(await reserveGeneration({}, 'me', 'g', NOW), false);
});

await test('usage reports the same numbers as the check', async () => {
  const { env } = ledgerEnv();
  const usage = await generationUsage(env, 'me', NOW);
  assert.deepEqual(usage, {
    used: 0, limit: DEFAULT_DAILY_LIMIT, remaining: DEFAULT_DAILY_LIMIT,
  });
});

console.log('prompts');

await test('accepts and trims an ordinary prompt', () => {
  assert.equal(parsePrompt('  a red cube  '), 'a red cube');
});

await test('strips control characters', () => {
  // These survive a length check and then corrupt whatever renders or logs the
  // prompt, so they are removed rather than trusted.
  assert.equal(parsePrompt('a red\ncube\u0000\u0007 here'), 'a redcube here');
});

await test('refuses an empty or oversized prompt', () => {
  assert.throws(() => parsePrompt('   '), /prompt_required/);
  assert.throws(() => parsePrompt(123), /prompt_invalid/);
  assert.throws(() => parsePrompt(null), /prompt_invalid/);
  assert.throws(() => parsePrompt('x'.repeat(MAX_PROMPT_LENGTH + 1)), /prompt_too_long/);
  // The boundary itself is allowed; off-by-one here rejects legitimate prompts.
  assert.equal(parsePrompt('x'.repeat(MAX_PROMPT_LENGTH)).length, MAX_PROMPT_LENGTH);
});

console.log(`\n${passed} assertion groups passed`);