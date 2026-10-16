// Client-side quiz authoring constants and helpers.
//
// These mirror worker/src/templates.js so the Create screen can show a problem
// while a creator types, rather than after a round-trip that fails. The server
// re-validates everything — this is convenience, not a trust boundary.

export const MAX_OPTIONS = 4;
export const MIN_QUESTIONS = 2;
export const MAX_QUESTIONS = 30;
export const MAX_QUESTION_TEXT = 300;
export const MAX_OPTION_TEXT = 120;

/**
 * A blank question, shaped the way the server expects to read it back.
 *
 * The answer defaults to index 0 so a half-finished question is still
 * structurally valid — the creator has not chosen yet, but nothing about the
 * shape is wrong, and they are never forced to interact with a radio group
 * before they have typed anything.
 */
export function newQuestion() {
  return {
    prompt: '',
    options: Array.from({ length: MAX_OPTIONS }, () => ''),
    answer: 0,
  };
}

/** Per-question problems, for a submit-time summary. Mirrors the server rules. */
export function quizProblems(questions) {
  const problems = [];
  if (!Array.isArray(questions) || questions.length < MIN_QUESTIONS) {
    problems.push(`Add at least ${MIN_QUESTIONS} questions.`);
    return problems;
  }
  if (questions.length > MAX_QUESTIONS) {
    problems.push(`A quiz can hold at most ${MAX_QUESTIONS} questions.`);
  }

  const seen = new Set();
  questions.forEach((question, index) => {
    const at = `Question ${index + 1}`;
    const prompt = (question.prompt || '').trim();
    if (!prompt) {
      problems.push(`${at} needs a prompt.`);
    } else if (prompt.length > MAX_QUESTION_TEXT) {
      problems.push(`${at} is too long.`);
    } else if (seen.has(prompt.toLowerCase())) {
      problems.push(`${at} repeats an earlier question.`);
    } else {
      seen.add(prompt.toLowerCase());
    }

    const options = (question.options || []).map((o) => (o || '').trim());
    if (options.length !== MAX_OPTIONS) {
      problems.push(`${at} needs exactly ${MAX_OPTIONS} options.`);
    }
    if (options.some((o) => !o)) {
      problems.push(`${at} has an empty option.`);
    } else if (options.some((o) => o.length > MAX_OPTION_TEXT)) {
      problems.push(`${at} has an option that is too long.`);
    } else if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
      problems.push(`${at} has two identical options.`);
    }

    if (!Number.isInteger(question.answer)
      || question.answer < 0
      || question.answer >= options.length) {
      problems.push(`${at} has no correct answer marked.`);
    }
  });

  return problems;
}

/** Strip empties before sending; the payload is smaller and easier to log. */
export function toPayload(questions) {
  return {
    questions: questions.map((question) => ({
      prompt: question.prompt.trim(),
      options: question.options.map((o) => o.trim()),
      answer: question.answer,
    })),
  };
}