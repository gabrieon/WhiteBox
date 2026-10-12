import GameArt from './GameArt.jsx';

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m8 5 12 7-12 7Z" />
    </svg>
  );
}

function HeartIcon({ filled }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 8.7c0 4.1-8.8 10-8.8 10s-8.8-5.9-8.8-10A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" />
    </svg>
  );
}

export default function GameCard({ game, favorite, onFavorite, onOpen, playable, featured = false }) {
  const mode = game.mode || (game.playModes?.includes('multiplayer') ? 'Multiplayer' : 'Solo');
  const primaryCategory = game.categories[0];

  return (
    <article className={`wb-card${featured ? ' wb-card-featured' : ''}${playable ? ' is-playable' : ''}`}>
      <div className="wb-card-cover">
        {/*
          Locked games stay focusable buttons rather than `disabled` ones: a
          disabled control is skipped by keyboard and screen-reader users, so
          they would never learn the game exists. aria-disabled communicates the
          locked state without removing it from the tab order.
        */}
        <button
          type="button"
          className="wb-card-media"
          onClick={() => playable && onOpen(game.id)}
          aria-disabled={!playable}
          aria-label={playable ? `Play ${game.title}` : `${game.title}, coming soon`}
        >
          <GameArt type={game.type} />
          <span className="wb-card-cover-shade" aria-hidden="true" />
          {playable ? (
            <span className="wb-card-play" aria-hidden="true"><PlayIcon /> Play now</span>
          ) : (
            <span className="wb-card-soon">Coming soon</span>
          )}
        </button>

        <button
          type="button"
          className={`wb-card-favorite${favorite ? ' is-favorite' : ''}`}
          onClick={() => onFavorite(game.id)}
          aria-label={`${favorite ? 'Remove' : 'Add'} ${game.title} ${favorite ? 'from' : 'to'} favorites`}
          aria-pressed={favorite}
        >
          <HeartIcon filled={favorite} />
        </button>
      </div>

      <div className="wb-card-body">
        <div className="wb-card-title-row">
          <h3 className="wb-card-title">{game.title}</h3>
          {playable && <span className="wb-card-live"><span className="wb-live-dot" aria-hidden="true" /> Live</span>}
        </div>
        <p className="wb-card-meta">{mode}{primaryCategory ? ` · ${primaryCategory}` : ''}</p>
      </div>
    </article>
  );
}
