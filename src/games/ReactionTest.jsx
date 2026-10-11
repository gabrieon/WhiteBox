import { useEffect, useRef, useState } from 'react';
import './ReactionTest.css';

const BEST_SCORE_KEY = 'whitebox:reaction-test:best';
const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 3000;
const HISTORY_LENGTH = 5;

const PHASES = {
  idle: {
    kicker: 'REACTION TEST',
    headline: 'Tap when the panel turns green.',
    detail: 'Click or press Enter to start the round.',
  },
  waiting: {
    kicker: 'WAIT FOR IT',
    headline: 'Wait for green…',
    detail: 'Clicking now counts as a false start.',
  },
  ready: {
    kicker: 'GO',
    headline: 'Click!',
    detail: '',
  },
  tooSoon: {
    kicker: 'FALSE START',
    headline: 'Too soon!',
    detail: 'Wait for the panel to turn green before clicking.',
  },
};

function readBestScore() {
  try {
    const value = Number(window.localStorage.getItem(BEST_SCORE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeBestScore(value) {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(value));
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the score
    // simply will not survive a reload.
  }
}

function verdictFor(ms) {
  if (ms < 200) return 'Lightning';
  if (ms < 250) return 'Sharp';
  if (ms < 300) return 'Solid';
  if (ms < 400) return 'Steady';
  return 'Keep practising';
}

export default function ReactionTest() {
  const [phase, setPhase] = useState('idle');
  const [lastScore, setLastScore] = useState(null);
  const [bestScore, setBestScore] = useState(readBestScore);
  const [history, setHistory] = useState([]);

  const timerRef = useRef(null);
  const greenAtRef = useRef(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => clearTimer, []);

  function startRound() {
    clearTimer();
    greenAtRef.current = null;
    setPhase('waiting');
    timerRef.current = window.setTimeout(() => {
      greenAtRef.current = performance.now();
      setPhase('ready');
    }, MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
  }

  // A null timestamp means the round was already scored, so mashing the panel
  // when it turns green cannot record a second time for the same round.
  function finishRound() {
    if (greenAtRef.current === null) return;
    const score = Math.round(performance.now() - greenAtRef.current);
    greenAtRef.current = null;

    setLastScore(score);
    setHistory((current) => [score, ...current].slice(0, HISTORY_LENGTH));
    setPhase('result');

    if (bestScore === null || score < bestScore) {
      setBestScore(score);
      writeBestScore(score);
    }
  }

  function advance() {
    if (phase === 'waiting') {
      clearTimer();
      greenAtRef.current = null;
      setPhase('tooSoon');
      return;
    }
    if (phase === 'ready') {
      finishRound();
      return;
    }
    if (greenAtRef.current === null) startRound();
  }

  // Reaction must be timed from the press, not the release: `click` only fires on
  // mouse-up, which would add the whole button-hold duration to the score.
  function handlePanelPointerDown(event) {
    if (event.button !== 0) return;
    advance();
  }

  // Keyboard activation (Enter / Space) produces a click with detail 0 and no
  // pointerdown, so it is handled here; pointer clicks are ignored as duplicates.
  function handlePanelClick(event) {
    if (event.detail !== 0) return;
    advance();
  }

  function handleReset() {
    clearTimer();
    greenAtRef.current = null;
    setLastScore(null);
    setHistory([]);
    setBestScore(null);
    setPhase('idle');
    try {
      window.localStorage.removeItem(BEST_SCORE_KEY);
    } catch {
      // See writeBestScore.
    }
  }

  const copy = phase === 'result'
    ? { kicker: 'RESULT', headline: `${lastScore} ms`, detail: verdictFor(lastScore) }
    : PHASES[phase];
  const average = history.length
    ? Math.round(history.reduce((total, score) => total + score, 0) / history.length)
    : null;
  const isLive = phase === 'waiting' || phase === 'ready';
  const hasStats = history.length > 0;

  return (
    <div className="reaction-game">
      <button
        type="button"
        className={`reaction-panel is-${phase}`}
        onPointerDown={handlePanelPointerDown}
        onClick={handlePanelClick}
        aria-label="Reaction test panel"
      >
        <span className="reaction-panel-inner">
          <span className="reaction-kicker">{copy.kicker}</span>
          <span className="reaction-headline" aria-live="polite">{copy.headline}</span>
          <span className="reaction-detail">{copy.detail}</span>
          {phase === 'result' && (
            <span className="reaction-again">Click to go again</span>
          )}
        </span>
      </button>

      <div className="reaction-stats">
        <div className="reaction-stat">
          <span className="reaction-stat-label">Best</span>
          <span className="reaction-stat-value">
            {bestScore === null ? '—' : `${bestScore} ms`}
          </span>
        </div>
        <div className="reaction-stat">
          <span className="reaction-stat-label">Last</span>
          <span className="reaction-stat-value">
            {lastScore === null ? '—' : `${lastScore} ms`}
          </span>
        </div>
        <div className="reaction-stat">
          <span className="reaction-stat-label">Average</span>
          <span className="reaction-stat-value">
            {average === null ? '—' : `${average} ms`}
          </span>
        </div>
        {hasStats && (
          <button type="button" className="reaction-reset" onClick={handleReset}>
            Reset scores
          </button>
        )}
      </div>

      {hasStats && (
        <div className="reaction-history">
          <span className="reaction-history-label">Recent</span>
          <span className="reaction-history-list">
            {history.map((score, index) => (
              <span className="reaction-history-chip" key={`${score}-${index}`}>
                {score} ms
              </span>
            ))}
          </span>
        </div>
      )}

      <p className="reaction-hint">
        {isLive
          ? 'Do not click until the panel turns green.'
          : 'Rounds use a random delay between one and three seconds.'}
      </p>
    </div>
  );
}
