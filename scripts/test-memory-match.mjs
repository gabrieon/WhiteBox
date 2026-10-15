// Node tests for the second built-in game's matching rules. Run with npm test.

import assert from 'node:assert/strict';
import {
  PAIR_COUNT,
  PAIR_SYMBOLS,
  createBoard,
  isBoardSolved,
  isMatch,
} from '../src/games/memory-match/logic.js';

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log('pair vault');

await test('builds two copies of every selected symbol', () => {
  const board = createBoard({ pairs: 4, random: () => 0.999999 });
  assert.equal(board.length, 8);
  const counts = {};
  for (const card of board) counts[card.symbol] = (counts[card.symbol] || 0) + 1;
  assert.deepEqual(counts, { A: 2, B: 2, C: 2, D: 2 });
  assert.equal(new Set(board.map((card) => card.id)).size, 8);
});

await test('rejects an impossible board before shuffling', () => {
  assert.throws(() => createBoard({ pairs: 1 }), /pairs must be an integer/);
  assert.throws(
    () => createBoard({ pairs: PAIR_SYMBOLS.length + 1 }),
    /pairs must be an integer/,
  );
});

await test('matches only two different cards with one symbol', () => {
  const board = [
    { id: '0-a', symbol: 'A' },
    { id: '0-b', symbol: 'A' },
    { id: '1-a', symbol: 'B' },
  ];
  assert.equal(isMatch('0-a', '0-b', board), true);
  assert.equal(isMatch('0-a', '0-a', board), false);
  assert.equal(isMatch('0-a', '1-a', board), false);
  assert.equal(isMatch('0-a', 'missing', board), false);
});

await test('solves only when all positions are matched', () => {
  const board = [
    { id: '0-a', symbol: 'A' },
    { id: '0-b', symbol: 'A' },
  ];
  assert.equal(isBoardSolved(board, ['0-a']), false);
  assert.equal(isBoardSolved(board, ['0-a', '0-b']), true);
  assert.equal(isBoardSolved([], []), false);
});

await test('the default pool matches the advertised round size', () => {
  assert.equal(PAIR_SYMBOLS.length, PAIR_COUNT);
  assert.equal(createBoard().length, PAIR_COUNT * 2);
});

console.log(`\n${passed} assertion groups passed`);