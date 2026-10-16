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

const words = {
  title: 'WordLock',
  description: 'Six guesses, five letters, one word.',
  categories: ['Words', 'Puzzle'],
  tags: ['word', 'daily', 'solo', 'keyboard'],
};

const visual = {
  title: 'Odd Spot',
  description: 'Nine tiles, one impostor.',
  categories: ['Visual', 'Puzzle'],
  tags: ['visual', 'perception', 'solo', 'touch'],
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

console.log('synonyms');

await test("finds games by the player's word for them", () => {
  // None of these words appear in the word game's text; all of them expand to
  // ones that do.
  for (const q of ['words', 'spelling', 'vocabulary', 'letters']) {
    assert.equal(matchesGameText(words, q), true, `"${q}" should find the word game`);
  }
  assert.equal(matchesGameText(game, 'remember'), true);
  assert.equal(matchesGameText(game, 'recall'), true);
  assert.equal(matchesGameText(words, 'typing'), true);
  assert.equal(matchesGameText(game, 'alone'), true);
});

await test('synonyms do not leak across games', () => {
  // "typing" is a keyboard word. It must not start matching the memory game
  // just because both are solo puzzlers.
  assert.equal(matchesGameText(game, 'typing'), false);
  assert.equal(matchesGameText(words, 'remember'), false);
});

console.log('typo tolerance');

await test('survives the common typo shapes', () => {
  assert.equal(matchesGameText(game, 'memroy'), true); // transposition
  assert.equal(matchesGameText(game, 'memoryy'), true); // doubling
  assert.equal(matchesGameText(game, 'memry'), true); // dropped letter
  assert.equal(matchesGameText(words, 'wordlok'), true);
  assert.equal(matchesGameText(visual, 'visaul'), true);
});

await test('short words stay exact', () => {
  // At three letters, distance 1 matches a quarter of the dictionary. "ava"
  // the creator must not match "axe", "air", "ape".
  assert.equal(matchesGameText(game, 'avi'), false);
  assert.equal(matchesGameText(game, 'xyz'), false);
});

await test('a wrong word still matches nothing', () => {
  assert.equal(matchesGameText(game, 'banana'), false);
  assert.equal(matchesGameText(game, 'memory banana'), false);
});

console.log(`\n${passed} assertion groups passed`);
