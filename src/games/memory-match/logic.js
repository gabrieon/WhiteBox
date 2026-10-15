// Pair Vault board logic, kept free of React so matching can be tested alone.
//
// A round is eight shuffled pairs. Cards carry stable positions for the whole
// round: matching compares symbols at two *different* positions, so tapping the
// same face-up card twice can neither match itself nor count as a move.

export const PAIR_COUNT = 8;
export const PAIR_SYMBOLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function createBoard({ pairs = PAIR_COUNT, symbols = PAIR_SYMBOLS, random = Math.random } = {}) {
  if (!Number.isInteger(pairs) || pairs < 2 || pairs > symbols.length) {
    throw new Error('pairs must be an integer between 2 and the symbol count');
  }

  const chosen = symbols.slice(0, pairs);
  const cards = chosen.flatMap((symbol, pair) => ([
    { id: `${pair}-a`, symbol },
    { id: `${pair}-b`, symbol },
  ]));

  // Fisher–Yates with an injectable RNG. Tests pin the RNG; production uses
  // Math.random. Shuffling positions — not symbols — is what makes turns fair.
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return cards;
}

/** Two selections match only when they name different cards with one symbol. */
export function isMatch(firstId, secondId, cards) {
  if (!firstId || !secondId || firstId === secondId) return false;
  const first = cards.find((card) => card.id === firstId);
  const second = cards.find((card) => card.id === secondId);
  return Boolean(first && second && first.symbol === second.symbol);
}

/** A round is solved when every card id is in the matched set. */
export function isBoardSolved(cards, matchedIds) {
  if (cards.length === 0) return false;
  const matched = new Set(matchedIds);
  return cards.every((card) => matched.has(card.id));
}
