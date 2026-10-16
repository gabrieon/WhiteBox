import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { prepareQuestion } from './shuffle.js';
import './PlayerQuiz.css';

// Answer feedback holds for just under a second before advancing. Tapping an
// option used to jump straight to the next question with no confirmation, so a
// player never learned whether they were right — the core loop of a quiz had
// no loop in it. The reveal names the verdict in text as well as colour, since
// colour alone is invisible to a sizeable minority.
const REVEAL_MS = 850;

// Player Quiz — the runtime for a quiz a player created.
//
// This is the template adapter. A created quiz has no code of its own: it is a
// database row, and this component plays whatever questions that row carries.
// That is what makes a player-created game playable at all — previously every
// player game rendered a permanent "Soon" badge because nothing could resolve
// its content into a component.
//
// Shuffling happens HERE, once per round, rather than at author time. Question
// order is the creator's — it is the order they will read it in, and shuffling
// it every session makes a quiz unplayable for anyone revising. Only the
// OPTIONS are shuffled, because a player who has learned that "B" is always the
// right answer has stopped reading.
//
// `round` exists so a replay re-shuffles without a page reload. The obvious way
// to get a fresh shuffle is `window.location.reload()`, which throws away the
// whole SPA to change five numbers — and leaves the player on a broken-looking
// page if the hash route is mid-navigation.

function formatElapsed(ms) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const tenths = Math.floor((total % 1000) / 100);
  return `${m}:${String(s).padStart(2, '0')}.${tenths}`;
}

export default function PlayerQuiz({ manifest, onExit }) {
  // The questions travel on the manifest, which App synthesises from the
  // database row. A row with no questions should never reach here — the card
  // stays unplayable — but the guard is cheap and the alternative is a blank
  // screen with no explanation.
  const questions = useMemo(
    () => (Array.isArray(manifest?.content?.questions) ? manifest.content.questions : []),
    [manifest],
  );

  const [round, setRound] = useState(0);

  // `round` is a dependency rather than a cache key on purpose: it is the signal
  // that the order should be recomputed. Reading Math.random() during render
  // without it would mean the shuffle silently changes on any unrelated
  // re-render — including the one caused by the player tapping an option.
  const prepared = useMemo(
    () => questions.map((q) => prepareQuestion(q)),
    // `round` is never read; it exists to invalidate this memo on replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, round],
  );

  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState([]);
  const [finished, setFinished] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  // The option just tapped, while its verdict is on screen. Null the rest of
  // the time. Input stays locked until the reveal clears.
  const [reveal, setReveal] = useState(null);
  const revealTimer = useRef(null);

  // A reveal that outlives the component must not advance a dead quiz. Leaving
  // the game mid-reveal and coming back would otherwise apply a stale timeout
  // to a fresh round.
  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);

  const current = prepared[index] || null;
  const locked = finished || !current || reveal !== null;
  const correctCount = picks.filter((pick, i) => pick === prepared[i]?.answer).length;
  const revealedCorrect = reveal !== null && current && reveal === current.answer;

  const choose = useCallback((optionIndex) => {
    if (locked || !current) return;

    // Captured into a local rather than read back out of state: `setStartedAt`
    // does not update `startedAt` until the next render, so reading the state
    // variable here would time the first-and-last question against 0.
    const now = Date.now();
    const start = startedAt ?? now;
    setStartedAt(start);

    const nextPicks = [...picks, optionIndex];
    setPicks(nextPicks);
    setReveal(optionIndex);

    revealTimer.current = setTimeout(() => {
      revealTimer.current = null;
      setReveal(null);
      if (index + 1 >= prepared.length) {
        setFinished(true);
        setElapsed(now - start);
      } else {
        setIndex(index + 1);
      }
    }, REVEAL_MS);
  }, [current, locked, index, picks, prepared.length, startedAt]);

  const restart = useCallback(() => {
    // A pending reveal belongs to the round being abandoned. Without this,
    // replaying mid-reveal fires the old timeout into the new round.
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    // Bumping the round re-runs the shuffle above. Resetting progress in the
    // same batch keeps the two from disagreeing for a frame.
    setRound((r) => r + 1);
    setIndex(0);
    setPicks([]);
    setFinished(false);
    setStartedAt(null);
    setElapsed(0);
    setReveal(null);
  }, []);

  if (questions.length === 0) {
    return (
      <div className="pz-root">
        <div className="pz-empty">
          <h2>This quiz has no questions</h2>
          <p>Nothing was saved with it. The creator may still be working on it.</p>
          {onExit && (
            <button type="button" className="pz-btn" onClick={onExit}>
              Back to games
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pz-root">
      <header className="pz-top">
        <div>
          <h1 className="pz-title">{manifest.title}</h1>
          <p className="pz-sub" role="status">
            Question {Math.min(index + 1, prepared.length)} of {prepared.length}
            {finished && ` · ${correctCount} correct`}
          </p>
        </div>
        {onExit && (
          <button type="button" className="pz-exit" onClick={onExit}>
            Leave
          </button>
        )}
      </header>

      {/* The progress rail is the only place the remaining count appears, so a
          30-question quiz stays navigable without a numbered list. */}
      <div
        className="pz-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={prepared.length}
        aria-valuenow={Math.min(index + (finished ? 1 : 0), prepared.length)}
        aria-label="Quiz progress"
      >
        {prepared.map((_, i) => (
          <span
            key={i}
            className={`pz-pip${i < index || (finished && i < picks.length) ? ' is-done' : ''}${i === index && !finished ? ' is-current' : ''}`}
          />
        ))}
      </div>

      {current && !finished && (
        <div className="pz-card">
          <h2 className="pz-prompt">{current.prompt}</h2>
          <div className="pz-options">
            {current.options.map((option, optionIndex) => {
              const isAnswer = reveal !== null && optionIndex === current.answer;
              const isMiss = reveal !== null && optionIndex === reveal && reveal !== current.answer;
              return (
                <button
                  key={optionIndex}
                  type="button"
                  className={`pz-option${isAnswer ? ' is-right' : ''}${isMiss ? ' is-wrong' : ''}`}
                  onClick={() => choose(optionIndex)}
                  disabled={reveal !== null}
                  aria-pressed={reveal === null ? undefined : optionIndex === reveal}
                >
                  <span className="pz-letter" aria-hidden="true">
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
          {/* Announced, not just coloured. A red border means nothing to a
              screen reader, and the reveal vanishes in under a second — without
              this, the verdict is never perceivable at all. */}
          {reveal !== null && (
            <p className="pz-verdict" role="status">
              {revealedCorrect
                ? 'Correct.'
                : `Not quite — the answer was ${current.options[current.answer]}.`}
            </p>
          )}
        </div>
      )}

      {finished && (
        <div className="pz-outcome" role="status">
          <p className="pz-outcome-title">
            {correctCount === prepared.length
              ? 'Perfect run'
              : `${correctCount} of ${prepared.length} correct`}
          </p>
          <p className="pz-outcome-detail">
            {correctCount === prepared.length ? 'Every one right.' : 'Good effort.'}
            {elapsed > 0 && ` · ${formatElapsed(elapsed)}`}
          </p>

          {/* Per-question review. A wrong answer is shown alongside the right one,
              which is the part that makes a quiz worth replaying. */}
          <ul className="pz-review">
            {prepared.map((question, i) => {
              const wasRight = picks[i] === question.answer;
              return (
                <li key={i} className={`pz-review-item${wasRight ? ' is-right' : ' is-wrong'}`}>
                  <strong>{question.prompt}</strong>
                  <span>
                    {wasRight
                      ? question.options[question.answer]
                      : `Your answer: ${question.options[picks[i]] ?? '—'} · Correct: ${question.options[question.answer]}`}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="pz-outcome-actions">
            <button type="button" className="pz-btn" onClick={restart}>
              Play again
            </button>
            {onExit && (
              <button type="button" className="pz-btn is-ghost" onClick={onExit}>
                Back to games
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}