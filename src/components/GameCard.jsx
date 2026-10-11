import GameArt from './GameArt.jsx';

export default function GameCard({ game, favorite, onFavorite, onOpen, playable }) {
  return (
    <article className="wb-card">
      <button
        type="button"
        className={`wb-card-favorite${favorite ? ' is-favorite' : ''}`}
        onClick={() => onFavorite(game.id)}
        aria-label={`${favorite ? 'Remove' : 'Add'} ${game.title} ${favorite ? 'from' : 'to'} favorites`}
        aria-pressed={favorite}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.8 8.7c0 4.1-8.8 10-8.8 10s-8.8-5.9-8.8-10A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" />
        </svg>
      </button>

      <button
        type="button"
        className={`wb-card-media${playable ? '' : ' is-locked'}`}
        onClick={() => playable && onOpen(game.id)}
        disabled={!playable}
        aria-label={playable ? `Play ${game.title}` : `${game.title}, coming soon`}
      >
        <GameArt type={game.type} />
        {playable && (
          <span className="wb-card-play" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 12 7-12 7Z" /></svg>
            play
          </span>
        )}
        {!playable && <span className="wb-card-soon">coming soon</span>}
      </button>

      <div className="wb-card-body">
        <h3 className="wb-card-title">{game.title}</h3>
        <p className="wb-card-desc">{game.description}</p>
        <div className="wb-card-tags">
          {game.categories.map((category) => (
            <span className="wb-tag" key={category}>{category}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
