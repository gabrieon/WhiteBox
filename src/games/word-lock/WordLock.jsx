import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ANSWERS, GUESSES } from './words.js';
import { DEFINITIONS } from './definitions.js';
import {
  scoreGuess, keyboardState, isSolved, pickAnswer,
  CORRECT, PRESENT, MAX_GUESSES, WORD_LENGTH,
} from './scoring.js';
import {
  readStats, recordResult, shareText,
} from './share.js';
import './WordLock.css';

// WORDLOCK — guess the five-letter word in six tries.
//
// The mechanic is ordinary; the details are what make it feel right. Guesses
// animate in column by column rather than all at once, a rejected word shakes
// instead of silently doing nothing, and the keyboard keeps every colour it has
// earned: a letter that went green never drops back to grey.
//
// Colour is not the only signal. Each tile also carries a different border
// treatment (solid / dashed / faint), because green-versus-amber is precisely
// the pair most colourblind players cannot tell apart, and this genre has always
// leaned on that one distinction.

const KEY_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const ACTIONS = { ENTER: 'ENTER', BACKSPACE: 'BACKSPACE' };

// How long the clue stays fully visible before it fades. Long enough to read a
// short definition once, short enough that it is not just the answer on screen.
const CLUE_HOLD_MS = 5000;
const CLUE_FADE_MS = 700;

/** mm:ss.mmm — the milliseconds are there because "close" is the whole game. */
function formatElapsed(ms) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const ms2 = total % 1000;
  return `${m}:${String(s).padStart(2, '0')}.${String(ms2).padStart(3, '0')}`;
}

export default function WordLock({ onExit }) {
  // Answer is fixed for the lifetime of a round and never re-rolled, so a
  // re-render can't swap it out from under the player mid-guess. Restarting
  // replaces the whole round through resetRound rather than reloading the page.
  const [answer, setAnswer] = useState(() => pickAnswer(ANSWERS));

  const [guesses, setGuesses] = useState([]);
  const [current, setCurrent] = useState('');
  const [status, setStatus] = useState('playing'); // playing | won | lost
  const [shakeKey, setShakeKey] = useState(0);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState(() => readStats());
  const [shareState, setShareState] = useState('idle'); // idle | shared | copied | failed

  // --- clue ---------------------------------------------------------------
  // The definition flashes at the top for five seconds, then fades. The answer
  // is already chosen and known here, so there is nothing to fetch at runtime.
  const clue = DEFINITIONS[answer] || null;
  const [clueState, setClueState] = useState('show'); // show | fade | gone

  useEffect(() => {
    if (!clue) return undefined;
    const hide = setTimeout(() => setClueState('fade'), CLUE_HOLD_MS);
    const drop = setTimeout(() => setClueState('gone'), CLUE_HOLD_MS + CLUE_FADE_MS);
    return () => { clearTimeout(hide); clearTimeout(drop); };
  }, [clue]);

  // --- timer --------------------------------------------------------------
  // Counts UP, not down, and starts on the player's first interaction rather than
  // on load — a clock ticking before you have read the board only adds pressure
  // to think, which is the opposite of what this game is for. It is a record of
  // how long you took, not a limit.
  const [startedAt, setStartedAt] = useState(null);
  const [finishedAt, setFinishedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  // The start time lives in a ref as well as in state. State drives the interval
  // effect, but the ref is what lets `stopClock` read it synchronously from the
  // keystroke handler without that handler having to depend on it — and an effect
  // cannot be used to freeze the clock, because setting state in an effect body
  // is what cascades renders.
  const startedRef = useRef(null);

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
    const tick = setInterval(() => setElapsed(Date.now() - startedAt), 37); // ~27fps
    return () => clearInterval(tick);
  }, [startedAt, finishedAt]);

  // Mirror of `current` for the submit path.
  //
  // submit() needs the typed word at the moment Enter is pressed, but reading it
  // from the closure is wrong: several keystrokes can land in one task, React
  // batches them, and submit would still be closed over the word as it was
  // before the batch. That produced "Needs 5 letters" on a full, correct row.
  // A ref written alongside the state is always current.
  const currentRef = useRef('');

  function setCurrentWord(next) {
    currentRef.current = next;
    setCurrent(next);
  }

  // A finished round updates the local streak exactly once, at the moment it
  // ends. Recording from the render path would double-count on StrictMode or
  // re-renders; recording here ties one outcome to one stats write.
  const finishRound = useCallback((won, finalGuesses) => {
    const finalElapsed = startedRef.current === null
      ? 0
      : Date.now() - startedRef.current;
    setStatus(won ? 'won' : 'lost');
    stopClock();
    setStats(recordResult({
      won,
      guesses: finalGuesses.length,
      elapsedMs: finalElapsed,
    }));
  }, [stopClock]);

  const locked = status !== 'playing';
  const keys = useMemo(() => keyboardState(guesses), [guesses]);

  const submit = useCallback(() => {
    if (locked) return;
    const word = currentRef.current;

    if (word.length < WORD_LENGTH) {
      setMessage(`Needs ${WORD_LENGTH} letters.`);
      setShakeKey((k) => k + 1);
      return;
    }

    if (!GUESSES.has(word)) {
      // Most common case by far: a real word that simply isn't in the guess
      // list. Saying so is far better than silently refusing.
      setMessage('Not in the word list.');
      setShakeKey((k) => k + 1);
      return;
    }

    const verdicts = scoreGuess(word, answer);
    const nextGuesses = [...guesses, { word, verdicts }];
    setGuesses(nextGuesses);
    setCurrentWord('');
    setMessage('');

    if (isSolved(verdicts)) {
      finishRound(true, nextGuesses);
    } else if (nextGuesses.length >= MAX_GUESSES) {
      finishRound(false, nextGuesses);
    }
  }, [answer, guesses, locked, finishRound]);

  const backspace = useCallback(() => {
    if (locked) return;
    setCurrentWord(currentRef.current.slice(0, -1));
    setMessage('');
  }, [locked]);

  const press = useCallback((key) => {
    if (locked) return;
    if (key === ACTIONS.ENTER) {
      submit();
      return;
    }
    if (key === ACTIONS.BACKSPACE) {
      backspace();
      return;
    }
    // Slicing rather than guarding: a sixth keystroke should be ignored, not
    // wrapped or dropped mid-word.
    setCurrentWord(`${currentRef.current}${key}`.slice(0, WORD_LENGTH));
    setMessage('');
    // First keystroke starts the clock. Functional form so `press` keeps its
    // dependency list stable and doesn't have to be rebuilt when it does.
    startClock();
  }, [submit, backspace, locked, startClock]);

  // A new round stays inside the SPA. Reloading the page would throw away the
  // loaded bundle and scroll position, which is exactly what the same-origin
  // play flow was built to avoid.
  function resetRound() {
    setAnswer(pickAnswer(ANSWERS));
    setGuesses([]);
    setCurrentWord('');
    setStatus('playing');
    setShakeKey(0);
    setMessage('');
    setClueState('show');
    setShareState('idle');
    startedRef.current = null;
    setStartedAt(null);
    setFinishedAt(null);
    setElapsed(0);
  }

  // Viral loop, without leaking the answer. The grid carries the score shape
  // but no letters, so a shared screenshot cannot spoil anyone. Native share
  // when the browser offers it, clipboard otherwise.
  async function shareResult() {
    const url = `${window.location.origin}/#/play/word-lock`;
    const text = shareText({
      won: status === 'won',
      guesses,
      elapsedLabel: formatElapsed(elapsed),
      streak: stats.currentStreak,
      url,
    });

    try {
      if (navigator.share) {
        await navigator.share({ title: 'WORDLOCK', text, url });
        setShareState('shared');
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setShareState('copied');
        return;
      }

      const fallback = document.createElement('textarea');
      fallback.value = text;
      fallback.setAttribute('readonly', '');
      fallback.style.position = 'fixed';
      fallback.style.opacity = '0';
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand('copy');
      document.body.removeChild(fallback);
      setShareState('copied');
    } catch (err) {
      // Cancelling the native sheet is not a failure — only report real errors.
      setShareState(err?.name === 'AbortError' ? 'idle' : 'failed');
    }
  }

  // Physical keyboard. Bound on the document rather than the grid so the game
  // works without the player ever clicking it first.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        press(ACTIONS.ENTER);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        press(ACTIONS.BACKSPACE);
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        press(e.key.toLowerCase());
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [press]);

  const activeRow = guesses.length;
  const filled = guesses.concat(
    current ? [{ word: current, verdicts: null, typing: true }] : [],
  );

  return (
    <div className="wl-root">
      {/* Clue: flashes the definition for five seconds, then fades out. aria-live
          so a screen reader announces it while it is still visible. */}
      {clue && clueState !== 'gone' && (
        <div
          className={`wl-clue${clueState === 'fade' ? ' is-fading' : ''}`}
          role="status"
        >
          <span className="wl-clue-tag">Clue</span>
          <span className="wl-clue-text">{clue}</span>
        </div>
      )}

      <header className="wl-top">
        <h1 className="wl-logo">WORDLOCK</h1>
        <div className="wl-top-right">
          <span className="wl-timer" aria-label="Time taken">
            {formatElapsed(elapsed)}
          </span>
          {onExit && (
            <button type="button" className="wl-exit" onClick={onExit}>
              Leave
            </button>
          )}
        </div>
      </header>

      <div className="wl-board-wrap">
        <div className="wl-board" role="grid" aria-label="Guess board">
          {Array.from({ length: MAX_GUESSES }, (_, rowIndex) => {
            const row = filled[rowIndex];
            const isActive = !locked && rowIndex === activeRow;
            const word = row?.word || '';
            const verdicts = row?.verdicts || null;

            return (
              <div
                // Re-keying on shakeKey remounts the active row, which is what
                // actually re-triggers the animation. A bare `shakeKey > 0`
                // class would latch on permanently after the first rejection and
                // then sit there doing nothing.
                key={rowIndex === activeRow ? `${rowIndex}-${shakeKey}` : rowIndex}
                className={`wl-row${isActive ? ' is-active' : ''}`}
                role="row"
              >
                {Array.from({ length: WORD_LENGTH }, (_, colIndex) => {
                  const letter = word[colIndex] || '';
                  const verdict = verdicts ? verdicts[colIndex] : null;
                  // `key` on the letter forces a remount per row so the flip
                  // animation replays instead of only running on first paint.
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}-${verdict || 'blank'}`}
                      className={[
                        'wl-tile',
                        verdict ? `is-${verdict}` : '',
                        letter ? 'has-letter' : '',
                        rowIndex === activeRow && shakeKey > 0 ? 'is-shaking' : '',                      ].filter(Boolean).join(' ')}
                      style={{ animationDelay: verdicts ? `${colIndex * 110}ms` : undefined }}
                      role="gridcell"
                      aria-label={letter ? letter : 'empty'}
                    >
                      <span className="wl-tile-letter">{letter}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {message && <p className="wl-message" role="status">{message}</p>}

        {locked && (
          <div className="wl-outcome">
            <p className="wl-outcome-title">
              {status === 'won'
                ? `Solved in ${guesses.length} ${guesses.length === 1 ? 'try' : 'tries'}`
                : 'Out of tries'}
            </p>
            <p className="wl-outcome-answer">
              The word was <strong>{answer}</strong>
            </p>
            {clue && (
              <p className="wl-outcome-clue">
                <em>{clue}</em>
                <span className="wl-credit">Definition from Wiktionary (CC BY-SA)</span>
              </p>
            )}
            <p className="wl-outcome-answer">
              Time taken <strong>{formatElapsed(elapsed)}</strong>
            </p>
            <p className="wl-outcome-answer">
              Streak <strong>{stats.currentStreak}</strong>
              {stats.bestStreak > 0 && ` · best ${stats.bestStreak}`}
              {stats.bestGuesses !== null && ` · best ${stats.bestGuesses} ${stats.bestGuesses === 1 ? 'try' : 'tries'}`}
            </p>
            <div className="wl-outcome-actions">
              <button
                type="button"
                className="wl-btn"
                onClick={resetRound}
              >
                Play again
              </button>
              <button
                type="button"
                className="wl-btn is-ghost"
                onClick={shareResult}
              >
                {shareState === 'shared'
                  ? 'Shared'
                  : shareState === 'copied'
                    ? 'Copied'
                    : 'Share result'}
              </button>
              {onExit && (
                <button type="button" className="wl-btn is-ghost" onClick={onExit}>
                  Back to games
                </button>
              )}
            </div>
            {shareState === 'failed' && (
              <p className="wl-share-error" role="status">
                Sharing is not available in this browser. Screenshot the board instead.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="wl-keys">
        {KEY_ROWS.map((row, rowIndex) => (
          <div className="wl-key-row" key={rowIndex}>
            {rowIndex === 2 && (
              <button
                type="button"
                className="wl-key is-wide"
                onClick={() => press(ACTIONS.ENTER)}
                disabled={locked}
              >
                Enter
              </button>
            )}
            {row.map((letter) => (
              <button
                key={letter}
                type="button"
                className={`wl-key${keys[letter] ? ` is-${keys[letter]}` : ''}`}
                onClick={() => press(letter)}
                disabled={locked}
              >
                {letter.toUpperCase()}
              </button>
            ))}
            {rowIndex === 2 && (
              <button
                type="button"
                className="wl-key is-wide"
                onClick={() => press(ACTIONS.BACKSPACE)}
                disabled={locked}
                aria-label="Delete"
              >
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="wl-legend" aria-hidden="true">
        <span className="wl-legend-item"><i className={`wl-swatch is-${CORRECT}`} />right spot</span>
        <span className="wl-legend-item"><i className={`wl-swatch is-${PRESENT}`} />wrong spot</span>
        <span className="wl-legend-item"><i className="wl-swatch is-absent" />not in it</span>
      </p>
    </div>
  );
}
