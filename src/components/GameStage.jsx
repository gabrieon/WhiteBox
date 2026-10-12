import { useCallback, useEffect, useRef, useState } from 'react';
import GameHost from '../sdk/GameHost.jsx';
import GameArt from './GameArt.jsx';

const INPUT_LABELS = {
  keyboard: 'Keyboard',
  mouse: 'Mouse',
  touch: 'Touch',
  'pointer-lock': 'Pointer lock',
  gamepad: 'Gamepad',
};

function BackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 2.6-6.3" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function HeartIcon({ filled }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 8.7c0 4.1-8.8 10-8.8 10s-8.8-5.9-8.8-10A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" />
    </svg>
  );
}

export default function GameStage({ game, favorite, onFavorite, onExit }) {
  const frameRef = useRef(null);
  const [runId, setRunId] = useState(0);
  // GameStage is keyed by game id (see App.jsx), so a fresh mount already
  // means a fresh session — no reset effect needed here.
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const restart = useCallback(() => {
    setRunId((n) => n + 1);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  const mode = game.mode || (game.playModes?.includes('multiplayer') ? 'Multiplayer' : 'Solo');
  const inputs = (game.input || []).map((key) => INPUT_LABELS[key] || key);
  const players = game.players?.max > 1 ? `${game.players.min}–${game.players.max} players` : 'Single player';

  return (
    <section className="wb-game-page" aria-label={`Play ${game.title}`}>
      <div className="wb-game-breadcrumb">
        <button type="button" className="wb-back" onClick={onExit}>
          <BackIcon />
          Library
        </button>
        <span className="wb-game-crumb-sep" aria-hidden="true">/</span>
        <span className="wb-game-crumb-current">{game.title}</span>
        <span className="wb-game-crumb-live">
          <span className="wb-live-dot" aria-hidden="true" />
          Live
        </span>
      </div>

      <div className="wb-game-hero">
        <div className="wb-game-cover">
          <GameArt type={game.type} />
        </div>
        <div className="wb-game-hero-copy">
          <p className="wb-game-meta">{mode} · {players}</p>
          <h1 className="wb-game-title">{game.title}</h1>
          <p className="wb-game-desc">{game.description}</p>
          <div className="wb-game-actions">
            <button
              type="button"
              className={`wb-game-fav${favorite ? ' is-fav' : ''}`}
              onClick={() => onFavorite(game.id)}
              aria-pressed={favorite}
              aria-label={favorite ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
            >
              <HeartIcon filled={favorite} />
              {favorite ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className={`wb-arcade${isFullscreen ? ' is-fullscreen' : ''}`} ref={frameRef}>
        <div className="wb-arcade-topbar">
          <span className="wb-arcade-dots" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="wb-arcade-title">{game.title}</span>
          <span className="wb-arcade-session">Session #{runId + 1}</span>
          <div className="wb-arcade-controls">
            <button type="button" className="wb-arcade-btn" onClick={restart} title="Restart game" aria-label="Restart game">
              <RestartIcon />
              <span>Restart</span>
            </button>
            <button type="button" className="wb-arcade-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Play fullscreen'} aria-label={isFullscreen ? 'Exit fullscreen' : 'Play fullscreen'}>
              <ExpandIcon />
              <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
            </button>
            <button type="button" className="wb-arcade-btn is-close" onClick={onExit} title="Back to library" aria-label="Back to library">
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="wb-arcade-viewport">
          <GameHost key={`${game.id}-${runId}`} manifest={game} onExit={onExit} />
        </div>

        <div className="wb-arcade-bottombar">
          <div className="wb-arcade-inputs">
            {inputs.length > 0 ? (
              inputs.map((label) => (
                <span className="wb-arcade-input" key={label}>{label}</span>
              ))
            ) : (
              <span className="wb-arcade-input">Click to play</span>
            )}
          </div>
          <span className="wb-arcade-tip">F11 or Fullscreen for the full arena view</span>
        </div>
      </div>

      <div className="wb-game-foot">
        <div className="wb-game-foot-block">
          <h2>How to play</h2>
          <p>
            {inputs.length > 0
              ? `Use ${inputs.join(' + ').toLowerCase()} to control the game. Press restart any time for a clean run.`
              : 'Click inside the game frame to start, then follow the on-screen prompts.'}
          </p>
        </div>
        <div className="wb-game-foot-block">
          <h2>Details</h2>
          <dl className="wb-game-details">
            <div><dt>Mode</dt><dd>{mode}</dd></div>
            <div><dt>Players</dt><dd>{players}</dd></div>
            <div><dt>Engine</dt><dd>{game.engine === 'r3f' ? '3D' : game.engine === 'phaser' ? '2D' : 'Browser'}</dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}
