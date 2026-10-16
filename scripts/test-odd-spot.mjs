// Node tests for the third built-in game's round rules. Run with npm test.

import assert from 'node:assert/strict';
import {
  CELL_COUNT,
  GLYPH_PAIRS,
  ROUND_COUNT,
  createRound,
  isOddTap,
  scoreGame,
} from '../src/games/odd-spot/logic.js';

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log('odd spot');

await test('builds one odd tile among common tiles', () => {
  const round = createRound({ round: 0, random: () => 0.1 });
  assert.equal(round.tiles.length, CELL_COUNT);
  assert.equal(round.tiles.filter((tile) => tile === round.common).length, CELL_COUNT - 1);
  assert.equal(round.tiles.filter((tile) => tile === round.odd).length, 1);
  assert.equal(round.tiles[round.oddIndex], round.odd);
});

await test('cycles glyph pairs while keeping the odd position random', () => {
  const first = createRound({ round: 0, random: () => 0 });
  const nextCycle = createRound({ round: GLYPH_PAIRS.length, random: () => 0 });
  assert.deepEqual([first.common, first.odd], [nextCycle.common, nextCycle.odd]);
  assert.equal(createRound({ round: 1, random: () => 0.99 }).oddIndex, CELL_COUNT - 1);
});

await test('rejects unusable round shapes before dealing tiles', () => {
  assert.throws(() => createRound({ round: -1 }), /non-negative integer/);
  assert.throws(() => createRound({ cells: 1 }), /integer >= 2/);
});

await test('only the odd position wins a round', () => {
  const round = createRound({ round: 2, random: () => 0.5 });
  assert.equal(isOddTap(round, round.oddIndex), true);
  assert.equal(isOddTap(round, (round.oddIndex + 1) % CELL_COUNT), false);
  assert.equal(isOddTap(round, -1), false);
  assert.equal(isOddTap(null, 0), false);
});

await test('scores accuracy from misses, with time as context', () => {
  assert.deepEqual(scoreGame({ misses: 0, elapsedMs: 12000 }), {
    rounds: ROUND_COUNT, misses: 0, elapsedMs: 12000, accuracy: 100,
  });
  assert.equal(scoreGame({ misses: 10, elapsedMs: 45000 }).accuracy, 50);
});

console.log(`\n${passed} assertion groups passed`);
