import { useCallback, useEffect, useState } from 'react';
import GameArt from '../GameArt.jsx';

// The play shell.
//
// Three stages the player walks through, in order:
//   1. splash — the game name and a Play control
//   2. rules  — how it works, dismissable, skippable once
//   3. game   — the actual component
//
// It is a fullscreen overlay inside the SPA rather than a separate origin. A
// subdomain would mean a full document load every time the player moved between
// the library and a game, which is exactly the friction to avoid: browser-back
// and the header both have to keep working without a reload.
//
// "Don't show again" is per browser, not per account. That is a deliberate
// trade — following the player across devices needs a server round-trip and a
// table to store the flag, which is not worth it for a preference about how many
// times someone wants to read the instructions.

const RULES_DISMISSED_KEY = 'whitebox:rules-dismissed';

function readDismissed(gameId) {
  try {
    const raw = JSON.parse(window.localStorage.getItem(RULES_DISMISSED_KEY) || '{}');
    return Boolean(raw && raw[gameId]);
  } catch {
    return false;
  }
}

function markDismissed(gameId, value) {
  try {
    const raw = JSON.parse(window.localStorage.getItem(RULES_DISMISSED_KEY) || '{}');
    const next = raw && typeof raw === 'object' ? raw : {};
    if (value) next[gameId] = true;
    else delete next[gameId];
    window.localStorage.setItem(RULES_DISMISSED_KEY, JSON.stringify(next));
  } catch {
    // Private browsing or a full quota: the choice just won't persist, which
    // is not worth surfacing an error over.
  }
}

export default function PlayShell({ manifest, onExit }) {
  const [stage, setStage] = useState('splash');
  const [remember, setRemember] = useState(() => readDismissed(manifest.id));

  const rules = Array.isArray(manifest.rules) ? manifest.rules : [];

  // Someone who already dismissed the rules should not be shown them again, even
  // if they reload into this screen.
  const rulesAlreadyDone = remember;

  const begin = useCallback(() => {
    setStage(rules.length > 0 && !rulesAlreadyDone ? 'rules' : 'game');
  }, [rules.length, rulesAlreadyDone]);

  function chooseRemember(value) {
    setRemember(value);
    markDismissed(manifest.id, value);
  }

  // Escape leaves the game from anywhere, which is the one shortcut a
  // fullscreen view has to honour.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onExit?.();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExit]);

  return (
    <div className="wb-play">
      {/* --- stage 1: splash --- */}
      {stage === 'splash' && (
        <div className="wb-play-splash">
          <div className="wb-play-splash-art">
            <GameArt type={manifest.type} />
          </div>
          <h1 className="wb-play-title">{manifest.title}</h1>
          <p className="wb-play-tagline">{manifest.description}</p>
          <button type="button" className="wb-play-cta" onClick={begin}>
            Play
          </button>
          <button type="button" className="wb-play-quiet" onClick={onExit}>
            Back to games
          </button>
        </div>
      )}

      {/* --- stage 2: rules --- */}
      {stage === 'rules' && (
        <div
          className="wb-play-rules"
          role="button"
          tabIndex={0}
          onClick={() => setStage('game')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setStage('game');
            }
          }}
        >
          <h2 className="wb-play-title">How to play</h2>
          <ul className="wb-play-rules-list">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>

          <div
            className="wb-play-rules-foot"
            // The whole panel advances on click, so the checkbox has to stop
            // propagation or toggling it would skip straight into the game.
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <label className="wb-play-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => chooseRemember(e.target.checked)}
              />
              <span>Don&rsquo;t show again</span>
            </label>
            <p className="wb-play-continue">Click anywhere to continue</p>
          </div>
        </div>
      )}

      {/* --- stage 3: the game --- */}
      {stage === 'game' && (
        <div className="wb-play-stage">
          <GameRenderer manifest={manifest} onExit={onExit} />
        </div>
      )}
    </div>
  );
}

// Split out so the heavy game component only mounts once the player is actually
// looking at it — not while they are still reading the rules.
function GameRenderer({ manifest, onExit }) {
  const [Component, setComponent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const mod = manifest.loader
          ? await manifest.loader()
          : { default: manifest.component };
        if (!alive) return;
        const Loaded = mod.default || mod;
        if (typeof Loaded !== 'function') throw new Error('missing_entry_point');
        setComponent(() => Loaded);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || 'game_failed_to_load');
      }
    }

    load();
    return () => { alive = false; };
  }, [manifest]);

  if (error) {
    return (
      <div className="wb-play-error">
        <h2>Could not start the game</h2>
        <p>
          The game failed to load ({error}). That is usually a temporary network
          problem — try going back and opening it again.
        </p>
        <button type="button" className="wb-play-quiet" onClick={onExit}>
          Back to games
        </button>
      </div>
    );
  }

  if (!Component) {
    return <div className="wb-play-loading">Loading…</div>;
  }

  return <Component onExit={onExit} />;
}
