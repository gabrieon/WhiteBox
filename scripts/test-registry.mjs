// Node tests for the built-in game registry. Run with npm test.

import assert from 'node:assert/strict';
import { builtinIds, isPlayable, listGames } from '../src/games/registry.js';
import { validateManifest } from '../src/sdk/manifest.js';

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log('game registry');

await test('ships the expected playable built-ins', () => {
  assert.deepEqual(builtinIds(), ['word-lock', 'pair-vault', 'odd-spot']);
  for (const game of listGames()) {
    assert.equal(isPlayable(game), true);
    assert.equal(typeof game.loader, 'function');
  }
});

await test('every registered manifest validates', () => {
  for (const game of listGames()) {
    const { valid, errors } = validateManifest(game);
    assert.equal(valid, true, errors.join('; '));
  }
});

await test('searchable metadata is present for discovery', () => {
  for (const game of listGames()) {
    assert.ok(game.title && game.description);
    assert.ok(Array.isArray(game.categories) && game.categories.length > 0);
    assert.ok(Array.isArray(game.tags) && game.tags.length > 0);
  }
});

console.log(`\n${passed} assertion groups passed`);
