// Node tests for WORDLOCK sharing and streaks. Run with npm run test:wordlock.

import assert from 'node:assert/strict';
import {
  readStats,
  recordResult,
  resultGrid,
  shareText,
} from '../src/games/word-lock/share.js';

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

function memoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
  };
}

console.log('wordlock sharing');

await test('renders an emoji board without revealing the answer', () => {
  const grid = resultGrid([
    { word: 'crane', verdicts: ['absent', 'absent', 'correct', 'absent', 'present'] },
    { word: 'adult', verdicts: ['correct', 'correct', 'correct', 'correct', 'correct'] },
  ]);
  assert.equal(grid, '⬛⬛🟩⬛🟨\n🟩🟩🟩🟩🟩');
  assert.ok(!grid.includes('crane') && !grid.includes('adult'));
});

await test('shares score, streak, and a replay link', () => {
  const text = shareText({
    won: true,
    guesses: [{ word: 'x', verdicts: ['correct'] }],
    elapsedLabel: '0:42.3',
    streak: 4,
    url: 'https://rarelyknown.in/#/play/word-lock',
  });
  assert.ok(text.includes('WORDLOCK 1/6 · 0:42.3'));
  assert.ok(text.includes('Streak: 4'));
  assert.ok(text.includes('https://rarelyknown.in/#/play/word-lock'));
});

await test('records wins, streaks, and best marks', () => {
  const storage = memoryStorage();
  recordResult({ won: true, guesses: 4, elapsedMs: 42300 }, storage);
  recordResult({ won: true, guesses: 3, elapsedMs: 51200 }, storage);
  const stats = readStats(storage);
  assert.deepEqual(
    [stats.played, stats.won, stats.currentStreak, stats.bestStreak],
    [2, 2, 2, 2],
  );
  assert.equal(stats.bestGuesses, 3);
  assert.equal(stats.bestTimeMs, 42300);
});

await test('a loss resets the live streak but keeps the best', () => {
  const storage = memoryStorage();
  recordResult({ won: true, guesses: 3, elapsedMs: 40000 }, storage);
  const stats = recordResult({ won: false }, storage);
  assert.equal(stats.currentStreak, 0);
  assert.equal(stats.bestStreak, 1);
  assert.equal(stats.played, 2);
});

await test('corrupt stored stats fall back to empty', () => {
  const stats = readStats(memoryStorage({ 'whitebox:word-lock-stats': '{oops' }));
  assert.equal(stats.played, 0);
  assert.equal(stats.currentStreak, 0);
});

console.log(`\n${passed} assertion groups passed`);