import { useMemo, useState } from 'react';
import './App.css';
import { findGame, games, isPlayable, listCategories } from './games/registry.js';
import GameHost from './sdk/GameHost.jsx';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import Hero from './components/Hero.jsx';
import GameArt from './components/GameArt.jsx';
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

export default function App() {
  const [section, setSection] = useState('home');
  const [selectedCategory, setSelectedCategory] = useState('All games');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [recentGames, setRecentGames] = useState([]);
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

  function goHome() {
    setCurrentView('browse');
    setSection('home');
    setSelectedCategory('All games');
    setSearch('');
  }

  function navigate(nextSection) {
    setCurrentView('browse');
    setSection(nextSection);
    if (nextSection === 'home' || nextSection === 'explore') setSelectedCategory('All games');
  }

  function navigateCategory(category) {
    setCurrentView('browse');
    setSection('categories');
    setSelectedCategory(category);
  }

  function openGame(gameId) {
    if (!isPlayable(findGame(gameId))) return;
    setRecentGames((current) => [gameId, ...current.filter((id) => id !== gameId)]);
    setCurrentView(gameId);
  }

  function toggleFavorite(gameId) {
    setFavorites((current) =>
      current.includes(gameId)
        ? current.filter((id) => id !== gameId)
        : [...current, gameId],
    );
  }

  function searchGames(nextQuery) {
    setSearch(nextQuery);
    if (nextQuery.trim()) {
      setCurrentView('browse');
      setSection('explore');
    }
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
        <Hero onExplore={() => navigate('explore')} onCreate={() => setCurrentView('create')} />

        <section className="wb-section">
          <SectionHeading kicker="hand picked" title="Featured Games" />
          <FeaturedRow games={games} {...cardProps} />
        </section>

        <section className="wb-section">
          <SectionHeading kicker="dig around" title="Explore Games" accent="ink" />
          <CategoryChips categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
          {categoryGames.length > 0
            ? <GameGrid games={categoryGames} {...cardProps} />
            : <EmptyState title="No games here just yet" description="Try another category." onReset={() => setSelectedCategory('All games')} />}
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
            <SectionHeading kicker="the whole library" title="Explore Games" />
            <CategoryChips categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
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
        onOpenCreate={() => setCurrentView('create')}
      />

      <div className="wb-layout">
        <Sidebar
          section={section}
          selectedCategory={selectedCategory}
          categories={sidebarCategories}
          onNavigate={navigate}
          onCategory={navigateCategory}
          onOpenCreate={() => setCurrentView('create')}
          onOpenAbout={() => setCurrentView('about')}
        />

        <main className="wb-main">
          {canPlay ? (
            <section className="wb-game-stage">
              <button type="button" className="wb-back" onClick={goHome}>← back to the box</button>
              <div className="wb-game-head">
                <GameArt type={activeGame.type} />
                <div className="wb-game-head-copy">
                  <p className="wb-section-kicker">now playing</p>
                  <h1>{activeGame.title}</h1>
                  <p>{activeGame.description}</p>
                </div>
              </div>
              <GameHost manifest={activeGame} onExit={goHome} />
            </section>
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
        <span>quick games · curious minds · welcome in</span>
        <span className="wb-footer-note">player accounts & more games in development</span>
      </footer>
    </div>
  );
}
