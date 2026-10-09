import { useState } from 'react';
import './App.css';

const categories = ['All Games', 'Tests', 'Guessing', 'Knowledge', 'Visual', 'Multiplayer'];

const gameCatalog = [
  {
    id: 'reaction-test',
    title: 'Reaction Test',
    description: 'A quick test of your reflexes and focus.',
    categories: ['Tests'],
    theme: 'reaction',
    mark: 'RT',
    status: 'Preview',
  },
  {
    id: 'guess-the-country',
    title: 'Guess the Country',
    description: 'Read the clues and find your way around the map.',
    categories: ['Guessing', 'Knowledge'],
    theme: 'country',
    mark: '01',
    status: 'Coming soon',
  },
  {
    id: 'human-or-ai',
    title: 'Human or AI',
    description: 'Put your eye for detail to the ultimate test.',
    categories: ['Visual'],
    theme: 'visual',
    mark: 'AI?',
    status: 'Coming soon',
  },
];

function ActionButton({ children, className = '', onClick, disabled = false }) {
  return (
    <button
      className={`action-button ${className}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Header({ currentView, onNavigate }) {
  const navigation = [
    { id: 'games', label: 'Games' },
    { id: 'create', label: 'Create' },
    { id: 'about', label: 'About' },
  ];

  return (
    <header className="site-header">
      <button
        className="brand"
        type="button"
        onClick={() => onNavigate('games')}
        aria-label="WhiteBox home"
      >
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
        </span>
        <span>whitebox</span>
      </button>

      <nav className="main-nav" aria-label="Main navigation">
        {navigation.map(({ id, label }) => {
          const isSelected =
            currentView === id || (id === 'games' && currentView === 'reaction-test');

          return (
            <button
              key={id}
              className={`nav-link${isSelected ? ' selected' : ''}`}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={isSelected ? 'page' : undefined}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <span className="header-note"><span className="status-dot" /> A little room to play</span>
    </header>
  );
}

function GameCard({ game, onOpen }) {
  const canOpen = game.id === 'reaction-test';

  return (
    <article className={`game-card game-card-${game.theme}`}>
      <div className={`game-art game-art-${game.theme}`} aria-hidden="true">
        <span className="art-orbit art-orbit-one" />
        <span className="art-orbit art-orbit-two" />
        <span className="art-mark">{game.mark}</span>
        <span className="art-index">{game.categories[0]}</span>
      </div>
      <div className="game-card-content">
        <div className="game-card-heading">
          <h3>{game.title}</h3>
          <span className={`game-status${canOpen ? ' status-preview' : ''}`}>
            <span className="status-dot" />
            {game.status}
          </span>
        </div>
        <p>{game.description}</p>
        {canOpen ? (
          <ActionButton className="card-action" onClick={() => onOpen(game.id)}>
            View preview <span aria-hidden="true">↗</span>
          </ActionButton>
        ) : (
          <ActionButton className="card-action" disabled>
            Coming soon
          </ActionButton>
        )}
      </div>
    </article>
  );
}

function CategoryFilter({ selectedCategory, onSelect }) {
  return (
    <div className="category-list" role="group" aria-label="Filter games by category">
      {categories.map((category) => (
        <button
          key={category}
          className={`category-chip${selectedCategory === category ? ' selected' : ''}`}
          type="button"
          onClick={() => onSelect(category)}
          aria-pressed={selectedCategory === category}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

function App() {
  const [currentView, setCurrentView] = useState('games');
  const [selectedCategory, setSelectedCategory] = useState('All Games');

  const visibleGames = gameCatalog.filter(
    (game) =>
      selectedCategory === 'All Games' || game.categories.includes(selectedCategory),
  );

  function showGames() {
    setCurrentView('games');
    setSelectedCategory('All Games');
  }

  function navigateTo(view) {
    if (view === 'games') {
      showGames();
      return;
    }

    setCurrentView(view);
  }

  function openGame(gameId) {
    if (gameId === 'reaction-test') {
      setCurrentView('reaction-test');
    }
  }

  return (
    <div className="app-shell">
      <div className="page-frame">
        <Header currentView={currentView} onNavigate={navigateTo} />

        {currentView === 'games' && (
          <main>
            <section className="hero" aria-labelledby="hero-title">
              <div className="hero-copy">
                <p className="eyebrow"><span className="eyebrow-line" /> YOUR NEXT LITTLE OBSESSION</p>
                <h1 id="hero-title">Play a little.<br /><span>Think a lot.</span></h1>
                <p className="hero-description">
                  Quick games, curious challenges, and friendly competition. Find a new favorite
                  and jump right in.
                </p>
                <ActionButton className="hero-action" onClick={showGames}>
                  Explore the games <span aria-hidden="true">↓</span>
                </ActionButton>
              </div>

              <div className="hero-art" aria-label="WhiteBox game collection">
                <div className="hero-glow" />
                <div className="hero-tile hero-tile-back"><span>?</span></div>
                <div className="hero-tile hero-tile-middle"><span>◉</span></div>
                <div className="hero-tile hero-tile-front">
                  <span className="hero-tile-label">WHITEBOX / 001</span>
                  <span className="hero-tile-symbol">W<span>.</span></span>
                  <span className="hero-tile-caption">A good place to play</span>
                </div>
                <span className="hero-art-caption">A WORLD OF QUICK PLAY</span>
              </div>
            </section>

            <section className="library-section" aria-labelledby="games-heading">
              <div className="section-heading">
                <div>
                  <p className="eyebrow section-eyebrow">THE ARCADE</p>
                  <h2 id="games-heading">
                    {selectedCategory === 'All Games' ? 'Find your game' : selectedCategory}
                  </h2>
                  <p className="section-description">
                    {selectedCategory === 'All Games'
                      ? 'A small collection of big distractions.'
                      : `Browse ${selectedCategory.toLowerCase()} games in the collection.`}
                  </p>
                </div>
                <span className="collection-count">
                  {String(visibleGames.length).padStart(2, '0')} <span>GAMES</span>
                </span>
              </div>

              <CategoryFilter
                selectedCategory={selectedCategory}
                onSelect={setSelectedCategory}
              />

              {visibleGames.length > 0 ? (
                <div className="game-grid">
                  {visibleGames.map((game) => (
                    <GameCard key={game.id} game={game} onOpen={openGame} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-mark" aria-hidden="true">···</span>
                  <h3>Nothing in this corner just yet.</h3>
                  <p>We’re making room for more games. Check back soon.</p>
                </div>
              )}
            </section>
          </main>
        )}

        {currentView === 'create' && (
          <main className="subpage">
            <p className="eyebrow"><span className="eyebrow-line" /> THE WORKSHOP</p>
            <p className="subpage-index">WHITEBOX / STUDIO</p>
            <h1>Make room<br /><span>for play.</span></h1>
            <p className="subpage-description">
              WhiteBox Studio is where new games will take shape. The visual creator is not
              available yet, but this is where the making will happen.
            </p>
            <ActionButton className="subpage-action" onClick={showGames}>Back to the games</ActionButton>
          </main>
        )}

        {currentView === 'about' && (
          <main className="subpage about-page">
            <p className="eyebrow"><span className="eyebrow-line" /> A NOTE ABOUT US</p>
            <p className="subpage-index">WHITEBOX / ABOUT</p>
            <h1>Small games.<br /><span>Good company.</span></h1>
            <p className="subpage-description">
              WhiteBox is a browser-based home for quick games, curious challenges, and
              friendly competition. Pick something, take a break, and see how you do.
            </p>
            <ActionButton className="subpage-action" onClick={showGames}>Browse the games</ActionButton>
          </main>
        )}

        {currentView === 'reaction-test' && (
          <main className="preview-page">
            <button className="text-back-button" type="button" onClick={showGames}>
              <span aria-hidden="true">←</span> Back to games
            </button>
            <div className="preview-panel">
              <p className="eyebrow"><span className="eyebrow-line" /> GAME PREVIEW / 001</p>
              <div className="preview-symbol" aria-hidden="true">RT</div>
              <h1>Reaction Test</h1>
              <p>
                A quick test of your reflexes and focus. The game is not playable yet; reaction
                timing and scoring are still in development.
              </p>
              <span className="preview-status"><span className="status-dot" /> In development</span>
            </div>
          </main>
        )}

        <footer className="site-footer">
          <span>WHITEBOX <span className="footer-dot">/</span> PLAY SOMETHING DIFFERENT.</span>
          <span>MADE FOR THE MOMENT BETWEEN MOMENTS</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
