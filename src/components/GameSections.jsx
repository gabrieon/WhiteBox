import GameCard from './GameCard.jsx';
import { Sparkle, Star, Scribble } from './Doodles.jsx';

export function SectionHeading({ kicker, title, accent = 'lime' }) {
  return (
    <div className="wb-section-head">
      <div>
        {kicker && <p className="wb-section-kicker">{kicker}</p>}
        <h2 className="wb-section-title">
          {title}
          <Star className={`wb-section-star wb-section-star-${accent}`} size={20} />
        </h2>
      </div>
      <Scribble className="wb-section-scribble" />
    </div>
  );
}

export function CategoryChips({ categories, selected, onSelect }) {
  return (
    <div className="wb-chips" role="group" aria-label="Filter games by category">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className={`wb-chip${selected === category ? ' is-selected' : ''}`}
          onClick={() => onSelect(category)}
          aria-pressed={selected === category}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

export function GameGrid({ games, favorites, onFavorite, onOpen, isPlayable }) {
  return (
    <div className="wb-grid">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          playable={isPlayable(game)}
          favorite={favorites.includes(game.id)}
          onFavorite={onFavorite}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

export function FeaturedRow({ games, favorites, onFavorite, onOpen, isPlayable }) {
  return (
    <div className="wb-featured-row">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          playable={isPlayable(game)}
          favorite={favorites.includes(game.id)}
          onFavorite={onFavorite}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, onReset }) {
  return (
    <div className="wb-empty">
      <Sparkle size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
      {onReset && (
        <button type="button" className="wb-btn wb-btn-secondary" onClick={onReset}>
          Browse all games
        </button>
      )}
    </div>
  );
}
