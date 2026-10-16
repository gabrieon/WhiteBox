import { useCallback, useEffect, useRef, useState } from 'react';
import { ROUND_COUNT, createRound, isOddTap, scoreGame } from './logic.js';
import './OddSpot.css';

// Odd Spot — find the one tile that does not belong, ten rounds in a row.
//
// The third built-in game is deliberately visual rather than verbal: no
// vocabulary, no memorization, no keyboard. The challenge is perceptual —
// C/O, E/F and M/N at a glance — and every round resolves with a single tap,
// which makes it the fastest game to learn on a phone.

const BEST_KEY = 'whitebox:odd-spot-best';

/** m:ss.d — tenths are enough here; milliseconds would imply false precision. */
function formatElapsed(ms) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const tenths = Math.floor((total % 1000) / 100);
  return `${m}:${String(s).padStart(2, '0')}.${tenths}`;
}

function readBest() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BEST_KEY));
    if (parsed && Number.isInteger(parsed.misses) && Number.isInteger(parsed.elapsedMs)) {
      return { misses: Math.max(0, parsed.misses), elapsedMs: Math.max(0, parsed.elapsedMs) };
    }
  } catch {
    // A blocked or corrupt store means no best score, not a broken game.
  }
  return null;
}

function isBetterScore(candidate, best) {
  if (!best) return true;
  if (candidate.misses !== best.misses) return candidate.misses < best.misses;
  return candidate.elapsedMs < best.elapsedMs;
}

export default function OddSpot({ onExit }) {
  // The board for this round only. Advancing replaces it wholesale rather than
  // mutating tiles in place, so a tap can never land on a stale layout.
  const [board, setBoard] = useState(() => createRound({ round: 0 }));
  const [roundIndex, setRoundIndex] = useState(0);
  const [misses, setMisses] = useState(0);
  const [status, setStatus] = useState('playing'); // playing | won
  const [best, setBest] = useState(() => readBest());

  const [startedAt, setStartedAt] = useState(null);
  const [finishedAt, setFinishedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(null);

  const startClock = useCallback(() => {
    if (startedRef.current !== null) return;
    const now = Date.now();
    startedRef.current = now;
    setStartedAt(now);
  }, []);

  const stopClock = useCallback(() => {
    if (startedRef.current === null) return 0;
    const end = Date.now();
    setFinishedAt(end);
    setElapsed(end - startedRef.current);
    return end - startedRef.current;
  }, []);

  useEffect(() => {
    if (startedAt === null || finishedAt !== null) return undefined;
    const tick = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(tick);
  }, [startedAt, finishedAt]);

  const result = scoreGame({ misses, elapsedMs: elapsed, rounds: ROUND_COUNT });

  const tap = useCallback((index) => {
    if (status !== 'playing') return;
    startClock();
    if (!isOddTap(board, index)) {
      setMisses((count) => count + 1);
      return;
    }

    if (roundIndex + 1 >= ROUND_COUNT) {
      const finalElapsed = stopClock();
      const finalScore = scoreGame({ misses, elapsedMs: finalElapsed, rounds: ROUND_COUNT });
      setStatus('won');
      if (isBetterScore(finalScore, best)) {
        setBest({ misses: finalScore.misses, elapsedMs: finalScore.elapsedMs });
        try {
          window.localStorage.setItem(BEST_KEY, JSON.stringify({
            misses: finalScore.misses,
            elapsedMs: finalScore.elapsedMs,
          }));
        } catch {
          // Best scores are a nicety; storage failure must not fail the win.
        }
      }
      return;
    }

    const nextRound = roundIndex + 1;
    setRoundIndex(nextRound);
    setBoard(createRound({ round: nextRound }));
  }, [board, best, misses, roundIndex, startClock, status, stopClock]);

  function resetRound() {
    startedRef.current = null;
    setBoard(createRound({ round: 0 }));
    setRoundIndex(0);
    setMisses(0);
    setStatus('playing');
    setStartedAt(null);
    setFinishedAt(null);
    setElapsed(0);
  }

  return (
    <div className="os-root">
      <header className="os-top">
        <div>
          <h1 className="os-logo">Odd Spot</h1>
          <p className="os-sub" role="status">
            Round {Math.min(roundIndex + 1, ROUND_COUNT)} of {ROUND_COUNT} · {misses} {misses === 1 ? 'miss' : 'misses'}
          </p>
        </div>
        <div className="os-top-right">
          <span className="os-timer" aria-label="Time taken">{formatElapsed(elapsed)}</span>
          {onExit && (
            <button type="button" className="os-exit" onClick={onExit}>
              Leave
            </button>
          )}
        </div>
      </header>

      <div className="os-board" role="group" aria-label="Nine similar tiles">
        {board.tiles.map((tile, index) => (
          <button
            key={`${board.round}-${index}`}
            type="button"
            className="os-tile"
            onClick={() => tap(index)}
            disabled={status !== 'playing'}
            aria-label={`Tile ${index + 1}`}
          >
            <span aria-hidden="true">{tile}</span>
          </button>
        ))}
      </div>

      {status === 'won' ? (
        <div className="os-outcome" role="status">
          <p className="os-outcome-title">Sharp eyes</p>
          <p className="os-outcome-detail">
            {misses} {misses === 1 ? 'miss' : 'misses'} · {formatElapsed(elapsed)} · {result.accuracy}% clean
          </p>
          {best && (
            <p className="os-outcome-detail">
              Best: {best.misses} {best.misses === 1 ? 'miss' : 'misses'} · {formatElapsed(best.elapsedMs)}
            </p>
          )}
          <div className="os-outcome-actions">
            <button type="button" className="os-btn" onClick={resetRound}>
              Play again
            </button>
            {onExit && (
              <button type="button" className="os-btn is-ghost" onClick={onExit}>
                Back to games
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="os-hint">One tile is almost like the others. Tap the odd one.</p>
      )}
    </div>
  );
}
