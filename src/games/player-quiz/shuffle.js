// Quiz presentation rules, kept free of React so the option shuffle and the
// answer remap can be tested without mounting the component.

/**
 * Return a shuffled copy of `items`.
 *
 * Does NOT mutate the input. Callers hold indexes into the original array and
 * use the returned permutation to look values up, so a shuffle that sorted the
 * array in place would silently rewrite the answer key.
 *
 * `j` is clamped into range. `Math.random()` is documented as returning
 * [0, 1) so this cannot happen in a browser — but this function takes an
 * injectable RNG, and a stubbed one returning exactly 1 would otherwise index
 * past the end of the array and splice `undefined` into the questions. Clamping
 * costs one comparison and makes the function total.
 */
export function shuffle(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const raw = Math.floor(random() * (i + 1));
    const j = raw < 0 ? 0 : raw > i ? i : raw;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Present one question with its options shuffled and the correct answer moved
 * alongside them.
 *
 * The shuffle returns a PERMUTATION, never a re-ordered copy of the answers.
 * Remapping the correct answer by index is what stops "answer: 2" from pointing
 * at the wrong option once the order changes — which is the single easiest bug
 * to write here and the hardest to notice by eye.
 */
export function prepareQuestion(question, random = Math.random) {
  const order = shuffle(
    Array.from({ length: question.options.length }, (_, i) => i),
    random,
  );
  return {
    prompt: question.prompt,
    options: order.map((i) => question.options[i]),
    // Position of the right answer AFTER the shuffle.
    answer: order.indexOf(question.answer),
  };
}