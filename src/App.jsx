import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { findGame, games, isPlayable, listCategories } from './games/registry.js';
import GameStage from './components/GameStage.jsx';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import Hero from './components/Hero.jsx';
import {
  SectionHeading,
  CategoryChips,
  GameGrid,
  FeaturedRow,
  EmptyState,
} from './components/GameSections.jsx';
import { CreatePage, AboutPage } from './components/InfoPages.jsx';

const categories = ['All games', ...listCategories()];
const sidebarCategories = categories.slice(1);

const FAVORITES_KEY = 'whitebox:favorites';
const RECENT_KEY = 'whitebox:recent';
const MAX_RECENT = 8;

function readList(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). The list then
    // simply resets on reload instead of throwing.
  }
}

// --- hash routing -----------------------------------------------------------
// The URL hash is the single source of truth for where the player is:
//   #/                  home
//   #/explore            full library
//   #/favorites          saved games
//   #/recent             recently played
//   #/category/<name>    one genre
//   #/game/<id>          play a game (shareable link)
//   #/create, #/about    info pages
// Every navigation writes the hash; a `hashchange` listener applies it back to
// state. Browser back/forward and shared links therefore work for free.

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const slash = raw.indexOf('/');
  if (slash === -1) return { head: raw, rest: '' };
  return { head: raw.slice(0, slash), rest: safeDecode(raw.slice(slash + 1)) };
}

export default function App() {
  const [section, setSection] = useState('home');
  const [selectedCategory, setSelectedCategory] = useState('All games');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState(() => readList(FAVORITES_KEY));
  const [recentGames, setRecentGames] = useState(() => readList(RECENT_KEY).slice(0, MAX_RECENT));
  const [currentView, setCurrentView] = useState('browse');

  const activeGame = findGame(currentView);
  const canPlay = isPlayable(activeGame);

  const query = search.trim().toLowerCase();

  const searchResults = useMemo(() => games.filter((game) =>
    !query
    || game.title.toLowerCase().includes(query)
    || game.description.toLowerCase().includes(query)
    || game.categories.some((category) => category.toLowerCase().includes(query)),
  ), [query]);

  const categoryGames = useMemo(() => games.filter((game) =>
    selectedCategory === 'All games' || game.categories.includes(selectedCategory),
  ), [selectedCategory]);

  const favoriteGames = useMemo(() => games.filter((game) => favorites.includes(game.id)), [favorites]);
  const recentList = useMemo(() => recentGames
    .map((id) => findGame(id))
    .filter((game) => game !== undefined), [recentGames]);

  // Jump back to the top whenever the player moves to a different view, otherwise
  // opening a game from the middle of a long grid lands them mid-page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [currentView, section]);

  // Reflect the current view in the tab title and document heading.
  useEffect(() => {
    document.title = canPlay
      ? `${activeGame.title} — WhiteBox`
      : query
        ? `Search: ${search.trim()} — WhiteBox`
        : 'WhiteBox — Discover Your Next Favorite Game';
  }, [canPlay, activeGame, query, search]);
  const featuredGames = useMemo(() => {
    const ids = ['orb-arena-mp', 'reaction-test', 'orb-dash-2d'];
    return ids.map((id) => findGame(id)).filter(Boolean);
  }, []);
  const competitiveGames = useMemo(() => games.filter((game) =>
    game.categories.includes('Multiplayer') || ['1v1', 'Party', 'Ranked'].includes(game.mode),
  ).slice(0, 4), []);

  const recordRecent = useCallback((gameId) => {
    setRecentGames((current) => {
      const next = [gameId, ...current.filter((id) => id !== gameId)].slice(0, MAX_RECENT);
      writeList(RECENT_KEY, next);
      return next;
    });
  }, []);

  // Apply the current URL hash to state. Unknown routes fall back to home and
  // fix the URL with replaceState (which does not add a history entry).
  const applyHash = useCallback(() => {
    const { head, rest } = parseHash();
    setSearch('');
    switch (head) {
      case '':
        setCurrentView('browse');
        setSection('home');
        setSelectedCategory('All games');
        break;
      case 'explore':
      case 'favorites':
      case 'recent':
        setCurrentView('browse');
        setSection(head);
        setSelectedCategory('All games');
        break;
      case 'category':
        if (rest && categories.includes(rest)) {
          setCurrentView('browse');
          setSection('categories');
          setSelectedCategory(rest);
        } else {
          window.history.replaceState(null, '', '#/');
          setCurrentView('browse');
          setSection('home');
          setSelectedCategory('All games');
        }
        break;
      case 'game': {
        const game = findGame(rest);
        if (game && isPlayable(game)) {
          recordRecent(game.id);
          setCurrentView(game.id);
        } else {
          window.history.replaceState(null, '', '#/');
          setCurrentView('browse');
          setSection('home');
          setSelectedCategory('All games');
        }
        break;
      }
      case 'create':
      case 'about':
        setCurrentView(head);
        break;
      default:
        window.history.replaceState(null, '', '#/');
        setCurrentView('browse');
        setSection('home');
        setSelectedCategory('All games');
        break;
    }
  }, [recordRecent]);

  useEffect(() => {
    // One-time sync from the URL (external store) into state on mount, plus
    // the hashchange subscription. This is the documented exception to the
    // set-state-in-effect rule: state must reflect an external system here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [applyHash]);

  // All navigation goes through the hash. Clicking the active destination
  // re-applies it (resetting scroll and filters) instead of doing nothing.
  const goHash = useCallback((hash) => {
    if (window.location.hash === hash) applyHash();
    else window.location.hash = hash;
  }, [applyHash]);

  function goHome() {
    goHash('#/');
  }

  function navigate(nextSection) {
    goHash(nextSection === 'home' ? '#/' : `#/${nextSection}`);
  }

  function navigateCategory(category) {
    goHash(`#/category/${encodeURIComponent(category)}`);
  }

  function openGame(gameId) {
    if (!isPlayable(findGame(gameId))) return;
    goHash(`#/game/${gameId}`);
  }

  function toggleFavorite(gameId) {
    setFavorites((current) => {
      const next = current.includes(gameId)
        ? current.filter((id) => id !== gameId)
        : [...current, gameId];
      writeList(FAVORITES_KEY, next);
      return next;
    });
  }

  function searchGames(nextQuery) {
    // Search is a filter over the current view, not a route: typing never
    // touches the hash, so the back button still means "where I was".
    setSearch(nextQuery);
  }

  const cardProps = {
    favorites,
    onFavorite: toggleFavorite,
    onOpen: openGame,
    isPlayable,
  };

  function renderHome() {
    return (
      <>
        <Hero onExplore={() => navigate('explore')} onCreate={() => goHash('#/create')} />

        <section className="wb-section">
          <SectionHeading kicker="START HERE" title="Featured games" actionLabel="View library" onAction={() => navigate('explore')} />
          <FeaturedRow games={featuredGames} {...cardProps} />
        </section>

        <section className="wb-section">
          <SectionHeading kicker="PLAY WITH OTHERS" title="Competitive rooms" actionLabel="See all" onAction={() => navigateCategory('Multiplayer')} />
          <GameGrid games={competitiveGames} {...cardProps} />
        </section>

        <section className="wb-browse-cta">
          <div>
            <h2>Browse the full library</h2>
            <p>{games.length} games, live or on the way.</p>
          </div>
          <button type="button" className="wb-btn wb-btn-secondary" onClick={() => navigate('explore')}>
            Browse all games
          </button>
        </section>
      </>
    );
  }

  function renderLibrary(title, kicker, list, emptyTitle, emptyDescription) {
    return (
      <section className="wb-section">
        <SectionHeading kicker={kicker} title={title} />
        {list.length > 0
          ? <GameGrid games={list} {...cardProps} />
          : <EmptyState title={emptyTitle} description={emptyDescription} onReset={goHome} />}
      </section>
    );
  }

  function renderBrowse() {
    if (query) {
      return renderLibrary(`“${search.trim()}”`, 'search results', searchResults, 'No games found', 'Try another title or category.');
    }
    switch (section) {
      case 'home':
        return renderHome();
      case 'explore':
        return (
          <section className="wb-section">
            <SectionHeading kicker="THE WHOLE LIBRARY" title="Explore games" />
            <CategoryChips categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} maxVisible={12} />
            <GameGrid games={categoryGames} {...cardProps} />
          </section>
        );
      case 'categories':
        return renderLibrary(selectedCategory, 'category', categoryGames, 'No games here just yet', 'Try browsing all games instead.');
      case 'favorites':
        return renderLibrary('Your Favorites', 'your library', favoriteGames, 'No favorites yet', 'Tap the heart on a game to save it here.');
      case 'recent':
        return renderLibrary('Recently Played', 'your library', recentList, 'Nothing played yet', 'Open a game and it will show up here.');
      default:
        return renderHome();
    }
  }

  return (
    <div className="wb-shell">
      <Header
        search={search}
        onSearch={searchGames}
        onNavigate={goHome}
        onExplore={() => navigate('explore')}
        activeView={canPlay ? null : section}
        onOpenCreate={() => goHash('#/create')}
      />

      <div className="wb-layout">
        <Sidebar
          section={section}
          selectedCategory={selectedCategory}
          categories={sidebarCategories}
          onNavigate={navigate}
          onCategory={navigateCategory}
          onOpenCreate={() => goHash('#/create')}
          onOpenAbout={() => goHash('#/about')}
        />

        <main className="wb-main">
          {canPlay ? (
            <GameStage
              key={activeGame.id}
              game={activeGame}
              favorite={favorites.includes(activeGame.id)}
              onFavorite={toggleFavorite}
              onExit={goHome}
            />
          ) : currentView === 'create' ? (
            <CreatePage onBack={goHome} />
          ) : currentView === 'about' ? (
            <AboutPage onBack={goHome} />
          ) : (
            renderBrowse()
          )}
        </main>
      </div>

      <footer className="wb-footer">
        <span className="wb-footer-brand">WhiteBox</span>
        <span>Browser games, shared instantly.</span>
        <span className="wb-footer-note">New rooms and creator tools in development.</span>
      </footer>
    </div>
  );
}
