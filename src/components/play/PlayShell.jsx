import { useCallback, useEffect, useState } from 'react';
import GameArt from '../GameArt.jsx';
import RuleIcon from './RuleIcon.jsx';

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

  // Icons are declared per game alongside its rules, positionally. A game that
  // omits them, or declares fewer than it has rules, still renders — the missing
  // entries fall back to a neutral glyph rather than leaving a hole in the list.
  const ruleIcons = Array.isArray(manifest.ruleIcons) ? manifest.ruleIcons : [];

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
          onClick={() => setStage('game')}
        >
          <header className="wb-play-rules-head">
            <h2 className="wb-play-title">How to play</h2>
            <p className="wb-play-rules-sub">
              {rules.length} {rules.length === 1 ? 'step' : 'steps'}, then you&rsquo;re in.
            </p>
          </header>

          {/* Rules are a list of discrete rows, not a paragraph. The eye needs
              somewhere to land between them; prose forces it back to the start
              every line. */}
          <ol className="wb-play-rules-list">
            {rules.map((rule, i) => (
              <li className="wb-play-rule" key={rule}>
                {/* The number says order and the glyph says meaning. Order
                    matters in instructions — "then this, then that" — and a bare
                    icon loses it, while a bare number is slow to scan. */}
                <span className="wb-play-rule-mark" aria-hidden="true">
                  <RuleIcon name={ruleIcons[i]} />
                  <span className="wb-play-rule-n">{i + 1}</span>
                </span>
                <span className="wb-play-rule-text">{rule}</span>
              </li>
            ))}
          </ol>

          <div
            className="wb-play-rules-foot"
            // The panel advances on any click, so the controls inside it have to
            // stop it or toggling "don't show again" would skip the game before
            // the choice was even recorded.
            onClick={(e) => e.stopPropagation()}
          >
            {/* "Don't show again" is the only thing on this screen that
                persists, and it used to be a 15px checkbox with 12px type. It
                is a real preference with real consequences — skip the rules
                forever — so it gets a full-width target a thumb can hit. */}
            <label className="wb-play-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => chooseRemember(e.target.checked)}
              />
              <span className="wb-play-remember-box" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                  stroke="currentColor" strokeWidth="3.2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7" />
                </svg>
              </span>
              <span className="wb-play-remember-text">
                <strong>Don&rsquo;t show this again</strong>
                <span>Skips these steps for this game on this device.</span>
              </span>
            </label>

            {/* The panel is still click-anywhere to continue — that is the
                agreed flow — but "click anywhere" is an invisible affordance,
                so the screen carries a visible primary target. Tapping the
                panel and pressing this both advance; nothing is lost. */}
            <button
              type="button"
              className="wb-play-cta"
              onClick={() => setStage('game')}
            >
              Play
            </button>
            <p className="wb-play-continue">or click anywhere</p>
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

  // The manifest is handed to the component as a prop. Built-in games import
  // their own manifest, so they ignore it — but a template runtime has no
  // manifest of its own and reads everything else (title, questions) from here,
  // because that is the only place the row being played is known.
  return <Component manifest={manifest} onExit={onExit} />;
}
