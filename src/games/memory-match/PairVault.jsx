import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PAIR_COUNT, createBoard, isBoardSolved, isMatch } from './logic.js';
import './PairVault.css';

// Pair Vault — turn over two cards at a time and clear all eight pairs.
//
// The second built-in game is deliberately the opposite shape from WORDLOCK:
// no keyboard, no vocabulary, no streak pressure. A memory board is readable in
// seconds on a phone, works entirely by tapping, and replays well because the
// shuffle — not a fixed puzzle — is the challenge.

/** m:ss.d — tenths are enough here; milliseconds would imply false precision. */
function formatElapsed(ms) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const tenths = Math.floor((total % 1000) / 100);
  return `${m}:${String(s).padStart(2, '0')}.${tenths}`;
}

export default function PairVault({ onExit }) {
  // The board is dealt once per round and never reshuffled underneath the
  // player. Reset replaces it wholesale rather than mutating positions.
  const [board, setBoard] = useState(() => createBoard());
  const [openIds, setOpenIds] = useState([]);
  const [matchedIds, setMatchedIds] = useState([]);
  const [moves, setMoves] = useState(0);
  const [status, setStatus] = useState('playing'); // playing | won

  const [startedAt, setStartedAt] = useState(null);
  const [finishedAt, setFinishedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const startedRef = useRef(null);
  const resolveRef = useRef(null);

  // A pending mismatch timer must not outlive the round or the component. If it
  // did, unmounting mid-reveal would set state on a dead component, and
  // restarting would apply the old turn to the new board.
  useEffect(() => () => {
    if (resolveRef.current) clearTimeout(resolveRef.current);
  }, []);

  const startClock = useCallback(() => {
    if (startedRef.current !== null) return;
    const now = Date.now();
    startedRef.current = now;
    setStartedAt(now);
  }, []);

  const stopClock = useCallback(() => {
    if (startedRef.current === null) return;
    const end = Date.now();
    setFinishedAt(end);
    setElapsed(end - startedRef.current);
  }, []);

  useEffect(() => {
    if (startedAt === null || finishedAt !== null) return undefined;
    const tick = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(tick);
  }, [startedAt, finishedAt]);

  const matched = useMemo(() => new Set(matchedIds), [matchedIds]);
  const busy = openIds.length === 2;
  const pairsFound = matchedIds.length / 2;
  const accuracy = moves === 0 ? 0 : Math.round((pairsFound / moves) * 100);

  const flip = useCallback((id) => {
    if (status !== 'playing' || busy || matched.has(id) || openIds.includes(id)) return;
    startClock();

    const nextOpen = [...openIds, id];
    setOpenIds(nextOpen);
    if (nextOpen.length < 2) return;

    setMoves((count) => count + 1);
    const [first, second] = nextOpen;
    const found = isMatch(first, second, board);

    // A match clears quickly; a miss lingers just long enough to memorize.
    // Either way the board locks while two cards are face-up, so a third tap
    // cannot start a second turn before this one resolves.
    resolveRef.current = setTimeout(() => {
      if (found) {
        setMatchedIds((prev) => {
          const nextMatched = [...prev, first, second];
          if (isBoardSolved(board, nextMatched)) {
            setStatus('won');
            stopClock();
          }
          return nextMatched;
        });
      }
      setOpenIds([]);
    }, found ? 380 : 700);
  }, [board, busy, matched, openIds, startClock, status, stopClock]);

  function resetRound() {
    if (resolveRef.current) clearTimeout(resolveRef.current);
    startedRef.current = null;
    setBoard(createBoard());
    setOpenIds([]);
    setMatchedIds([]);
    setMoves(0);
    setStatus('playing');
    setStartedAt(null);
    setFinishedAt(null);
    setElapsed(0);
  }

  return (
    <div className="pv-root">
      <header className="pv-top">
        <div>
          <h1 className="pv-logo">Pair Vault</h1>
          <p className="pv-sub">
            {pairsFound} of {PAIR_COUNT} pairs · {moves} {moves === 1 ? 'move' : 'moves'}
            {moves > 0 && ` · ${accuracy}% sharp`}
          </p>
        </div>
        <div className="pv-top-right">
          <span className="pv-timer" aria-label="Time taken">{formatElapsed(elapsed)}</span>
          {onExit && (
            <button type="button" className="pv-exit" onClick={onExit}>
              Leave
            </button>
          )}
        </div>
      </header>

      <div className="pv-board" role="group" aria-label="Face-down memory cards">
        {board.map((card, position) => {
          const isOpen = openIds.includes(card.id);
          const isMatched = matched.has(card.id);
          const faceUp = isOpen || isMatched;
          return (
            <button
              key={card.id}
              type="button"
              className={`pv-card${faceUp ? ' is-up' : ''}${isMatched ? ' is-matched' : ''}`}
              onClick={() => flip(card.id)}
              disabled={status !== 'playing' || busy || faceUp}
              aria-label={faceUp ? `Card ${position + 1}, ${card.symbol}` : `Hidden card ${position + 1}`}
            >
              <span aria-hidden="true">{faceUp ? card.symbol : '?'}</span>
            </button>
          );
        })}
      </div>

      {status === 'won' && (
        <div className="pv-outcome" role="status">
          <p className="pv-outcome-title">Vault cleared</p>
          <p className="pv-outcome-detail">
            {moves} moves · {formatElapsed(elapsed)} · {accuracy}% sharp
          </p>
          <div className="pv-outcome-actions">
            <button type="button" className="pv-btn" onClick={resetRound}>
              Play again
            </button>
            {onExit && (
              <button type="button" className="pv-btn is-ghost" onClick={onExit}>
                Back to games
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
