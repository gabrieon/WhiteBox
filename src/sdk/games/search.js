// Library search matching, kept free of React so discovery can be tested.
//
// Search is site-wide: it narrows every row, not just the catalog. Matching
// only titles and descriptions would hide games behind vocabulary the card
// does not display — a player searching "memory" should find Pair Vault even
// though neither its title nor its one-line description uses that exact word.
//
// Three layers, in order, per query word:
//   1. substring — the historical behaviour, kept because it handles prefixes
//      and multi-word fragments for free;
//   2. synonyms — a small hand map from the words players type to the words
//      games are described with ("typing" -> keyboard);
//   3. typo tolerance — Damerau-Levenshtein against individual tokens, so a
//      transposition ("memroy") costs one edit, not two.
//
// Every layer is constrained so the search cannot surprise: synonyms only
// expand to terms that actually appear in the corpus, and fuzzy matching only
// applies to words of four letters or more, so "a", "to" and "of" never start
// matching everything.

function textValues(game) {
  return [
    game.title,
    game.description,
    game.mode,
    game.creatorName,
    ...(game.categories || []),
    ...(game.tags || []),
    ...(game.playModes || []),
  ];
}

// Alias -> terms that appear in real game text. Each entry must contain at
// least one word from the current catalogue, or it matches nothing and is
// dead weight pretending to help. Prune when games change.
const SYNONYMS = {
  words: ['word', 'words'],
  word: ['word', 'words'],
  spelling: ['word', 'words'],
  vocabulary: ['word', 'words'],
  letters: ['word', 'words', 'letters'],
  guess: ['word', 'words'],
  remember: ['memory'],
  recall: ['memory'],
  memorize: ['memory'],
  pairs: ['pairs', 'memory'],
  pair: ['pairs', 'memory'],
  matching: ['pairs', 'memory'],
  cards: ['pairs', 'memory'],
  visual: ['visual'],
  eyes: ['visual'],
  sight: ['visual'],
  spot: ['spot', 'visual'],
  find: ['spot', 'visual'],
  hidden: ['spot', 'visual'],
  tiles: ['tiles', 'visual'],
  typing: ['keyboard'],
  type: ['keyboard'],
  keyboard: ['keyboard'],
  solo: ['solo', 'single'],
  single: ['solo', 'single'],
  alone: ['solo', 'single'],
  daily: ['daily'],
  puzzle: ['puzzle'],
};

// Optimal string alignment: Levenshtein plus adjacent transposition as a
// single edit. "memroy" for "memory" is one slip of the fingers, and scoring
// it as two substitutions would miss the most common typo shape there is.
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = Array.from({ length: n + 1 }, (_, j) => j);
  const curr = new Array(n + 1);
  let beforePrev = new Array(n + 1);

  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
      // Adjacent transposition.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        curr[j] = Math.min(curr[j], beforePrev[j - 2] + 1);
      }
    }
    beforePrev = prev.slice();
    for (let j = 0; j <= n; j += 1) prev[j] = curr[j];
  }
  return curr[n];
}

// How far a word may drift and still match. Short words are exact: at three
// letters, distance 1 matches a quarter of the dictionary. Longer words earn
// a second edit because a longer string carries more identifying information.
function fuzzyMatch(word, tokens) {
  if (word.length < 4) return false;
  const budget = word.length >= 6 ? 2 : 1;
  return tokens.some((token) => {
    if (Math.abs(token.length - word.length) > budget) return false;
    return editDistance(word, token) <= budget;
  });
}

/** True when every query word appears somewhere in the game's searchable text. */
export function matchesGameText(game, query) {
  const words = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  if (!game || typeof game !== 'object') return false;

  const haystack = textValues(game)
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  const tokens = haystack.split(/[^a-z0-9]+/).filter(Boolean);

  return words.every((word) => {
    // 1. Historical behaviour: substring anywhere.
    if (haystack.includes(word)) return true;
    // 2. The player's word for it, mapped to the catalogue's word for it.
    const expansions = SYNONYMS[word] || [];
    if (expansions.some((term) => haystack.includes(term))) return true;
    // 3. A near miss on any single token.
    if (fuzzyMatch(word, tokens)) return true;
    if (expansions.some((term) => term.length >= 4 && fuzzyMatch(term, tokens))) {
      return true;
    }
    return false;
  });
}

/** Recent searches, newest first. Capped so the store never grows. */
const RECENT_KEY = 'whitebox:recent-searches';
const RECENT_MAX = 6;

function readRecent() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((s) => typeof s === 'string' && s.trim()).slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** Record a search the player actually ran (submitted with Enter). */
export function recordRecentSearch(query) {
  const cleaned = String(query || '').trim();
  if (!cleaned) return [];
  try {
    const next = [cleaned, ...readRecent().filter(
      (s) => s.toLowerCase() !== cleaned.toLowerCase(),
    )].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    return next;
  } catch {
    return readRecent();
  }
}

/** Read without writing, for rendering the suggestion list. */
export function recentSearches() {
  return readRecent();
}

/** Remove one entry, for the per-row dismiss control. */
export function forgetRecentSearch(query) {
  try {
    const next = readRecent().filter(
      (s) => s.toLowerCase() !== String(query).trim().toLowerCase(),
    );
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    return next;
  } catch {
    return readRecent();
  }
}