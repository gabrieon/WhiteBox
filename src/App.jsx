import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { findGame, games, isPlayable } from './games/registry.js';
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

export default function App() {
  const [currentView, setCurrentView] = useState('browse');

  const activeGame = findGame(currentView);
  const canPlay = isPlayable(activeGame);

  // Playable games first, then coming soon — registry order kept within each.
  const orderedGames = useMemo(() => {
    const playable = [];
    const soon = [];
    for (const game of games) {
      (isPlayable(game) ? playable : soon).push(game);
    }
    return [...playable, ...soon];
  }, []);

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
            <div className="wb-grid">
              {orderedGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  playable={isPlayable(game)}
                  onOpen={openGame}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
