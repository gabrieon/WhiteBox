// Guess scoring, kept free of React so the rule can be tested on its own.
//
// The hard part is duplicate letters. Guessing "GEESE" against "THESE" must not
// award a green E just because the word contains three of them — one of those
// Es is already spoken for by a letter that matched exactly.
//
// The fix is two passes. The first claims every exact position match. The second
// deals out "present" letters only from what is left over, and only where they
// would land in the wrong spot. Doing it in one pass produces the classic bug
// where a guess is credited with a second letter that was already used.

export const CORRECT = 'correct';
export const PRESENT = 'present';
export const ABSENT = 'absent';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/**
 * Score a guess against the answer.
 * @returns {('correct'|'present'|'absent')[]} one verdict per letter
 */
export function scoreGuess(guess, answer) {
  const verdicts = new Array(WORD_LENGTH).fill(ABSENT);

  // Pass 1: claim every exact position match and take that letter out of the
  // pool of answer letters still available.
  const spare = [];
  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (guess[i] === answer[i]) {
      verdicts[i] = CORRECT;
    } else {
      spare.push(answer[i]);
    }
  }

  // Pass 2: only leftover answer letters can turn yellow, and only where the
  // guess put them in the wrong spot.
  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (verdicts[i] === CORRECT) continue;
    const at = spare.indexOf(guess[i]);
    if (at !== -1) {
      verdicts[i] = PRESENT;
      spare.splice(at, 1);
    }
  }

  return verdicts;
}

/**
 * Roll every scored guess up into a single colour per letter for the keyboard.
 *
 * Strength never regresses: a letter already known `correct` stays green even if
 * a later guess would mark it grey, and `present` is never downgraded to grey.
 * Getting that backwards makes the keyboard lie about information the player has
 * already earned.
 *
 * @param {{word: string, verdicts: string[]}[]} scored
 * @returns {Record<string, string>}
 */
export function keyboardState(scored) {
  const rank = { [ABSENT]: 1, [PRESENT]: 2, [CORRECT]: 3 };
  const state = {};

  for (const row of scored) {
    row.verdicts.forEach((verdict, i) => {
      const letter = row.word[i];
      if (!letter) return;
      if ((rank[verdict] ?? 0) > (rank[state[letter]] ?? 0)) {
        state[letter] = verdict;
      }
    });
  }

  return state;
}

/** Pick an answer at random. Takes an injectable RNG so tests can pin it. */
export function pickAnswer(pool, random = Math.random) {
  return pool[Math.floor(random() * pool.length)];
}

/** True once the row is fully green. */
export function isSolved(verdicts) {
  return verdicts.every((v) => v === CORRECT);
}
