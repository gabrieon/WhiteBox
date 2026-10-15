import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import './bottombar.css';
import { findGame, isPlayable, listGames } from './games/registry.js';
import GameCard from './components/GameCard.jsx';
import SignIn from './components/SignIn.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import CreateGame from './components/CreateGame.jsx';
import SessionDebug from './components/SessionDebug.jsx';
import Footer from './components/Footer.jsx';
import WhiteBoxMark from './components/WhiteBoxMark.jsx';
import PlayShell from './components/play/PlayShell.jsx';
import { supabaseEnabled } from './sdk/auth/supabaseClient.js';
import { useAuth } from './sdk/auth/authContext.js';
import { listLocalProgress, pullProgress } from './sdk/auth/progress.js';
import { fetchCreatedGames } from './sdk/games/api.js';

// --- play history ------------------------------------------------------------
// Historical play counts power the Top Played row:
// { [gameId]: { c: open count, t: last-opened timestamp } }.
// Nothing records new opens right now (there is no play screen), so this only
// reads what earlier visits stored.
const PLAYS_KEY = 'whitebox:plays';

// Navigation is the URL hash, which is also the single source of truth for the
// current route: setting it fires `hashchange`, and so does the browser's back
// and forward buttons. Keeping one mechanism means Back works for free instead
// of needing a second, hand-rolled history listener.
function goToHash(hash) {
  if (window.location.hash === hash) return false;
  window.location.hash = hash;
  return true;
}

function readPlays() {  try {
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

// Curated trending row. Deliberately short while the library has one built-in
// game: the row falls back to this shortlist for a visitor with no history, and
// padding it with ids that no longer exist would only mean dead entries.
const TRENDING_IDS = ['word-lock'];

const ALL_CATEGORIES = 'All';

// The header search is site-wide: it narrows every row, not just the catalog.
// An empty query matches everything, so this is a no-op until the user types.
function matchesText(game, q) {
  if (!q) return true;
  return game.title.toLowerCase().includes(q)
    || game.description.toLowerCase().includes(q);
}

// "3h ago" — reuses the `now` captured at mount, so this stays a pure render.
function relativeTime(ts, now) {
  const mins = Math.round(Math.max(0, now - ts) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.round(days / 30)}mo ago`;
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

function GameRow({ title, list, emptyHint, onOpen, getMeta }) {
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
              meta={getMeta ? getMeta(game) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export default function App() {
  const [plays, setPlays] = useState(readPlays);

  // Persist whenever the counts change. An effect rather than a write inside the
  // click handler: the handler may fire several times before React commits, and
  // writing from the handler would persist stale values.
  useEffect(() => {
    try {
      window.localStorage.setItem(PLAYS_KEY, JSON.stringify(plays));
    } catch {
      // A full or unavailable store shouldn't stop someone playing.
    }
  }, [plays]);
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
  //
  // `filter(Boolean)` matters here: findGame returns null for an id it doesn't
  // know, and this list is built from ids in localStorage. Once a game is
  // removed from the registry, the player's saved entry still names it, so an
  // unfiltered null would reach the render and crash the row.
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
      .filter(Boolean)
      .slice(0, 6);
  }, [plays, progressAt]);

  const topPlayed = useMemo(() => Object.entries(plays)
    .filter(([, entry]) => entry.c > 0)
    .sort((a, b) => b[1].c - a[1].c)
    .map(([id]) => findGame(id))
    .filter(Boolean)
    .slice(0, 6), [plays]);

  // --- trending ---------------------------------------------------------------
  // Derived from what this player actually opened, weighted toward recent
  // activity (a play from a year ago shouldn't outrank one from this morning).
  // Falls back to the curated shortlist for a visitor with no history yet, so
  // the row is never empty on a first visit.
  //
  // `now` is captured once per mount: calling Date.now() inside the memo would
  // be an impure read during render.

  const [now] = useState(() => Date.now());

  const trending = useMemo(() => {
    const ranked = Object.entries(plays)
      .map(([id, entry]) => {
        const ageDays = Math.max(0, (now - entry.t) / 86_400_000);
        return { id, score: entry.c / (1 + ageDays) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => findGame(x.id))
      .filter(Boolean);

    // Fewer than three opens is noise, not a ranking, so those get ignored in
    // favour of the curated shortlist.
    const picks = ranked.length >= 3 ? [...ranked] : [];

    // Top the row up from the shortlist so it never runs dry — a visitor with a
    // handful of plays still sees something worth clicking.
    for (const id of TRENDING_IDS) {
      if (picks.length >= 6) break;
      const game = findGame(id);
      if (game && !picks.some((p) => p.id === game.id)) picks.push(game);
    }

    return picks;
  }, [plays, now]);

  // --- created games --------------------------------------------------------
  // Player-published entries live in the database, not the registry. A failure
  // here must not take the library down, so the list simply stays empty and the
  // built-in games carry on.
  const [createdGames, setCreatedGames] = useState([]);

  const refreshCreated = useCallback(() => {
    fetchCreatedGames()
      .then(setCreatedGames)
      .catch(() => setCreatedGames([]));
  }, []);

  useEffect(() => {
    refreshCreated();
  }, [refreshCreated]);

  // The registry holds built-ins; the database holds player creations. Merging
  // them here means every downstream filter, sort and search sees one list.
  // A created game can never shadow a built-in: registry ids win.
  const library = useMemo(() => {
    const builtin = listGames();
    const taken = new Set(builtin.map((g) => g.id));
    return [...builtin, ...createdGames.filter((g) => !taken.has(g.id))];
  }, [createdGames]);

  // --- browse all ------------------------------------------------------------
  // The full catalog, not just the playable few. Category chips are ordered by
  // how many games actually use them, so the useful ones come first.

  const categoryList = useMemo(() => {
    const counts = new Map();
    library.forEach((game) => {
      (game.categories || []).forEach((c) => counts.set(c, (counts.get(c) || 0) + 1));
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);
  }, [library]);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const searchRef = useRef(null);

  // "/" jumps to search (unless you're already typing somewhere) and Escape
  // clears it — the shortcuts people expect from a store search box.
  useEffect(() => {
    function onKeyDown(e) {
      const active = document.activeElement;
      const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === 'Escape' && active === searchRef.current) {
        setQuery('');
        searchRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function clearSearch() {
    setQuery('');
    searchRef.current?.focus();
  }
  // Most of the catalog is unbuilt, so let players hide it and see only the
  // games they can actually launch.
  const [playableOnly, setPlayableOnly] = useState(false);
  const [sort, setSort] = useState('featured');

  const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'az', label: 'A–Z' },
  { id: 'za', label: 'Z–A' },
  { id: 'played', label: 'Most played' },
];

// Playable games first, then alphabetical — a real store's ordering.
  const browse = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = library.filter((game) => {
      if (playableOnly && !isPlayable(game)) return false;
      if (category !== ALL_CATEGORIES
        && !(game.categories || []).includes(category)) return false;
      return matchesText(game, q);
    });

    if (sort === 'az') return filtered.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'za') return filtered.sort((a, b) => b.title.localeCompare(a.title));
    if (sort === 'played') {
      return filtered.sort((a, b) => {
        const pa = plays[a.id]?.c || 0;
        const pb = plays[b.id]?.c || 0;
        if (pb !== pa) return pb - pa;
        return a.title.localeCompare(b.title);
      });
    }
    return filtered.sort((a, b) => {
      const pa = isPlayable(a) ? 0 : 1;
      const pb = isPlayable(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title);
    });
  }, [query, category, playableOnly, sort, plays, library]);

  // Curated rows obey the search, and each game lands in at most ONE curated
  // row: the page used to show Reaction Test and Higher or Lower four times
  // over (Continue + Trending + Top Played + Browse All). Priority order
  // decides who wins, Browse All stays the complete catalog.
  const searching = query.trim().length > 0;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const seen = new Set();
    const take = (list) => list.filter((game) => {
      if (seen.has(game.id)) return false;
      seen.add(game.id);
      return matchesText(game, q);
    });

    return {
      continue: take(continuePlaying),
      trending: take(trending),
      topPlayed: take(topPlayed),
    };
  }, [continuePlaying, trending, topPlayed, query]);

  // Most recent activity for a game: a saved mid-run snapshot counts as more
  // recent than merely having opened it.
  const playedAt = useCallback((gameId) => {
    const opened = plays[gameId]?.t || 0;
    const saved = progressAt[gameId] || 0;
    return Math.max(opened, saved) || null;
  }, [plays, progressAt]);

  // Three screens: the library, the Create screen, and a fullscreen game. Hash
  // routing keeps all of them shareable and back-button friendly without
  // pulling in a router.
  //
  // Games live at #/play/<id> on this same origin on purpose. A subdomain would
  // force a full document load every time the player crossed between the library
  // and a game, and would throw away scroll position and the loaded bundle.
  const readRoute = () => {
    const hash = window.location.hash;
    if (hash.startsWith('#/play/')) {
      return { name: 'play', id: hash.slice('#/play/'.length).split('?')[0] };
    }
    return { name: hash === '#/create' ? 'create' : 'library' };
  };

  const [route, setRoute] = useState(readRoute);

  const applyHash = useCallback(() => {
    // Refresh saved-run keys on every navigation, in case a game saved (or
    // cleared) a snapshot on its way out.
    const progressMap = listLocalProgress();
    setProgressAt(Object.fromEntries(Object.entries(progressMap).map(([id, entry]) => [id, entry.at])));

    const next = readRoute();
    setRoute(next);

    // Count an open here, where the navigation actually lands, rather than on
    // the click that caused it. That way a shared link, a bookmark or a
    // back-button return all count as a play too — clicking a card is only one
    // of the ways in.
    setPlays((prev) => (
      next.name !== 'play' || !next.id
        ? prev
        : { ...prev, [next.id]: { c: (prev[next.id]?.c || 0) + 1, t: Date.now() } }
    ));
  }, []);

  useEffect(() => {
    // One-time sync from the URL (external store) into state on mount, plus
    // the hashchange subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [applyHash]);

  // Coming back to the tab is the other moment a run's saved state can have
  // changed, so refresh the same way navigation does.
  useEffect(() => {
    function refresh() {
      const map = listLocalProgress();
      setProgressAt(Object.fromEntries(Object.entries(map).map(([id, entry]) => [id, entry.at])));
    }
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  // Opening a game records it so "Continue Playing" and "Top Played" have
  // something real to rank. Previously this was an inert stub left over from
  // when there was no play flow at all.
  function openGame(gameId) {
    goToHash(`#/play/${gameId}`);
  }

  function navigate(next, arg) {
    if (next === 'play') goToHash(`#/play/${arg}`);
    else if (next === 'create') goToHash('#/create');
    else goToHash('#/');
  }

  const exitGame = useCallback(() => goToHash('#/'), []);

  const activeGame = route.name === 'play' ? findGame(route.id) : null;

  return (
    <div className="wb-shell">
      <main className="wb-main">
        {/* A game covers the whole viewport, so the library unmounts rather
            than sitting underneath it. */}
        {route.name === 'play' && (
          activeGame
            ? <PlayShell manifest={activeGame} onExit={exitGame} />
            : (
              <div className="wb-play-error">
                <h2>Game not found</h2>
                <p>
                  There is no game called &ldquo;{route.id}&rdquo; any more. It may
                  have been removed since this link was made.
                </p>
                <button type="button" className="wb-play-quiet" onClick={exitGame}>
                  Back to games
                </button>
              </div>
            )
        )}

        {route.name !== 'play' && (
          <>
        {/* Navigation is pinned to the bottom of the viewport rather than the
            top of the page. A games grid is long, and a header that scrolls away
            takes the search box and the account control with it — on a phone
            there is no other way to search or sign in without scrolling back up.
            It is a <nav> because it is the site's primary navigation. */}
        <nav className="wb-bottombar" aria-label="Site">
          <h1 className="wb-brand">
            <a href="#/" className="wb-brand-link"><WhiteBoxMark size={20} /><span>WhiteBox</span></a>
          </h1>

          <div className="wb-header-search">
            <span className="wb-search-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.6-3.6" />
              </svg>
            </span>
            <input
              ref={searchRef}
              type="search"
              className="wb-search"
              placeholder="Search games"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search games"
            />
            {query && (
              <button
                type="button"
                className="wb-search-clear"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                <ClearIcon />
              </button>
            )}
          </div>

          <div className="wb-topbar">
            <button
              type="button"
              className="wb-create-btn"
              onClick={() => navigate('create')}
              aria-label="Create a game"
            >
              <PlusIcon />
              <span className="wb-create-label">Create</span>
            </button>
            <SignIn mode={supabaseEnabled() ? 'supabase' : 'legacy'} />
            <ThemeToggle />
          </div>
        </nav>

        {route.name === 'create' ? (
          <CreateGame
            onBack={() => navigate('library')}
            onCreated={refreshCreated}
            onDeleted={(game) => {
              setCreatedGames((prev) => prev.filter((g) => g.id !== game.id));
            }}
          />
        ) : (
          <>
        {rows.continue.length > 0 && (
          <GameRow
            title="Continue Playing"
            list={rows.continue}
            emptyHint=""
            onOpen={openGame}
            getMeta={(g) => relativeTime(playedAt(g.id) ?? 0, now)}
          />
        )}
        {rows.trending.length > 0 && (
          <GameRow title="Trending" list={rows.trending} emptyHint="" onOpen={openGame} />
        )}
        {rows.topPlayed.length > 0 && (
          <GameRow title="Top Played" list={rows.topPlayed} emptyHint="" onOpen={openGame} />
        )}
        {/* The only empty row worth keeping: a first-time visitor who has never
            played anything. Any other empty row is hidden rather than left as a
            bare heading. */}
        {!searching && rows.topPlayed.length === 0 && Object.keys(plays).length === 0 && (
          <GameRow
            title="Top Played"
            list={[]}
            emptyHint="Play something and your most-played games will rank here."
            onOpen={openGame}
          />
        )}

        <section className="wb-row">
          <RowHead title="Browse All" count={browse.length} />

          <div className="wb-chips-bar">
            <div className="wb-chips" role="group" aria-label="Filter games">
              <button
                type="button"
                className={`wb-chip${category === ALL_CATEGORIES ? ' is-on' : ''}`}
                onClick={() => setCategory(ALL_CATEGORIES)}
              >
                All
              </button>
              <button
                type="button"
                className={`wb-chip${playableOnly ? ' is-on' : ''}`}
                onClick={() => setPlayableOnly((v) => !v)}
                aria-pressed={playableOnly}
              >
                Playable only
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
            <label className="wb-sort">
              <span className="wb-sort-label">Sort</span>
              <select
                className="wb-sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort games"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
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
          </>
        )}
      </main>

      {/* Footer sits outside the play overlay so it never renders under a game. */}
      {route.name !== 'play' && (
        <Footer
          categories={categoryList}
          onNavigate={(target) => {
            if (target === 'create') {
              navigate('create');
              return;
            }
            setCategory(target);
            setQuery('');
            navigate('library');
          }}
        />
      )}

      {/* Renders nothing unless the URL carries ?debug=session. */}
      <SessionDebug />
    </div>
  );
}
