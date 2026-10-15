import GameArt from './GameArt.jsx';
import { thumbUrl } from '../sdk/games/api.js';

// Small grey line under the title: genre + mode. This metadata is what makes a
// game grid read as "full" the way a real game site does — no decoration
// needed, just information.
function metaLine(game) {
  const genres = (game.categories || []).slice(0, 2);
  const mode = game.mode
    || ((game.playModes || []).includes('multiplayer') ? 'Multiplayer' : 'Solo');
  const parts = [...genres, mode].filter(Boolean);
  // Player-created games name their author, so it is clear the library mixes
  // shipped titles with community ones.
  if (game.origin === 'user' && game.creatorName) parts.push(`by ${game.creatorName}`);
  return parts.join(' · ');
}

export default function GameCard({ game, onOpen, playable, meta }) {
  // One click handler for both entry points: the thumbnail and the Play
  // capsule. Catalog-only games stay inert and are marked "Soon".
  function open() {
    if (playable) onOpen(game.id);
  }

  // Built-in games have a checked-in photo under /thumbs. Player-created games
  // use whatever was uploaded, or nothing at all — asking for /thumbs/<uuid>.jpg
  // would fire a 404 per card and buy a broken image that only onError hides.
  const photo = game.thumbKey
    ? thumbUrl(game)
    : (game.origin === 'user' ? null : `/thumbs/${game.id}.jpg`);

  return (
    <article className={`wb-card${playable ? ' is-playable' : ''}`}>
      <button
        type="button"
        className="wb-card-media"
        onClick={open}
        aria-disabled={!playable}
        aria-label={playable ? `Play ${game.title}` : `${game.title}, coming soon`}
      >
        <GameArt type={game.type} thumb={photo} />
        {!playable && <span className="wb-card-soon">Soon</span>}
      </button>

      <div className="wb-card-foot">
        <h3 className="wb-card-title">{game.title}</h3>
        <button
          type="button"
          className="wb-card-play-btn"
          onClick={open}
          disabled={!playable}
          aria-label={playable ? `Play ${game.title}` : `${game.title}, coming soon`}
        >
          Play
        </button>
      </div>

      <p className="wb-card-meta">{meta || metaLine(game)}</p>
    </article>
  );
}