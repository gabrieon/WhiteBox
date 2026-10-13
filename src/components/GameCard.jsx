import GameArt from './GameArt.jsx';

export default function GameCard({ game, onOpen, playable }) {
  return (
    <article className={`wb-card${playable ? ' is-playable' : ''}`}>
      <button
        type="button"
        className="wb-card-media"
        onClick={() => playable && onOpen(game.id)}
        aria-disabled={!playable}
        aria-label={playable ? `Play ${game.title}` : `${game.title}, coming soon`}
      >
        <GameArt type={game.type} />
      </button>
      <h3 className="wb-card-title">{game.title}</h3>
    </article>
  );
}
