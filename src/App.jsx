import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { findGame, isPlayable } from './games/registry.js';
import GameStage from './components/GameStage.jsx';
import GameCard from './components/GameCard.jsx';

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

function GameRow({ title, list, emptyHint, onOpen }) {
  return (
    <section className="wb-row">
      <h2 className="wb-row-title">{title}</h2>
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

  const activeGame = findGame(currentView);
  const canPlay = isPlayable(activeGame);

  const continuePlaying = useMemo(() => Object.entries(plays)
    .sort((a, b) => b[1].t - a[1].t)
    .map(([id]) => findGame(id))
    .filter((game) => game !== undefined)
    .slice(0, 6), [plays]);

  const topPlayed = useMemo(() => Object.entries(plays)
    .filter(([, entry]) => entry.c > 0)
    .sort((a, b) => b[1].c - a[1].c)
    .map(([id]) => findGame(id))
    .filter((game) => game !== undefined)
    .slice(0, 6), [plays]);

  const trending = useMemo(() => TRENDING_IDS
    .map((id) => findGame(id))
    .filter((game) => game !== undefined), []);

  const applyHash = useCallback(() => {
    const { head, rest } = parseHash();
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
            <GameRow title="Continue Playing" list={continuePlaying} emptyHint="Games you open will show up here." onOpen={openGame} />
            <GameRow title="Trending" list={trending} emptyHint="" onOpen={openGame} />
            <GameRow title="Top Played" list={topPlayed} emptyHint="Your most-played games will show up here." onOpen={openGame} />
          </>
        )}
      </main>
    </div>
  );
}
