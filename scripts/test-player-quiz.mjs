// Node tests for the quiz runtime's presentation logic.
//
// The one thing worth testing here is the answer remap. Storing the correct
// answer as an index is only safe if the index is moved ALONGSIDE the shuffled
// options. Shuffle the options and forget to move the answer, and the quiz
// marks a correct answer wrong — which looks like a data bug in the creator's
// content rather than a bug in the runtime, and is miserable to trace.

import assert from 'node:assert/strict';
import { prepareQuestion, shuffle } from '../src/games/player-quiz/shuffle.js';
import { quizProblems, toPayload, newQuestion } from '../src/sdk/games/quiz.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

function question(prompt, options, answer) {
  return { prompt, options, answer };
}

const OPTS = ['Alpha', 'Beta', 'Gamma', 'Delta'];

console.log('shuffle');

test('does not mutate its input', () => {
  const input = [0, 1, 2, 3];
  shuffle(input, () => 0);
  assert.deepEqual(input, [0, 1, 2, 3]);
});

test('returns a permutation of its input', () => {
  // Sweeps the WHOLE [0, 1] range, including exactly 1. `Math.random()` never
  // returns 1, but this function takes an injectable RNG, and an unclamped
  // index there would splice `undefined` into the questions.
  for (let step = 0; step <= 50; step += 1) {
    const out = shuffle([0, 1, 2, 3], () => step / 50);
    assert.deepEqual([...out].sort((a, b) => a - b), [0, 1, 2, 3], `at random()=${step / 50}`);
  }
  for (const bad of [-0.5, 0, 1, 2, 5]) {
    const out = shuffle([0, 1, 2, 3], () => bad);
    assert.deepEqual([...out].sort((a, b) => a - b), [0, 1, 2, 3], `at random()=${bad}`);
  }
});

test('actually reorders, rather than returning the input by luck', () => {
  // 500 draws: if this never differs from the identity, the swap never runs.
  const seen = new Set();
  for (let i = 0; i < 500; i += 1) {
    seen.add(shuffle([0, 1, 2, 3]).join(','));
  }
  // 4! = 24 orderings. Anything in the high teens or above proves the shuffle
  // is live without asserting an exact distribution.
  assert.ok(seen.size > 12, `only ${seen.size} distinct orderings — is shuffle running?`);
});

console.log('answer remap');

test('the correct option is still correct after shuffling', () => {
  // Every possible original answer position, many shuffles each. If the remap
  // is wrong for even one position, this fails.
  for (let answer = 0; answer < 4; answer += 1) {
    for (let i = 0; i < 200; i += 1) {
      const shown = prepareQuestion(question('Q', OPTS, answer));
      assert.equal(shown.answer, shown.options.indexOf(OPTS[answer]));
      assert.equal(shown.options[shown.answer], OPTS[answer]);
    }
  }
});

test('the shuffle is applied to options, not to the answer alone', () => {
  const shown = prepareQuestion(question('Q', OPTS, 1), () => 0.9);
  assert.equal(shown.prompt, 'Q');
  assert.equal(shown.options.length, 4);
  assert.ok(shown.answer >= 0 && shown.answer < 4);
});

console.log('authoring rules');

test('a fresh question is structurally valid', () => {
  const q = newQuestion();
  assert.equal(q.options.length, 4);
  assert.equal(q.answer, 0);
  // It is invalid as CONTENT, but its shape must never be the thing that fails.
  assert.ok(quizProblems([q, q]).some((p) => p.includes('needs a prompt')));
});

test('an empty quiz reports the minimum first', () => {
  const problems = quizProblems([]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /at least 2 questions/);
});

test('catches every failure mode the server would reject', () => {
  const [a, b] = [
    question('Capital of France?', OPTS, 0),
    question('Capital of France?', OPTS, 1),
  ];
  const problems = quizProblems([a, b]);
  assert.ok(problems.some((p) => /repeats an earlier question/.test(p)));

  // Every check needs a quiz of legal length first: quizProblems short-circuits
  // on "too few questions" rather than piling on per-question advice the
  // creator cannot act on until the count is fixed.
  const short = quizProblems([
    question('Q one?', ['a', 'b', 'c'], 0),
    question('Q two?', OPTS, 0),
  ]);
  assert.ok(short.some((p) => /exactly 4 options/.test(p)), short.join(' | '));

  const dupe = quizProblems([
    question('Q one?', ['a', 'a', 'b', 'c'], 0),
    question('Q two?', OPTS, 0),
  ]);
  assert.ok(dupe.some((p) => /two identical options/.test(p)));

  const noAnswer = quizProblems([
    question('Q one?', OPTS, 9),
    question('Q two?', OPTS, 0),
  ]);
  assert.ok(noAnswer.some((p) => /no correct answer marked/.test(p)));

  const empty = quizProblems([
    question('  ', OPTS, 0),
    question('Q two?', OPTS, 0),
  ]);
  assert.ok(empty.some((p) => /needs a prompt/.test(p)));
});

test('a good quiz reports nothing', () => {
  const good = [
    question('Capital of France?', OPTS, 0),
    question('Capital of Spain?', ['Madrid', 'Lisbon', 'Rome', 'Berlin'], 0),
  ];
  assert.deepEqual(quizProblems(good), []);
});

test('the payload trims whitespace and matches the server shape', () => {
  const payload = toPayload([
    { prompt: '  Q?  ', options: ['  a ', 'b ', ' c', 'd '], answer: 2 },
  ]);
  assert.equal(payload.questions[0].prompt, 'Q?');
  assert.deepEqual(payload.questions[0].options, ['a', 'b', 'c', 'd']);
  assert.equal(payload.questions[0].answer, 2);
});

console.log(`\n${passed} assertion groups passed`);