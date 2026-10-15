import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ANSWERS, GUESSES } from './words.js';
import {
  scoreGuess, keyboardState, isSolved, pickAnswer,
  CORRECT, PRESENT, MAX_GUESSES, WORD_LENGTH,
} from './scoring.js';
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

export default function WordLock({ onExit }) {
  // Answer is fixed for the lifetime of a round and never re-rolled, so a
  // re-render can't swap it out from under the player mid-guess.
  const [answer] = useState(() => pickAnswer(ANSWERS));

  const [guesses, setGuesses] = useState([]);
  const [current, setCurrent] = useState('');
  const [status, setStatus] = useState('playing'); // playing | won | lost
  const [shakeKey, setShakeKey] = useState(0);
  const [message, setMessage] = useState('');

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
    setGuesses((prev) => [...prev, { word, verdicts }]);
    setCurrentWord('');
    setMessage('');

    if (isSolved(verdicts)) setStatus('won');
    else if (guesses.length + 1 >= MAX_GUESSES) setStatus('lost');
  }, [answer, guesses.length, locked]);

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
  }, [submit, backspace, locked]);

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
      <header className="wl-top">
        <h1 className="wl-logo">WORDLOCK</h1>
        {onExit && (
          <button type="button" className="wl-exit" onClick={onExit}>
            Leave
          </button>
        )}
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
              {status === 'won' ? 'The word was ' : 'The word was '}
              <strong>{answer}</strong>
            </p>
            <div className="wl-outcome-actions">
              <button
                type="button"
                className="wl-btn"
                onClick={() => window.location.reload()}
              >
                Play again
              </button>
              {onExit && (
                <button type="button" className="wl-btn is-ghost" onClick={onExit}>
                  Back to games
                </button>
              )}
            </div>
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
