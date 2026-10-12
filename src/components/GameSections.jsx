import { useState } from 'react';
import GameCard from './GameCard.jsx';

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function SectionHeading({ kicker, title, actionLabel, onAction }) {
  return (
    <div className="wb-section-head">
      <div>
        {kicker && <p className="wb-section-kicker">{kicker}</p>}
        <h2 className="wb-section-title">{title}</h2>
      </div>
      {onAction && (
        <button type="button" className="wb-section-action" onClick={onAction}>
          {actionLabel || 'View all'}
          <ArrowIcon />
        </button>
      )}
    </div>
  );
}

export function CategoryChips({ categories, selected, onSelect, maxVisible = 0 }) {
  const [expanded, setExpanded] = useState(false);
  let visible = categories;
  if (maxVisible > 0 && !expanded && categories.length > maxVisible) {
    visible = categories.slice(0, maxVisible);
    if (!visible.includes(selected)) visible = [selected, ...visible.slice(0, maxVisible - 1)];
  }
  const hiddenCount = categories.length - visible.length;

  return (
    <div className="wb-chips" role="group" aria-label="Filter games by category">
      {visible.map((category) => (
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
      {hiddenCount > 0 && (
        <button type="button" className="wb-chip wb-chip-more" onClick={() => setExpanded(true)}>
          +{hiddenCount} more
        </button>
      )}
      {expanded && maxVisible > 0 && (
        <button type="button" className="wb-chip wb-chip-more" onClick={() => setExpanded(false)}>
          Show less
        </button>
      )}
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
          featured
        />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, onReset }) {
  return (
    <div className="wb-empty">
      <span className="wb-empty-icon" aria-hidden="true">⌕</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {onReset && (
        <button type="button" className="wb-btn wb-btn-secondary" onClick={onReset}>
          Browse games
        </button>
      )}
    </div>
  );
}
