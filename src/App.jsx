import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { findGame, isPlayable, listGames } from './games/registry.js';
import GameCard from './components/GameCard.jsx';
import SignIn from './components/SignIn.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import { useAuth } from './sdk/auth/authContext.js';
import { listLocalProgress, pullProgress } from './sdk/auth/progress.js';

// --- play history ------------------------------------------------------------
// Historical play counts power the Top Played row:
// { [gameId]: { c: open count, t: last-opened timestamp } }.
// Nothing records new opens right now (there is no play screen), so this only
// reads what earlier visits stored.
const PLAYS_KEY = 'whitebox:plays';

function readPlays() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PLAYS_KEY));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (typeof id === 'string' && entry && typeof entry === 'object'
        && Number.isFinite(entry.c) && Number.isFinite(entry.t)) {
        clean[id] = { c: entry.c, t: entry.t };
      }
    }
    return clean;
  } catch {
    return {};
  }
}

// Curated trending row: the most social, instantly playable games.
const TRENDING_IDS = [
  'orb-arena-mp',
  'orb-duel',
  'higher-lower',
  'reaction-test',
  'orb-dash-2d',
  'orb-arena',
];

const ALL_CATEGORIES = 'All';

// The header search is site-wide: it narrows every row, not just the catalog.
// An empty query matches everything, so this is a no-op until the user types.
function matchesText(game, q) {
  if (!q) return true;
  return game.title.toLowerCase().includes(q)
    || game.description.toLowerCase().includes(q);
}

// Row heading carries a count so each section reads as a real section rather
// than a floating label.
function RowHead({ title, count }) {
  return (
    <div className="wb-row-head">
      <h2 className="wb-row-title">{title}</h2>
      {count > 0 && <span className="wb-row-count">{count}</span>}
    </div>
  );
}

function GameRow({ title, list, emptyHint, onOpen }) {
  return (
    <section className="wb-row">
      <RowHead title={title} count={list.length} />
      {list.length === 0 ? (
        <p className="wb-row-empty">{emptyHint}</p>
      ) : (
        <div className="wb-grid">
          {list.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              playable={isPlayable(game)}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [plays] = useState(readPlays);
  // { [gameId]: savedAt } mirror of locally saved runs. Refreshed whenever
  // the library shows (a game may have saved on exit) and after sign-in pull.
  const [progressAt, setProgressAt] = useState(() => {
    const map = listLocalProgress();
    return Object.fromEntries(Object.entries(map).map(([id, entry]) => [id, entry.at]));
  });

  const { isSignedIn, profile } = useAuth();

  // Once per sign-in, merge the account's saved runs into this device (newer
  // copy wins per game) so progress follows the player across devices.
  const profileId = profile?.id || null;
  useEffect(() => {
    if (!isSignedIn || !profileId) return undefined;
    let alive = true;
    pullProgress()
      .then(() => {
        if (!alive) return;
        const map = listLocalProgress();
        setProgressAt(Object.fromEntries(Object.entries(map).map(([id, entry]) => [id, entry.at])));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [isSignedIn, profileId]);

  // Continue Playing = anything with a recent open OR a saved snapshot,
  // ordered by most recent activity. Saved runs (mid-game state) sort by
  // when they were saved; plain opens sort by when they happened.
  const continuePlaying = useMemo(() => {
    const activity = new Map();
    for (const [id, entry] of Object.entries(plays)) {
      activity.set(id, Math.max(activity.get(id) || 0, entry.t));
    }
    for (const [id, at] of Object.entries(progressAt)) {
      activity.set(id, Math.max(activity.get(id) || 0, at));
    }
    return [...activity.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => findGame(id))
      .filter((game) => game !== undefined)
      .slice(0, 6);
  }, [plays, progressAt]);

  const topPlayed = useMemo(() => Object.entries(plays)
    .filter(([, entry]) => entry.c > 0)
    .sort((a, b) => b[1].c - a[1].c)
    .map(([id]) => findGame(id))
    .filter((game) => game !== undefined)
    .slice(0, 6), [plays]);

  const trending = useMemo(() => TRENDING_IDS
    .map((id) => findGame(id))
    .filter((game) => game !== undefined), []);

  // --- browse all ------------------------------------------------------------
  // The full catalog, not just the playable few. Category chips are ordered by
  // how many games actually use them, so the useful ones come first.

  const categoryList = useMemo(() => {
    const counts = new Map();
    listGames().forEach((game) => {
      (game.categories || []).forEach((c) => counts.set(c, (counts.get(c) || 0) + 1));
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);
  }, []);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);

  // Playable games first, then alphabetical — a real store's ordering.
  const browse = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listGames()
      .filter((game) => {
        if (category !== ALL_CATEGORIES
          && !(game.categories || []).includes(category)) return false;
        return matchesText(game, q);
      })
      .sort((a, b) => {
        const pa = isPlayable(a) ? 0 : 1;
        const pb = isPlayable(b) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return a.title.localeCompare(b.title);
      });
  }, [query, category]);

  // Curated rows obey the search too; a row with no matches is dropped rather
  // than showing its "play something" hint while the user is searching.
  const searching = query.trim().length > 0;
  const continueList = useMemo(
    () => continuePlaying.filter((g) => matchesText(g, query.trim().toLowerCase())),
    [continuePlaying, query],
  );
  const trendingList = useMemo(
    () => trending.filter((g) => matchesText(g, query.trim().toLowerCase())),
    [trending, query],
  );
  const topPlayedList = useMemo(
    () => topPlayed.filter((g) => matchesText(g, query.trim().toLowerCase())),
    [topPlayed, query],
  );

  const applyHash = useCallback(() => {
    // Refresh saved-run keys on every navigation, in case a game saved (or
    // cleared) a snapshot on its way out.
    const progressMap = listLocalProgress();
    setProgressAt(Object.fromEntries(Object.entries(progressMap).map(([id, entry]) => [id, entry.at])));

    // There is no play screen right now, so a #/game/... link just falls back
    // to the library.
    if (window.location.hash !== '#/' && window.location.hash !== '') {
      window.history.replaceState(null, '', '#/');
    }
  }, []);

  useEffect(() => {
    // One-time sync from the URL (external store) into state on mount, plus
    // the hashchange subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [applyHash]);

  // The play screen has been removed, so opening a game is intentionally inert
  // until the new play flow is decided. The capsules stay on the cards so the
  // layout doesn't need redoing when it is.
  function openGame() {}

  return (
    <div className="wb-shell">
      <main className="wb-main">
        <header className="wb-header">
          <h1 className="wb-brand">
            <a href="#/">WhiteBox</a>
          </h1>
          <div className="wb-header-search">
            <input
              type="search"
              className="wb-search"
              placeholder="Search games"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search games"
            />
          </div>
          <div className="wb-topbar">
            <SignIn />
            <ThemeToggle />
          </div>
        </header>
        {continueList.length > 0 && (
          <GameRow title="Continue Playing" list={continueList} emptyHint="" onOpen={openGame} />
        )}
        {(trendingList.length > 0 || !searching) && (
          <GameRow title="Trending" list={trendingList} emptyHint="" onOpen={openGame} />
        )}
        {(topPlayedList.length > 0 || !searching) && (
          <GameRow title="Top Played" list={topPlayedList} emptyHint="Play something and your most-played games will rank here." onOpen={openGame} />
        )}

        <section className="wb-row">
          <RowHead title="Browse All" count={browse.length} />

          <div className="wb-chips-bar">
            <div className="wb-chips" role="group" aria-label="Filter by category">
              <button
                type="button"
                className={`wb-chip${category === ALL_CATEGORIES ? ' is-on' : ''}`}
                onClick={() => setCategory(ALL_CATEGORIES)}
              >
                All
              </button>
              {categoryList.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`wb-chip${category === c ? ' is-on' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {browse.length === 0 ? (
            <p className="wb-row-empty">No games match “{query}”.</p>
          ) : (
            <div className="wb-grid">
              {browse.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  playable={isPlayable(game)}
                  onOpen={openGame}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
