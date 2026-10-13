import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { findGame, isPlayable, listGames } from './games/registry.js';
import GameStage from './components/GameStage.jsx';
import GameCard from './components/GameCard.jsx';
import SignIn from './components/SignIn.jsx';
import { useAuth } from './sdk/auth/authContext.js';
import { listLocalProgress, pullProgress } from './sdk/auth/progress.js';

// --- hash routing -----------------------------------------------------------
//   #/            library
//   #/game/<id>   play a game (shareable link)
// Every navigation writes the hash; a `hashchange` listener applies it back to
// state. Browser back/forward and shared links work. Unknown routes fall home.

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const slash = raw.indexOf('/');
  if (slash === -1) return { head: raw, rest: '' };
  return { head: raw.slice(0, slash), rest: raw.slice(slash + 1) };
}

// --- play tracking ----------------------------------------------------------
// Local play history powers the Continue Playing and Top Played rows:
// { [gameId]: { c: open count, t: last-opened timestamp } }.
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

function writePlays(value) {
  try {
    window.localStorage.setItem(PLAYS_KEY, JSON.stringify(value));
  } catch {
    // Private mode etc. — rows simply reset on reload.
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
  const [currentView, setCurrentView] = useState('browse');
  const [plays, setPlays] = useState(readPlays);
  // { [gameId]: savedAt } mirror of locally saved runs. Refreshed whenever
  // the library shows (a game may have saved on exit) and after sign-in pull.
  const [progressAt, setProgressAt] = useState(() => {
    const map = listLocalProgress();
    return Object.fromEntries(Object.entries(map).map(([id, entry]) => [id, entry.at]));
  });

  const { isSignedIn, profile } = useAuth();

  const activeGame = findGame(currentView);
  const canPlay = isPlayable(activeGame);

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
        if (!q) return true;
        return game.title.toLowerCase().includes(q)
          || game.description.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const pa = isPlayable(a) ? 0 : 1;
        const pb = isPlayable(b) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return a.title.localeCompare(b.title);
      });
  }, [query, category]);

  const applyHash = useCallback(() => {
    const { head, rest } = parseHash();
    // Refresh saved-run keys on every navigation: the game just exited may
    // have saved (or cleared, on restart) its snapshot on the way out.
    const progressMap = listLocalProgress();
    setProgressAt(Object.fromEntries(Object.entries(progressMap).map(([id, entry]) => [id, entry.at])));
    if (head === 'game') {
      const game = findGame(rest);
      if (game && isPlayable(game)) {
        setCurrentView(game.id);
        return;
      }
    }
    if (window.location.hash !== '#/' && window.location.hash !== '') {
      window.history.replaceState(null, '', '#/');
    }
    setCurrentView('browse');
  }, []);

  useEffect(() => {
    // One-time sync from the URL (external store) into state on mount, plus
    // the hashchange subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [applyHash]);

  // Jump back to the top whenever the player moves to a different view.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [currentView]);

  // Reflect the current view in the tab title.
  useEffect(() => {
    document.title = canPlay
      ? `${activeGame.title} — WhiteBox`
      : 'WhiteBox';
  }, [canPlay, activeGame]);

  const goHash = useCallback((hash) => {
    if (window.location.hash === hash) applyHash();
    else window.location.hash = hash;
  }, [applyHash]);

  function goHome() {
    goHash('#/');
  }

  function openGame(gameId) {
    if (!isPlayable(findGame(gameId))) return;
    setPlays((current) => {
      const prev = current[gameId] || { c: 0, t: 0 };
      const next = { ...current, [gameId]: { c: prev.c + 1, t: Date.now() } };
      writePlays(next);
      return next;
    });
    goHash(`#/game/${gameId}`);
  }

  return (
    <div className="wb-shell">
      <main className="wb-main">
        {canPlay ? (
          <GameStage
            key={activeGame.id}
            game={activeGame}
            onExit={goHome}
          />
        ) : (
          <>
            <h1 className="wb-site-title">WhiteBox</h1>
            <SignIn />
            {continuePlaying.length > 0 && (
              <GameRow title="Continue Playing" list={continuePlaying} emptyHint="" onOpen={openGame} />
            )}
            <GameRow title="Trending" list={trending} emptyHint="" onOpen={openGame} />
            <GameRow title="Top Played" list={topPlayed} emptyHint="Play something and your most-played games will rank here." onOpen={openGame} />

            <section className="wb-row">
              <RowHead title="Browse All" count={browse.length} />

              <div className="wb-toolbar">
                <input
                  type="search"
                  className="wb-search"
                  placeholder="Search games"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search games"
                />
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
          </>
        )}
      </main>
    </div>
  );
}
