// Contrast audit for text on the dark surfaces.
//
// Why this exists as a test rather than a comment: contrast is the easiest thing
// in a stylesheet to regress by accident. Nudging a grey down two hex digits
// looks identical in review and quietly puts text under AA, and nothing on the
// page will complain about it.
//
// The two dark surfaces are different — the site page is #0b0b0b, the play
// shell and every game screen are pure #000000 — and they are checked
// separately. Worth being precise about the direction, because the obvious
// intuition is backwards: pure black is the MORE forgiving background, so any
// grey that clears AA on the site page also clears it on the game screens. The
// greys that were actually failing here, #6f6f6f, failed on both surfaces — it
// was simply a bad grey used only in places nothing else was checking.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SITE_PAGE = '#0b0b0b';
const GAME_BLACK = '#000000';

// WCAG 2.1 relative luminance.
function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// AA thresholds. "Large" is 18.66px, or 14px when bold.
export function requiredRatio(fontSizePx, bold = false) {
  const large = fontSizePx >= 18.66 || (bold && fontSizePx >= 14);
  return large ? 3 : 4.5;
}

// Every text colour used on a dark surface, with the size it is used at.
// Extending this is the point: a new muted grey should be added here rather
// than eyeballed.
const ON_GAME_BLACK = [
  { hex: '#e8e8e8', px: 17, bold: true, where: '.wb-play-rule (rules body)' },
  { hex: '#e8e8e8', px: 15, bold: true, where: '.wb-play-remember strong' },
  { hex: '#e8e8e8', px: 13, bold: true, where: '.pz-btn / game buttons' },
  { hex: '#9a9a9a', px: 13, where: '.wb-play-rules-sub' },
  { hex: '#9a9a9a', px: 12, where: '.wb-play-remember-text span' },
  { hex: '#9a9a9a', px: 13, where: '.wb-play-tagline' },
  { hex: '#9a9a9a', px: 12, where: '.pz-sub' },
  { hex: '#7a7a7a', px: 12, where: '.wb-play-continue' },
  { hex: '#7a7a7a', px: 9, where: '.wl-clue-tag' },
  { hex: '#7a7a7a', px: 9, where: '.wl-credit' },
];

const ON_SITE_PAGE = [
  { hex: '#e8e8e8', px: 24, bold: true, where: '.wb-row-title' },
  { hex: '#e8e8e8', px: 17, bold: true, where: '.wb-card-title' },
  { hex: '#e8e8e8', px: 13, where: '--ink body' },
  { hex: '#8a8a8a', px: 12, where: '--muted' },
  { hex: '#7a7a7a', px: 12, where: '--dim' },
  { hex: '#e8e8e8', px: 13, where: '--control-ink' },
];

// The single brightest neutral in the dark theme. Text, fills, borders and focus
// rings all resolve to this one value, so the theme has exactly one answer to
// "how bright is our foreground" rather than a set of near-identical whites.
export const BRIGHT_NEUTRAL = '#e8e8e8';

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log('contrast on the dark theme');

await test('text on the pure-black play shell clears AA', () => {
  for (const { hex, px, bold, where } of ON_GAME_BLACK) {
    const need = requiredRatio(px, bold);
    const got = contrast(hex, GAME_BLACK);
    assert.ok(
      got >= need,
      `${where}: ${hex} at ${px}px is ${got.toFixed(2)}:1 on black, needs ${need}`,
    );
  }
});

await test('text on the site page clears AA', () => {
  for (const { hex, px, bold, where } of ON_SITE_PAGE) {
    const need = requiredRatio(px, bold);
    const got = contrast(hex, SITE_PAGE);
    assert.ok(
      got >= need,
      `${where}: ${hex} at ${px}px is ${got.toFixed(2)}:1 on ${SITE_PAGE}, needs ${need}`,
    );
  }
});

await test('clearing the site page implies clearing the game screens', () => {
  // The useful invariant, and the opposite of the intuition: #000000 is darker
  // than #0b0b0b, so every light-on-dark grey gains contrast against it. That
  // means the site page is the stricter test, and a colour validated there
  // needs no second check over on a game screen.
  for (let level = 60; level <= 200; level += 5) {
    const hex = `#${level.toString(16).padStart(2, '0').repeat(3)}`;
    assert.ok(
      contrast(hex, GAME_BLACK) >= contrast(hex, SITE_PAGE),
      `${hex} should not be easier to read on black than on the page`,
    );
  }
});

await test('body text clears AAA comfortably, not just AA', () => {
  // The whole point of softening --ink: give up some of a very large surplus
  // rather than approach the threshold. 7:1 is the AAA bar; this should sit well
  // clear of it, and still far below the ~18:1 the old value had.
  const ratio = contrast(BRIGHT_NEUTRAL, SITE_PAGE);
  assert.ok(ratio >= 12, `--ink is only ${ratio.toFixed(2)}:1, expected comfortable headroom over AAA`);
  assert.ok(ratio < 18, '--ink is bright enough to reintroduce the glare problem');
});

await test('the softened neutral is still a light colour, not grey', () => {
  // Guard against a "fix" that quietly drags --ink down toward --muted.
  assert.ok(
    contrast(BRIGHT_NEUTRAL, SITE_PAGE) > contrast('#9a9a9a', SITE_PAGE) * 2,
    '--ink must stay far brighter than the secondary text',
  );
});

await test('#6f6f6f stays out — it fails on both surfaces', () => {
  // Kept as a named check because it is the value that was actually in the
  // stylesheets, and nothing about looking at it says it is wrong.
  const bad = '#6f6f6f';
  assert.ok(contrast(bad, SITE_PAGE) < 4.5, 'fails on the site page');
  assert.ok(contrast(bad, GAME_BLACK) < 4.5, 'fails on the game screens');
  // #7a7a7a is the replacement, and it clears on the stricter of the two.
  assert.ok(contrast('#7a7a7a', SITE_PAGE) >= 4.5);
});

await test('no stylesheet reintroduces the old harsh white as a value', () => {
  // Scans for the literal as a DECLARATION, ignoring comments. The old
  // #f2f2f2 still appears in prose explaining why it was replaced, and that
  // must not trip this.
  const files = [
    '../src/index.css',
    '../src/App.css',
    '../src/sitebar.css',
    '../src/games/word-lock/WordLock.css',
    '../src/games/memory-match/PairVault.css',
    '../src/games/odd-spot/OddSpot.css',
    '../src/games/player-quiz/PlayerQuiz.css',
  ];
  for (const file of files) {
    const stripped = readFileSync(new URL(file, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(
      !stripped.includes('#f2f2f2'),
      `${file} still uses #f2f2f2 as a value`,
    );
  }
});

await test('the two dark surfaces are deliberately different', () => {
  // Not a style opinion — a check that nobody "tidied" the game screens to
  // #0b0b0b by accident. Pure black is what keeps OLED pixels off during play.
  assert.notEqual(GAME_BLACK, SITE_PAGE);
  const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');
  assert.ok(
    css.includes('background: #000000;'),
    'the play shell should still be pure black',
  );
});

console.log(`\n${passed} assertion groups passed`);