// WORDLOCK results and streaks, kept free of React so sharing can be tested.
//
// Streaks live in this browser only. That is deliberate: a streak is a personal
// record, not account data, and syncing it would put game telemetry in the
// progress table for no gameplay benefit.

const STATS_KEY = 'whitebox:word-lock-stats';

function emptyStats() {
  return {
    played: 0,
    won: 0,
    currentStreak: 0,
    bestStreak: 0,
    bestGuesses: null,
    bestTimeMs: null,
  };
}

function cleanStats(value) {
  if (!value || typeof value !== 'object') return emptyStats();
  const stats = emptyStats();
  for (const key of ['played', 'won', 'currentStreak', 'bestStreak']) {
    if (Number.isInteger(value[key]) && value[key] >= 0) stats[key] = value[key];
  }
  for (const key of ['bestGuesses', 'bestTimeMs']) {
    if (Number.isInteger(value[key]) && value[key] > 0) stats[key] = value[key];
  }
  return stats;
}

export function readStats(storage = null) {
  const store = storage || (typeof window === 'undefined' ? null : window.localStorage);
  if (!store) return emptyStats();
  try {
    return cleanStats(JSON.parse(store.getItem(STATS_KEY)));
  } catch {
    return emptyStats();
  }
}

/**
 * Record one finished round. Wins extend the streak and may set records;
 * losses reset the streak but never erase the best one.
 */
export function recordResult({ won, guesses = 0, elapsedMs = 0 } = {}, storage = null) {
  const stats = readStats(storage);
  stats.played += 1;

  if (won) {
    stats.won += 1;
    stats.currentStreak += 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    if (Number.isInteger(guesses) && guesses > 0) {
      stats.bestGuesses = stats.bestGuesses === null ? guesses : Math.min(stats.bestGuesses, guesses);
    }
    if (Number.isInteger(elapsedMs) && elapsedMs > 0) {
      stats.bestTimeMs = stats.bestTimeMs === null ? elapsedMs : Math.min(stats.bestTimeMs, elapsedMs);
    }
  } else {
    stats.currentStreak = 0;
  }

  const store = storage || (typeof window === 'undefined' ? null : window.localStorage);
  try {
    store?.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // A blocked store must not fail the game-over screen.
  }
  return stats;
}

/** Emoji board without the answer: safe to paste anywhere after a win or loss. */
export function resultGrid(guesses) {
  return guesses
    .map((guess) => guess.verdicts
      .map((verdict) => {
        if (verdict === 'correct') return '🟩';
        if (verdict === 'present') return '🟨';
        return '⬛';
      })
      .join(''))
    .join('\n');
}

export function shareText({
  won, guesses = [], elapsedLabel = '', streak = 0, url = '',
} = {}) {
  const score = won ? `${guesses.length}/6` : 'X/6';
  const lines = [
    `WORDLOCK ${score}${elapsedLabel ? ` · ${elapsedLabel}` : ''}`,
    resultGrid(guesses),
  ];
  if (streak > 1) lines.push(`Streak: ${streak}`);
  if (url) lines.push(url);
  return lines.filter(Boolean).join('\n');
}
