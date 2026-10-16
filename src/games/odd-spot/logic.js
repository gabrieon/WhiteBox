// Odd Spot round logic, kept free of React so board generation can be tested.
//
// Each round shows one tile that is almost — but not quite — like the others.
// The difference is always a glyph shape, never color alone: several pairs are
// deliberately hard for colorblind players if hue were the only signal, so hue
// is decoration and the letterform carries the answer.

export const ROUND_COUNT = 10;
export const CELL_COUNT = 9;

// Similar glyphs, not synonyms. Every pair has to survive at game-tile size:
// C/O, E/F and M/N are confusable at a glance without being identical.
export const GLYPH_PAIRS = [
  ['C', 'O'],
  ['E', 'F'],
  ['M', 'N'],
  ['P', 'R'],
  ['I', 'J'],
  ['O', 'Q'],
  ['S', '5'],
  ['B', '8'],
  ['D', 'O'],
  ['G', 'C'],
];

export function createRound({ round = 0, cells = CELL_COUNT, random = Math.random } = {}) {
  if (!Number.isInteger(round) || round < 0) {
    throw new Error('round must be a non-negative integer');
  }
  if (!Number.isInteger(cells) || cells < 2) {
    throw new Error('cells must be an integer >= 2');
  }
  if (GLYPH_PAIRS.length === 0) throw new Error('glyph pairs are required');

  // Cycle through the pairs rather than choosing purely at random. Pure random
  // choice can repeat C/O three rounds in a row; cycling guarantees variety
  // while the odd position stays unpredictable.
  const [common, odd] = GLYPH_PAIRS[round % GLYPH_PAIRS.length];
  const oddIndex = Math.floor(random() * cells);
  const tiles = Array.from({ length: cells }, (_, index) => (
    index === oddIndex ? odd : common
  ));

  return { round, common, odd, oddIndex, tiles };
}

/** A tap wins the round only when it names the odd position. */
export function isOddTap(roundBoard, tappedIndex) {
  if (!roundBoard || !Number.isInteger(tappedIndex)) return false;
  return tappedIndex === roundBoard.oddIndex;
}

/** Fewer misses always win; time only breaks a tie. */
export function scoreGame({ misses = 0, elapsedMs = 0, rounds = ROUND_COUNT } = {}) {
  if (!Number.isInteger(misses) || misses < 0) throw new Error('misses must be >= 0');
  if (!Number.isInteger(elapsedMs) || elapsedMs < 0) throw new Error('elapsedMs must be >= 0');
  return { rounds, misses, elapsedMs, accuracy: Math.round((rounds / Math.max(1, rounds + misses)) * 100) };
}
