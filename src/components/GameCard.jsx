import GameArt from './GameArt.jsx';

// Small grey line under the title: genre + mode. This metadata is what makes a
// game grid read as "full" the way a real game site does — no decoration
// needed, just information.
function metaLine(game) {
  const genres = (game.categories || []).slice(0, 2);
  const mode = game.mode
    || ((game.playModes || []).includes('multiplayer') ? 'Multiplayer' : 'Solo');
  return [...genres, mode].filter(Boolean).join(' · ');
}

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
        <GameArt type={game.type} thumb={`/thumbs/${game.id}.jpg`} />
        <span className={playable ? 'wb-card-play' : 'wb-card-soon'}>
          {playable ? 'Play' : 'Soon'}
        </span>
      </button>
      <h3 className="wb-card-title">{game.title}</h3>
      <p className="wb-card-meta">{metaLine(game)}</p>
    </article>
  );
}