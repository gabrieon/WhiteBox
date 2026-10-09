import { useMemo, useState } from 'react';
import './App.css';

const categories = ['All games', 'Tests', 'Guessing', 'Knowledge', 'Visual', 'Multiplayer'];

const games = [
  {
    id: 'reaction-test',
    title: 'Reaction Test',
    description: 'A quick challenge for your reflexes and focus.',
    categories: ['Tests'],
    type: 'reaction',
    playable: true,
  },
  {
    id: 'guess-the-country',
    title: 'Guess the Country',
    description: 'Use the clues to find your way around the world.',
    categories: ['Guessing', 'Knowledge'],
    type: 'country',
    playable: false,
  },
  {
    id: 'human-or-ai',
    title: 'Human or AI',
    description: 'Can you tell what is real at a glance?',
    categories: ['Visual'],
    type: 'visual',
    playable: false,
  },
];

function Icon({ name, size = 18 }) {
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-7h6v7" /></>,
    discover: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5M9 13l2-4 4-2-2 4-4 2Z" /></>,
    categories: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    heart: <path d="M20.8 8.7c0 4.1-8.8 10-8.8 10s-8.8-5.9-8.8-10A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    play: <path d="m9 6 10 6-10 6V6Z" />,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  };

  return <svg {...shared}>{paths[name]}</svg>;
}

function Brand({ onClick }) {
  return (
    <button className="brand" type="button" onClick={onClick} aria-label="WhiteBox home">
      <span className="brand-symbol" aria-hidden="true"><span /></span>
      <span>WhiteBox</span>
    </button>
  );
}

function Header({ search, onSearch, onHome }) {
  return (
    <header className="topbar">
      <Brand onClick={onHome} />
      <div className="search-box">
        <Icon name="search" size={19} />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search games"
          aria-label="Search games"
        />
        {search && (
          <button type="button" className="clear-search" onClick={() => onSearch('')} aria-label="Clear search">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
      <div className="account-actions" aria-label="Account actions">
        <span className="account-note">Player accounts coming soon</span>
        <button className="account-button sign-in" type="button" disabled title="Sign in is not available yet">
          Sign in
        </button>
        <button className="account-button sign-up" type="button" disabled title="Player accounts are not available yet">
          <Icon name="plus" size={16} /> Sign up
        </button>
      </div>
    </header>
  );
}

function Sidebar({ section, selectedCategory, onNavigate, onCategory, onPage }) {
  const primaryLinks = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'discover', label: 'Discover', icon: 'discover' },
  ];
  const libraryLinks = [
    { id: 'favorites', label: 'Favorites', icon: 'heart' },
    { id: 'recent', label: 'Recently Played', icon: 'clock' },
  ];

  return (
    <aside className="sidebar" aria-label="Game navigation">
      <div className="side-links">
        {primaryLinks.map(({ id, label, icon }) => (
          <button
            key={id}
            className={`side-link${section === id ? ' active' : ''}`}
            type="button"
            onClick={() => onNavigate(id)}
            aria-current={section === id ? 'page' : undefined}
          >
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
      </div>

      <div className="side-divider" />
      <p className="sidebar-label">Categories</p>
      <div className="side-links category-links">
        {categories.slice(1).map((category) => (
          <button
            key={category}
            className={`side-link category-side-link${section === 'categories' && selectedCategory === category ? ' active' : ''}`}
            type="button"
            onClick={() => onCategory(category)}
            aria-current={section === 'categories' && selectedCategory === category ? 'page' : undefined}
          >
            <span className="category-marker" aria-hidden="true" />
            <span>{category}</span>
          </button>
        ))}
      </div>

      <div className="side-divider" />
      <p className="sidebar-label">Your library</p>
      <div className="side-links">
        {libraryLinks.map(({ id, label, icon }) => (
          <button
            key={id}
            className={`side-link${section === id ? ' active' : ''}`}
            type="button"
            onClick={() => onNavigate(id)}
            aria-current={section === id ? 'page' : undefined}
          >
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
      </div>

      <div className="side-divider" />
      <p className="sidebar-label">WhiteBox</p>
      <div className="side-links">
        <button className="side-link" type="button" onClick={() => onPage('create')}>
          <Icon name="plus" /><span>Creator Studio</span>
        </button>
        <button className="side-link" type="button" onClick={() => onPage('about')}>
          <span className="about-marker" aria-hidden="true">i</span><span>About WhiteBox</span>
        </button>
      </div>

      <div className="sidebar-note">
        <span className="sidebar-note-icon">W</span>
        <p>Your next favorite game is just around the corner.</p>
      </div>
    </aside>
  );
}

function GameThumbnail({ game }) {
  return (
    <div className={`game-thumbnail thumbnail-${game.type}`} aria-hidden="true">
      {game.type === 'reaction' && (
        <div className="reaction-visual">
          <span className="reaction-ring"><span><i /></span></span>
        </div>
      )}
      {game.type === 'country' && (
        <div className="country-visual">
          <svg viewBox="0 0 160 110" role="presentation">
            <path d="m20 31 12-12 16 2 7 11 13 1 5 13-8 7-4 15-13 8-12-8-4-14-12-5Z" />
            <path d="m76 26 12-8 12 5 3 11-8 8-2 13-8 8-11-8 3-12-8-7Z" />
            <path d="m99 56 14-8 19 4 6 12-9 14-17 2-11-9Z" />
            <path d="m53 80 13-7 8 9-5 9-12 1Z" />
            <circle cx="111" cy="64" r="3" />
          </svg>
        </div>
      )}
      {game.type === 'visual' && (
        <div className="visual-visual">
          <span className="visual-card visual-card-one"><i /></span>
          <span className="visual-card visual-card-two"><i /></span>
          <span className="visual-question">?</span>
        </div>
      )}
    </div>
  );
}

function GameCard({ game, favorite, onFavorite, onOpen }) {
  return (
    <article className="game-card">
      <button
        className={`favorite-toggle${favorite ? ' is-favorite' : ''}`}
        type="button"
        onClick={() => onFavorite(game.id)}
        aria-label={`${favorite ? 'Remove' : 'Add'} ${game.title} ${favorite ? 'from' : 'to'} favorites`}
        aria-pressed={favorite}
      >
        <Icon name="heart" size={17} />
      </button>
      <button
        className={`thumbnail-button${game.playable ? '' : ' not-ready'}`}
        type="button"
        onClick={() => game.playable && onOpen(game.id)}
        disabled={!game.playable}
        aria-label={game.playable ? `Open ${game.title} preview` : `${game.title}, coming soon`}
      >
        <GameThumbnail game={game} />
        {game.playable && <span className="thumbnail-play"><Icon name="play" size={19} /></span>}
        {!game.playable && <span className="coming-soon-label">Coming soon</span>}
      </button>
      <div className="game-card-details">
        <div className="game-title-line">
          <h3>{game.title}</h3>
        </div>
        <p>{game.categories.join(' · ')}{!game.playable && ' · Coming soon'}</p>
      </div>
    </article>
  );
}

function EmptyState({ title, description, onReset }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon"><Icon name="discover" size={23} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {onReset && <button type="button" className="empty-reset" onClick={onReset}>Browse all games</button>}
    </div>
  );
}

function App() {
  const [section, setSection] = useState('home');
  const [selectedCategory, setSelectedCategory] = useState('All games');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [recentGames, setRecentGames] = useState([]);
  const [currentView, setCurrentView] = useState('browse');

  const filteredGames = useMemo(() => games.filter((game) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query
      || game.title.toLowerCase().includes(query)
      || game.description.toLowerCase().includes(query)
      || game.categories.some((category) => category.toLowerCase().includes(query));
    const matchesCategory = section !== 'categories' && section !== 'discover' && section !== 'home'
      || selectedCategory === 'All games'
      || game.categories.includes(selectedCategory);
    const matchesFavorites = section !== 'favorites' || favorites.includes(game.id);
    const matchesRecent = section !== 'recent' || recentGames.includes(game.id);
    return matchesSearch && matchesCategory && matchesFavorites && matchesRecent;
  }), [favorites, recentGames, search, section, selectedCategory]);

  function goHome() {
    setCurrentView('browse');
    setSection('home');
    setSelectedCategory('All games');
  }

  function navigate(nextSection) {
    setCurrentView('browse');
    setSection(nextSection);
    if (nextSection === 'discover' || nextSection === 'home') {
      setSelectedCategory('All games');
    }
  }

  function navigateCategory(category) {
    setCurrentView('browse');
    setSection('categories');
    setSelectedCategory(category);
  }

  function openGame(gameId) {
    if (!games.some((game) => game.id === gameId && game.playable)) return;
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

  function searchGames(query) {
    setSearch(query);
    if (query.trim()) {
      setCurrentView('browse');
      setSection('discover');
      setSelectedCategory('All games');
    }
  }

  function gameCards(list) {
    return (
      <div className="game-grid">
        {list.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            favorite={favorites.includes(game.id)}
            onFavorite={toggleFavorite}
            onOpen={openGame}
          />
        ))}
      </div>
    );
  }

  const sectionTitles = {
    home: 'All games',
    discover: 'Discover games',
    categories: selectedCategory,
    favorites: 'Your favorites',
    recent: 'Recently played',
  };

  return (
    <div className="app-shell">
      <Header search={search} onSearch={searchGames} onHome={goHome} />
      <div className="app-layout">
        <Sidebar
          section={section}
          selectedCategory={selectedCategory}
          onNavigate={navigate}
          onCategory={navigateCategory}
          onPage={setCurrentView}
        />
        <main className="main-content">
          {currentView === 'browse' && (
            <section className="discovery-view">
              <div className="discovery-header">
                <div>
                  <p className="discovery-kicker">
                    {search.trim() ? 'SEARCH RESULTS' : section === 'favorites' || section === 'recent' ? 'YOUR LIBRARY' : 'WHITEBOX GAMES'}
                  </p>
                  <h1>
                    {search.trim()
                      ? 'Search results'
                      : section === 'home' && selectedCategory !== 'All games'
                        ? selectedCategory
                        : sectionTitles[section] || 'Discover games'}
                  </h1>
                </div>
                <span className="result-count">{filteredGames.length} {filteredGames.length === 1 ? 'GAME' : 'GAMES'}</span>
              </div>
              {(section === 'discover' || section === 'home') && !search.trim() && (
                <div className="filter-row" role="group" aria-label="Filter games by category">
                  {categories.map((category) => (
                    <button
                      key={category}
                      className={`filter-chip${selectedCategory === category ? ' selected' : ''}`}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      aria-pressed={selectedCategory === category}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}
              {filteredGames.length > 0
                ? gameCards(filteredGames)
                : <EmptyState
                    title={search.trim() ? 'No games found' : section === 'favorites' ? 'No favorites yet' : section === 'recent' ? 'Nothing played yet' : 'No games here just yet'}
                    description={search.trim() ? 'Try another title or category.' : section === 'favorites' ? 'Tap the heart on a game to save it here.' : section === 'recent' ? 'Open a game preview and it will show up here.' : 'Try browsing all games instead.'}
                    onReset={section === 'categories' || section === 'discover' ? () => navigate('home') : undefined}
                  />}
            </section>
          )}

          {currentView === 'create' && (
            <section className="placeholder-page">
              <span className="placeholder-icon"><Icon name="plus" size={27} /></span>
              <p className="discovery-kicker">WHITEBOX STUDIO</p>
              <h1>Create something <span>playable.</span></h1>
              <p>The visual Game Creator is planned for a future release. It is not available yet.</p>
              <button className="primary-button" type="button" onClick={goHome}>Back to games</button>
            </section>
          )}

          {currentView === 'about' && (
            <section className="placeholder-page">
              <span className="placeholder-icon"><span className="brand-symbol"><span /></span></span>
              <p className="discovery-kicker">ABOUT WHITEBOX</p>
              <h1>A little room <span>to play.</span></h1>
              <p>WhiteBox is a browser-based home for quick games, curious challenges, and friendly competition.</p>
              <button className="primary-button" type="button" onClick={goHome}>Explore games</button>
            </section>
          )}

          {games.some((game) => game.id === currentView) && (
            <section className="game-detail">
              <button className="back-link" type="button" onClick={goHome}>← Back to games</button>
              <div className="game-detail-card">
                <GameThumbnail game={games.find((game) => game.id === currentView)} />
                <div className="game-detail-copy">
                  <p className="discovery-kicker">GAME PREVIEW</p>
                  <h1>Reaction Test</h1>
                  <p>This game is not playable yet. Reaction timing and scoring are not implemented.</p>
                  <span className="preview-notice">Preview only · gameplay is in development</span>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
      <footer className="site-footer">
        <Brand onClick={goHome} />
        <span>Quick games. Curious minds. Welcome to WhiteBox.</span>
        <span>PLAYER ACCOUNTS & GAMEPLAY FEATURES IN DEVELOPMENT</span>
      </footer>
    </div>
  );
}

export default App;
