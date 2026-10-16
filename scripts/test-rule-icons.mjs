// Node tests for the rules screen's icon declarations.
//
// `ruleIcons` lines up positionally with `rules`. Nothing validates that at
// runtime: a game that declares three icons for five rules, or misspells a name,
// still renders — it just shows the fallback glyph, or leaves a hole in the
// row's alignment. That failure is invisible in review and annoying later, so it
// is checked here instead.

import assert from 'node:assert/strict';
import { RULE_ICON_FALLBACK, RULE_ICON_NAMES } from '../src/components/play/ruleIcons.js';
import wordLock from '../src/games/word-lock/manifest.js';
import pairVault from '../src/games/memory-match/manifest.js';
import oddSpot from '../src/games/odd-spot/manifest.js';

const games = [wordLock, pairVault, oddSpot];

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log('rules icons');

test('every game declares one icon per rule', () => {
  for (const game of games) {
    const rules = game.rules || [];
    assert.ok(rules.length > 0, `${game.id} has no rules`);
    assert.ok(
      Array.isArray(game.ruleIcons),
      `${game.id} declares no ruleIcons`,
    );
    // Exact, not "at least": a short array silently drops icons for the tail
    // rules, which is precisely the bug this test exists to catch.
    assert.equal(
      game.ruleIcons.length,
      rules.length,
      `${game.id}: ${rules.length} rules but ${game.ruleIcons.length} icons`,
    );
  }
});

test('every icon names a glyph that exists', () => {
  for (const game of games) {
    for (const name of game.ruleIcons) {
      assert.ok(
        RULE_ICON_NAMES.includes(name),
        `${game.id} uses unknown icon "${name}"`,
      );
    }
  }
});

test('the fallback glyph is itself in the set', () => {
  // If this ever drifts, RuleIcon renders `undefined` into an <svg> and the
  // icon silently disappears.
  assert.ok(RULE_ICON_NAMES.includes(RULE_ICON_FALLBACK));
});

test('no rule is an empty string', () => {
  // An empty rule still renders a row — a 42px icon beside nothing, which
  // looks like a bug to the player.
  for (const game of games) {
    for (const rule of game.rules) {
      assert.ok(rule.trim().length > 0, `${game.id} has an empty rule`);
    }
  }
});

test('no two games declare the same rules verbatim', () => {
  // Cheap guard against a copy-pasted rules array slipping into a second game.
  const seen = new Map();
  for (const game of games) {
    const key = game.rules.join('|');
    assert.equal(seen.has(key), false, `${game.id} duplicates ${seen.get(key)}'s rules`);
    seen.set(key, game.id);
  }
});

console.log(`\n${passed} assertion groups passed`);