import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import './sitebar.css';
import { findGame, isPlayable, listGames, templateRuntime } from './games/registry.js';
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
import {
  fetchCreatedGames,
  fetchMyGames,
  fetchBuiltinThumbs,
  BUILTIN_THUMBS_CHANGED,
} from './sdk/games/api.js';
import { matchesGameText } from './sdk/games/search.js';

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

// Curated trending row. Deliberately short while the library has three built-in
// games: the row falls back to this shortlist for a visitor with no history, and
// padding it with ids that no longer exist would only mean dead entries.
const TRENDING_IDS = ['word-lock', 'pair-vault', 'odd-spot'];

const ALL_CATEGORIES = 'All';

// The header search is site-wide: it narrows every row, not just the catalog.
// Matching lives in the SDK so discovery rules are unit-tested; an empty
// query matches everything, so this is a no-op until the user types.
function matchesText(game, q) {
  return matchesGameText(game, q);
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

// Rules are derived per game rather than baked into the template, because the
// question count is the thing a player most needs to know before starting.
function templateRules(game) {
  const count = Array.isArray(game.content?.questions)
    ? game.content.questions.length
    : 0;
  return [
    `Answer all ${count} ${count === 1 ? 'question' : 'questions'}.`,
    'Each question has four options and one correct answer.',
    'Your options are shuffled each round, so read all four.',
    'A review at the end shows every answer you missed.',
  ];
}

// Positional with templateRules. A player-created quiz has no manifest of its
// own, so this is the only place its rules can be given icons.
const TEMPLATE_RULE_ICONS = ['question', 'target', 'refresh', 'eye'];

// Turn a created game's database row into a manifest the play shell can render.
//
// A created game is not in the registry — it has no code and no manifest of its
// own — so `findGame` cannot resolve it. What plays it is a template runtime: a
// registered component that takes the row's questions as input. This function
// is the join between the two.
//
// Returns null for a row whose template is unknown, which is what makes an
// unplayable created game fall through to "Game not found" instead of opening a
// blank screen.
function synthesizePlayManifest(game) {
  if (!game) return null;
  const runtime = templateRuntime(game.template);
  if (!runtime) return null;

  return {
    ...runtime,
    // Identity comes from the row, never the template. The template is an
    // engine, not an identity.
    id: game.id,
    title: game.title,
    description: game.description,
    categories: game.categories || [],
    // Artwork type is the creator's choice, not the template's default — a quiz
    // about flags should not inherit the same splash art as one about spelling.
    type: game.type || runtime.type,
    rules: templateRules(game),
    ruleIcons: TEMPLATE_RULE_ICONS,
    content: game.content || null,
    thumbUrl: game.thumbUrl || null,
  };
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

  // Artwork overrides for built-in games, keyed by game id. Public read, so it
  // loads for signed-out visitors too; a failure just means cards fall back to
  // the artwork checked into the repository.
  //
  // Declared above the curated rows because they resolve games through
  // `resolveGame`, which reads this map.
  const [builtinThumbs, setBuiltinThumbs] = useState({});

  // Single resolver for a built-in game by id, with the owner's artwork override
  // applied.
  //
  // This exists because three call sites reached for `findGame` directly and
  // silently bypassed the override: Browse All drew from `library` (which applied
  // it) while Trending, Continue Playing and Top Played drew from the raw
  // registry, so a replaced thumbnail appeared in one row and nowhere else.
  // Every id -> game lookup now goes through here.
  const resolveGame = useCallback((id) => {
    const game = findGame(id);
    if (!game) return null;
    const override = builtinThumbs[id];
    return override ? { ...game, builtinThumb: override } : game;
  }, [builtinThumbs]);

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
      .map(([id]) => resolveGame(id))
      .filter(Boolean)
      .slice(0, 6);
  }, [plays, progressAt, resolveGame]);

  const topPlayed = useMemo(() => Object.entries(plays)
    .filter(([, entry]) => entry.c > 0)
    .sort((a, b) => b[1].c - a[1].c)
    .map(([id]) => resolveGame(id))
    .filter(Boolean)
    .slice(0, 6), [plays, resolveGame]);

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
      .map((x) => resolveGame(x.id))
      .filter(Boolean);

    // Fewer than three opens is noise, not a ranking, so those get ignored in
    // favour of the curated shortlist.
    const picks = ranked.length >= 3 ? [...ranked] : [];

    // Top the row up from the shortlist so it never runs dry — a visitor with a
    // handful of plays still sees something worth clicking.
    for (const id of TRENDING_IDS) {
      if (picks.length >= 6) break;
      const game = resolveGame(id);
      if (game && !picks.some((p) => p.id === game.id)) picks.push(game);
    }

    return picks;
  }, [plays, now, resolveGame]);

  // --- created games --------------------------------------------------------
  // Player-published entries live in the database, not the registry. A failure
  // here must not take the library down, so the list simply stays empty and the
  // built-in games carry on.
  const [createdGames, setCreatedGames] = useState([]);
  const [createdLoading, setCreatedLoading] = useState(true);
  const [createdError, setCreatedError] = useState('');

  const refreshCreated = useCallback(() => {
    setCreatedLoading(true);
    setCreatedError('');
    fetchCreatedGames()
      .then((games) => {
        setCreatedGames(games);
        setCreatedLoading(false);
      })
      .catch(() => {
        // Approved player games are additive: the library still shows built-ins
        // while this error and its retry explain why community games are absent.
        setCreatedGames([]);
        setCreatedError('Could not load player-made games.');
        setCreatedLoading(false);
      });
  }, []);

  useEffect(() => {
    // Initial catalogue sync. This intentionally sets loading state on mount;
    // it runs once per refreshCreated identity, not in response to that state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCreated();
  }, [refreshCreated]);

  // --- your own games, whatever their review state --------------------------
  //
  // `createdGames` is the public catalogue and therefore approved-only. That is
  // right for the library, but it means a creator has no way to PLAY their own
  // submission: the row they just made is not in any list the play route reads,
  // so opening it lands on "Game not found".
  //
  // Publishing a quiz without being able to try it first is a dead end — a
  // creator cannot tell whether their answer key is right until a stranger has
  // already seen it. So the signed-in player's own rows are fetched separately
  // and used ONLY to resolve a play route. They never enter `library`, because
  // an unreviewed game in the catalogue is exactly what moderation is for.
  //
  // This is safe because `fetchMyGames` runs with the viewer's own token, so
  // every row in it belongs to them. It is not a way to see anyone else's.
  const [ownState, setOwnState] = useState({ userId: null, games: [] });

  // Keyed to the account it was fetched for, rather than cleared on sign-out.
  // Clearing means a setState inside the effect, and — worse — it leaves a
  // window where switching accounts still renders the previous user's games:
  // the old list is still in state, and the new fetch has not landed yet. A
  // `userId` stamp makes the list unresolvable the instant the profile changes,
  // with no effect and no flash.
  const ownGames = useMemo(
    () => (ownState.userId && ownState.userId === profileId ? ownState.games : []),
    [ownState, profileId],
  );

  useEffect(() => {
    if (!isSignedIn || !profileId) return undefined;
    let alive = true;
    fetchMyGames()
      .then((games) => { if (alive) setOwnState({ userId: profileId, games }); })
      // A signed-in player who cannot list their own games still gets the
      // approved catalogue; this is additive and not worth surfacing.
      .catch(() => { if (alive) setOwnState({ userId: profileId, games: [] }); });
    return () => { alive = false; };
  }, [isSignedIn, profileId]);

  // The registry holds built-ins; the database holds player creations. Merging
  // them here means every downstream filter, sort and search sees one list.
  // A created game can never shadow a built-in: registry ids win.
  useEffect(() => {
    let alive = true;
    fetchBuiltinThumbs()
      .then((map) => { if (alive) setBuiltinThumbs(map); })
      .catch(() => {});

    // The artwork editor announces its result. Without this the library kept the
    // map it fetched at mount, so replacing a thumbnail appeared to do nothing
    // until the page was reloaded. The event carries the finished map, so no
    // refetch is needed.
    function onChanged(event) {
      if (!alive) return;
      const detail = event.detail;
      if (detail && typeof detail === 'object') setBuiltinThumbs(detail);
    }
    window.addEventListener(BUILTIN_THUMBS_CHANGED, onChanged);
    return () => { alive = false; window.removeEventListener(BUILTIN_THUMBS_CHANGED, onChanged); };
  }, []);

  const library = useMemo(() => {
    const builtin = listGames();
    const taken = new Set(builtin.map((g) => g.id));

    // An override replaces the shipped thumbnail without touching the repo.
    const withOverrides = builtin.map((game) => (
      builtinThumbs[game.id]
        ? { ...game, builtinThumb: builtinThumbs[game.id] }
        : game
    ));

    return [...withOverrides, ...createdGames.filter((g) => !taken.has(g.id))];
  }, [createdGames, builtinThumbs]);

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

  // Resolve a play route against three sources, in order: the registry for
  // built-ins, the creator's own rows, then the public catalogue. Order matters
  // — a built-in id always wins, so a created row can never shadow a shipped
  // game, and the creator's copy wins over the public one so an edit is visible
  // to them immediately instead of after the next public fetch.
  const activeGame = useMemo(() => {
    if (route.name !== 'play') return null;
    const builtIn = findGame(route.id);
    if (builtIn) return builtIn;
    const own = ownGames.find((g) => g.id === route.id);
    if (own) return synthesizePlayManifest(own);
    return synthesizePlayManifest(createdGames.find((g) => g.id === route.id) || null);
  }, [route.name, route.id, createdGames, ownGames]);

  // A created game that is not approved is playable only by the person who made
  // it, and only because their copy came from `ownGames` — which is fetched with
  // their own token, so every row in it is theirs. Anything resolving through
  // the public `createdGames` list is already approved by construction.
  //
  // That is why there is no status check here: the ordering above, not a second
  // guard on this line, is what keeps an unreviewed game private. A second
  // check would read as if it were doing the work, and it is not.
  const activeGameVisible = Boolean(activeGame);

  return (
    <div className="wb-shell">
      <main className="wb-main">
        {/* A game covers the whole viewport, so the library unmounts rather
            than sitting underneath it. */}
        {route.name === 'play' && (
          activeGameVisible
            ? <PlayShell manifest={activeGame} onExit={exitGame} />
            : (
              <div className="wb-play-error">
                <h2>Game not found</h2>
                <p>
                  There is no game called &ldquo;{route.id}&rdquo; you can open. It
                  may have been removed, or it may still be waiting for review
                  &mdash; player-made games are only playable once they are approved.
                </p>
                <button type="button" className="wb-play-quiet" onClick={exitGame}>
                  Back to games
                </button>
              </div>
            )
        )}

        {route.name !== 'play' && (
          <>
        {/* Navigation is pinned to the top of the viewport so it stays put however
            far the library is scrolled. A games grid is long, and a header that
            scrolls away takes the search box and the account control with it. It
            is a <nav> because it is the site primary navigation, not a
            document banner. */}
        <nav className="wb-sitebar" aria-label="Site">
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
            onPlay={(game) => navigate('play', game.id)}
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

          {(createdLoading || createdError) && (
            <p className="wb-sync" role="status">
              {createdLoading
                ? 'Loading player-made games…'
                : (
                  <>
                    {createdError} {' '}
                    <button type="button" className="wb-sync-retry" onClick={refreshCreated}>
                      Retry
                    </button>
                  </>
                )}
            </p>
          )}

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
