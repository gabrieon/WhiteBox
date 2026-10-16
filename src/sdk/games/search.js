// Library search matching, kept free of React so discovery can be tested.
//
// Search is site-wide: it narrows every row, not just the catalog. Matching
// only titles and descriptions would hide games behind vocabulary the card
// does not display — a player searching "memory" should find Pair Vault even
// though neither its title nor its one-line description uses that exact word.

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

/** True when every query word appears somewhere in the game's searchable text. */
export function matchesGameText(game, query) {
  const words = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  if (!game || typeof game !== 'object') return false;

  const haystack = textValues(game)
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  return words.every((word) => haystack.includes(word));
}
