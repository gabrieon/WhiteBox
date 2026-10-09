import { useState } from 'react';
import './App.css';

const categories = ['All Games', 'Tests', 'Guessing', 'Knowledge', 'Visual', 'Multiplayer'];

const gameCatalog = [
  {
    id: 'reaction-test',
    title: 'Reaction Test',
    description: 'How fast can you react?',
    categories: ['Tests'],
    available: true,
  },
  {
    id: 'guess-the-country',
    title: 'Guess the Country',
    description: 'Can you identify the country?',
    categories: ['Guessing', 'Knowledge'],
    available: false,
  },
  {
    id: 'human-or-ai',
    title: 'Human or AI',
    description: 'Can you tell what is real?',
    categories: ['Visual'],
    available: false,
  },
];

function GameCard({ game, onPlay }) {
  return (
    <article className="game-card">
      <h4>{game.title}</h4>
      <p>{game.description}</p>
      {game.available ? (
        <button onClick={() => onPlay(game.id)}>Play</button>
      ) : (
        <button disabled>Coming soon</button>
      )}
    </article>
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

  function openGame(gameId) {
    if (gameId === 'reaction-test') {
      setCurrentView('reaction-test');
    }
  }

  return (
    <div className="app">
      <header className="header">
        <button className="brand" onClick={showGames} aria-label="PlayWhiteBox home">
          PlayWhiteBox
        </button>

        <nav aria-label="Main navigation">
          {['Games', 'Create', 'About'].map((view) => {
            const viewId = view.toLowerCase();
            const isSelected = currentView === viewId || (viewId === 'games' && currentView === 'reaction-test');

            return (
              <button
                key={viewId}
                className={isSelected ? 'selected' : ''}
                onClick={() => (viewId === 'games' ? showGames() : setCurrentView(viewId))}
                aria-pressed={isSelected}
              >
                {view}
              </button>
            );
          })}
        </nav>
      </header>

      {currentView === 'games' && (
        <>
          <main>
            <h2>What do you want to play?</h2>
            <p>Play quick games, tests, and challenges.</p>
            <div className="categories" aria-label="Filter games by category">
              {categories.map((category) => (
                <button
                  key={category}
                  className={selectedCategory === category ? 'selected' : ''}
                  onClick={() => setSelectedCategory(category)}
                  aria-pressed={selectedCategory === category}
                >
                  {category}
                </button>
              ))}
            </div>
          </main>
          <section className="games" aria-labelledby="games-heading">
            <h3 id="games-heading">
              {selectedCategory === 'All Games' ? 'Featured Games' : `${selectedCategory} Games`}
            </h3>
            {visibleGames.length > 0 ? (
              <div className="game-grid">
                {visibleGames.map((game) => (
                  <GameCard key={game.id} game={game} onPlay={openGame} />
                ))}
              </div>
            ) : (
              <p className="empty-games">No games in this category yet.</p>
            )}
          </section>
        </>
      )}

      {currentView === 'create' && (
        <main className="info-view">
          <h2>WhiteBox Studio</h2>
          <p>
            The visual game creator will let the owner configure game templates and publish
            games. It is not available yet.
          </p>
        </main>
      )}

      {currentView === 'about' && (
        <main className="info-view">
          <h2>About WhiteBox</h2>
          <p>
            WhiteBox is a browser-based platform for competitive games and challenges.
          </p>
        </main>
      )}

      {currentView === 'reaction-test' && (
        <main className="reaction-screen">
          <button className="back-button" onClick={showGames}>
            Back to Games
          </button>
          <h2>Reaction Test</h2>
          <p>This game is not playable yet. Reaction timing and scoring are not implemented.</p>
        </main>
      )}
    </div>
  );
}

export default App;
