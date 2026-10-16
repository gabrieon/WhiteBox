import { useCallback } from 'react';
import {
  MAX_OPTIONS, MAX_OPTION_TEXT, MAX_QUESTIONS, MAX_QUESTION_TEXT,
  MIN_QUESTIONS, newQuestion,
} from '../sdk/games/quiz.js';

// Quiz question editor.
//
// Mirrors the server's rules (worker/src/templates.js) so a creator sees a
// problem while typing instead of on submit. The server re-checks everything —
// this is convenience, not security.
//
// The answer is stored as an INDEX into the options rather than as text, on
// purpose: an index cannot drift out of sync with the option it refers to, which
// is the bug that appears the moment someone edits an option.

function blankQuestion() {
  return newQuestion();
}

export default function QuizBuilder({ questions, onChange }) {
  const update = useCallback((index, patch) => {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }, [questions, onChange]);

  const setOption = useCallback((index, optionIndex, value) => {
    onChange(questions.map((q, i) => (
      i === index
        ? { ...q, options: q.options.map((o, oi) => (oi === optionIndex ? value : o)) }
        : q
    )));
  }, [questions, onChange]);

  const remove = useCallback((index) => {
    onChange(questions.filter((_, i) => i !== index));
  }, [questions, onChange]);

  const move = useCallback((index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  }, [questions, onChange]);

  const add = useCallback(() => {
    if (questions.length >= MAX_QUESTIONS) return;
    onChange([...questions, blankQuestion()]);
  }, [questions, onChange]);

  const tooFew = questions.length < MIN_QUESTIONS;

  return (
    <div className="wb-quiz">
      <div className="wb-quiz-head">
        <span className="wb-field-label">
          Questions ({questions.length}/{MAX_QUESTIONS})
        </span>
        <button
          type="button"
          className="wb-mine-action"
          onClick={add}
          disabled={questions.length >= MAX_QUESTIONS}
        >
          Add question
        </button>
      </div>

      {tooFew && questions.length === 0 && (
        <p className="wb-row-empty">
          Add at least {MIN_QUESTIONS} questions. Each has a prompt, four
          options, and one correct answer.
        </p>
      )}

      <ul className="wb-quiz-list">
        {questions.map((question, index) => {
          const promptBad = !question.prompt.trim();
          const optionsBad = question.options.some((o) => !o.trim());
          const dupeOptions = new Set(
            question.options.map((o) => o.trim().toLowerCase()).filter(Boolean),
          ).size !== MAX_OPTIONS;

          return (
            <li key={index} className="wb-quiz-item">
              <div className="wb-quiz-item-head">
                <strong>Question {index + 1}</strong>
                <div className="wb-quiz-move">
                  <button
                    type="button"
                    className="wb-quiz-icon"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move question ${index + 1} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="wb-quiz-icon"
                    onClick={() => move(index, 1)}
                    disabled={index === questions.length - 1}
                    aria-label={`Move question ${index + 1} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="wb-quiz-icon"
                    onClick={() => remove(index)}
                    aria-label={`Remove question ${index + 1}`}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={question.prompt}
                maxLength={MAX_QUESTION_TEXT + 20}
                onChange={(e) => update(index, { prompt: e.target.value })}
                placeholder="What is the capital of France?"
                aria-label={`Question ${index + 1} prompt`}
              />

              <div className="wb-quiz-options">
                {question.options.map((option, optionIndex) => (
                  <label
                    key={optionIndex}
                    className={`wb-quiz-option${question.answer === optionIndex ? ' is-correct' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`answer-${index}`}
                      checked={question.answer === optionIndex}
                      onChange={() => update(index, { answer: optionIndex })}
                    />
                    <input
                      type="text"
                      value={option}
                      maxLength={MAX_OPTION_TEXT + 20}
                      onChange={(e) => setOption(index, optionIndex, e.target.value)}
                      placeholder={`Option ${optionIndex + 1}`}
                      aria-label={`Question ${index + 1} option ${optionIndex + 1}`}
                    />
                  </label>
                ))}
              </div>

              {(promptBad || optionsBad || dupeOptions) && (
                <p className="wb-quiz-warning" role="alert">
                  {promptBad && 'This question needs a prompt. '}
                  {optionsBad && 'All four options need text. '}
                  {dupeOptions && 'These options must all be different. '}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}