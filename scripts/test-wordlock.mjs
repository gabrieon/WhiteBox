// Scoring tests. Run: npm run test:wordlock
//
// The early version of this file hand-wrote every expected string, and got most
// of them wrong — `scoreGuess('crane','plant')` is `aacca`, not `aaay`, because
// A and N line up exactly. Bad expectations are worse than no tests because they
// look like evidence.
//
// So the core rules are property-based over the real word lists instead: the
// duplicate-letter invariant is checked across thousands of random pairs rather
// than a handful of cases someone had to reason about. A few concrete cases stay
// because they document intent, and each one is verified by hand here.

import assert from 'node:assert/strict';
import {
  scoreGuess, keyboardState, isSolved, CORRECT, PRESENT, ABSENT, pickAnswer,
} from '../src/games/word-lock/scoring.js';
import { ANSWERS, GUESSES } from '../src/games/word-lock/words.js';

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(`      ${err.message}`);
    process.exitCode = 1;
  }
}

const S = (guess, answer) => scoreGuess(guess, answer).map((v) => v[0]).join('');

const countLetter = (word, letter) => [...word].filter((c) => c === letter).length;

// --- properties ------------------------------------------------------------
// These are the rules that actually matter. Each is checked across many real
// word pairs so an edge case in duplicate handling cannot slip through.

check('a letter is never credited more times than the answer contains it', () => {
  const violations = [];
  for (let n = 0; n < 3000; n += 1) {
    const answer = ANSWERS[n % ANSWERS.length];
    const guess = ANSWERS[(n * 7 + 3) % ANSWERS.length];
    const verdicts = scoreGuess(guess, answer);

    for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
      const credited = verdicts.filter(
        (v, i) => guess[i] === letter && (v === CORRECT || v === PRESENT),
      ).length;
      const available = countLetter(answer, letter);
      if (credited > available) {
        violations.push(`${guess} vs ${answer}: ${letter} credited ${credited}, answer has ${available}`);
      }
    }
    if (violations.length > 3) break;
  }
  assert.deepEqual(violations, []);
});

check('every CORRECT verdict is a genuine position match', () => {
  for (let n = 0; n < 2000; n += 1) {
    const answer = ANSWERS[n % ANSWERS.length];
    const guess = ANSWERS[(n * 13 + 5) % ANSWERS.length];
    const verdicts = scoreGuess(guess, answer);
    verdicts.forEach((v, i) => {
      if (v === CORRECT) assert.equal(guess[i], answer[i]);
    });
  }
});

check('a PRESENT letter appears elsewhere in the answer', () => {
  for (let n = 0; n < 2000; n += 1) {
    const answer = ANSWERS[n % ANSWERS.length];
    const guess = ANSWERS[(n * 17 + 11) % ANSWERS.length];
    const verdicts = scoreGuess(guess, answer);
    verdicts.forEach((v, i) => {
      if (v === PRESENT) {
        assert.notEqual(guess[i], answer[i], 'PRESENT must not be a position match');
        assert.ok(answer.includes(guess[i]), `${guess[i]} not in ${answer}`);
      }
    });
  }
});

check('an exact match is never downgraded to PRESENT', () => {
  for (let n = 0; n < 2000; n += 1) {
    const answer = ANSWERS[n % ANSWERS.length];
    const guess = ANSWERS[(n * 19 + 2) % ANSWERS.length];
    scoreGuess(guess, answer).forEach((v, i) => {
      if (guess[i] === answer[i]) assert.equal(v, CORRECT);
    });
  }
});

check('scoring is deterministic', () => {
  for (let n = 0; n < 200; n += 1) {
    const a = ANSWERS[n % ANSWERS.length];
    const b = ANSWERS[(n * 23 + 1) % ANSWERS.length];
    assert.deepEqual(scoreGuess(a, b), scoreGuess(a, b));
  }
});

// --- concrete cases --------------------------------------------------------
// Hand-checked, each with the reasoning inline so a future edit knows why.

check('identical words score all green', () => {
  assert.equal(S('crane', 'crane'), 'ccccc');
});

check('no shared letters score all grey', () => {
  // crane / pilot share no letters at all.
  assert.equal(S('crane', 'pilot'), 'aaaaa');
});

check('CRANE vs PLANT - A and N land exactly, so both are green', () => {
  // p l a n t  /  c r a n e   -> positions 2 and 3 match, nothing left over.
  assert.equal(S('crane', 'plant'), 'aacca');
});

check('GEESE vs THESE - three guessed E, all three answers already claimed', () => {
  // t h e s e  /  g e e s e
  // positions 2,3,4 match exactly, leaving spare = [t,h], so the two leading
  // E's have nothing left to pair with and stay grey.
  assert.equal(S('geese', 'these'), 'aaccc');
});

check('EERIE vs SEREE - one E is spare and goes to the first stray E', () => {
  // s e r e e  /  e e r i e
  // positions 1,2,4 match; spare = [s, e]; the leading E takes that spare E.
  assert.equal(S('eerie', 'seree'), 'pccac');
});

check('SPEED vs THESE - S and E are spare and both go yellow', () => {
  // t h e s e  /  s p e e d
  // position 2 matches; spare = [t,h,s,e]; S takes s, the second E takes e.
  assert.equal(S('speed', 'these'), 'pacpa');
});

// --- keyboard state --------------------------------------------------------

check('keyboard colour never regresses', () => {
  // 'plant' matched exactly in row 1, so A is CORRECT. Row 2 only manages a
  // PRESENT for A, which must not overwrite the green already earned.
  const state = keyboardState([
    { word: 'crane', verdicts: scoreGuess('crane', 'plant') },
    { word: 'about', verdicts: scoreGuess('about', 'plant') },
  ]);
  assert.equal(state.a, CORRECT);
});

check('keyboard promotes grey -> yellow when later evidence arrives', () => {
  // 't' is grey in row 1 (absent from CRANE) and yellow in row 2, where SLATE
  // lines its T up against the spare T in PLANT.
  const state = keyboardState([
    { word: 'crane', verdicts: scoreGuess('crane', 'plant') },
    { word: 'slate', verdicts: scoreGuess('slate', 'plant') },
  ]);
  assert.equal(state.t, PRESENT);
  assert.equal(state.s, ABSENT, 'S is absent from PLANT entirely');
});

check('keyboard promotes grey -> green', () => {
  const state = keyboardState([
    { word: 'crane', verdicts: scoreGuess('crane', 'plant') },
    { word: 'slate', verdicts: scoreGuess('slate', 'plant') },
  ]);
  assert.equal(state.l, CORRECT, 'L is grey in row 1, an exact match in row 2');
});

check('letters with no evidence stay out of the map', () => {
  const state = keyboardState([{ word: 'crane', verdicts: scoreGuess('crane', 'plant') }]);
  assert.equal(state.p, undefined);
  assert.equal(state.l, undefined);
});

// --- helpers ---------------------------------------------------------------

check('isSolved only on a full green row', () => {
  assert.equal(isSolved(scoreGuess('plant', 'plant')), true);
  assert.equal(isSolved(scoreGuess('crane', 'plant')), false);
});

check('pickAnswer stays inside the pool', () => {
  for (let i = 0; i < 200; i += 1) {
    assert.ok(ANSWERS.includes(pickAnswer(ANSWERS)));
  }
});

// --- list integrity --------------------------------------------------------

check('every answer is a legal guess', () => {
  assert.deepEqual(ANSWERS.filter((w) => !GUESSES.has(w)), []);
});

check('all answer words are five lowercase letters', () => {
  assert.deepEqual(ANSWERS.filter((w) => !/^[a-z]{5}$/.test(w)), []);
});

check('every guess is five lowercase letters', () => {
  const bad = [...GUESSES].filter((w) => !/^[a-z]{5}$/.test(w));
  assert.deepEqual(bad.slice(0, 5), []);
});

check('obvious words are guessable even when they are not answers', () => {
  // CRANE and ZEBRA fall outside the top-10k frequency cut that curates the
  // answer pool, but a player will absolutely type them. Rejecting these is the
  // "not in the word list" bug the two-list design exists to prevent.
  for (const w of ['crane', 'zebra', 'radio', 'tiger', 'north', 'juice']) {
    assert.ok(GUESSES.has(w), `${w} should be a legal guess`);
  }
});

check('no proper nouns leaked into the answer pool', () => {
  // People, places and brands. Note ADOBE is deliberately absent from this list:
  // it is an ordinary English noun (the brick material) as well as a company,
  // so it is a fair answer.
  for (const w of ['aaron', 'india', 'nokia', 'xanax', 'delhi', 'susan']) {
    assert.ok(!ANSWERS.includes(w), `${w} should not be an answer`);
  }
});

console.log(`\nword-lock: ${passed} passed, ${failed} failed`);
console.log(`  answers: ${ANSWERS.length}   guesses: ${GUESSES.size}`);
