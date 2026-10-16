// Node tests for site-wide library search. Run with npm test.

import assert from 'node:assert/strict';
import { matchesGameText } from '../src/sdk/games/search.js';

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const game = {
  title: 'Pair Vault',
  description: 'Sixteen cards, eight pairs.',
  categories: ['Memory', 'Puzzle'],
  tags: ['pairs', 'solo'],
  mode: 'Solo',
  playModes: ['single'],
  creatorName: 'Ava',
};

console.log('library search');

await test('an empty query matches everything', () => {
  assert.equal(matchesGameText(game, ''), true);
  assert.equal(matchesGameText(game, '   '), true);
});

await test('matches titles and descriptions', () => {
  assert.equal(matchesGameText(game, 'vault'), true);
  assert.equal(matchesGameText(game, 'sixteen cards'), true);
});

await test('matches categories, tags, modes, and creators', () => {
  assert.equal(matchesGameText(game, 'memory'), true);
  assert.equal(matchesGameText(game, 'solo'), true);
  assert.equal(matchesGameText(game, 'ava'), true);
  assert.equal(matchesGameText(game, 'memory solo'), true);
});

await test('requires every query word and tolerates missing fields', () => {
  assert.equal(matchesGameText(game, 'memory typing'), false);
  assert.equal(matchesGameText({ title: 'Odd Spot' }, 'visual'), false);
  assert.equal(matchesGameText(null, 'vault'), false);
});

console.log(`\n${passed} assertion groups passed`);
