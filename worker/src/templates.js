// Quiz content validation.
//
// A quiz is player-authored data that a browser will render, so every field is
// treated as hostile: control characters are stripped, lengths are capped, the
// option count is fixed, and the correct answer is stored as an INDEX into the
// options rather than as text. An index cannot drift out of sync with the text
// it refers to, which is exactly the bug that "store the correct answer string"
// invites the moment a creator edits an option.
//
// The template is the only supported value. It is not a free-form engine name:
// the Worker renders `template` against a fixed registry entry, so an unknown
// value must fail rather than fall through to something.

export const TEMPLATES = ['quiz', 'entry'];

export const QUIZ_OPTIONS = 4;
export const MIN_QUESTIONS = 2;
export const MAX_QUESTIONS = 30;
export const MAX_QUESTION_TEXT = 300;
export const MAX_OPTION_TEXT = 120;

// Strip C0 control characters and DEL. They survive a length check and then
// wreck layout: a title with a newline renders as two lines in the card.
export function stripControlChars(value) {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (code < 32 || code === 127) continue;
    out += ch;
  }
  return out;
}

class ContentError extends Error {}

function cleanLine(value, { max, field, required = true }) {
  if (typeof value !== 'string') throw new ContentError(`${field}_invalid`);
  const trimmed = stripControlChars(value).trim();
  if (!trimmed) {
    if (required) throw new ContentError(`${field}_required`);
    return '';
  }
  if (trimmed.length > max) throw new ContentError(`${field}_too_long`);
  return trimmed;
}

/**
 * Validate and normalise a quiz payload.
 *
 * Returns `{ questions: [{ prompt, options, answer }] }` where `answer` is the
 * 0-based index of the correct option and `options` is in author order — order
 * is NOT shuffled here. Shuffling at play time means two players in the same
 * head-to-head match see the same order, so it has to be decided once by the
 * server when the match starts, not independently per client.
 *
 * @throws {ContentError} with a short machine-readable reason.
 */
export function parseQuiz(raw) {
  if (!Array.isArray(raw)) throw new ContentError('questions_invalid');
  if (raw.length < MIN_QUESTIONS) {
    throw new ContentError(`questions_min_${MIN_QUESTIONS}`);
  }
  if (raw.length > MAX_QUESTIONS) {
    throw new ContentError(`questions_max_${MAX_QUESTIONS}`);
  }

  const seenPrompts = new Set();

  const questions = raw.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ContentError('question_invalid');
    }

    const prompt = cleanLine(entry.prompt, { max: MAX_QUESTION_TEXT, field: 'prompt' });
    const key = prompt.toLowerCase();
    // Duplicate questions are almost always an authoring accident, and they
    // make a quiz feel broken when the same prompt appears twice in a row.
    if (seenPrompts.has(key)) throw new ContentError('questions_duplicate');
    seenPrompts.add(key);

    const optionsIn = entry.options;
    if (!Array.isArray(optionsIn) || optionsIn.length !== QUIZ_OPTIONS) {
      throw new ContentError('options_count_invalid');
    }

    const options = optionsIn.map((option) => cleanLine(option, {
      max: MAX_OPTION_TEXT,
      field: 'option',
    }));

    // Two identical options make one of them unanswerable by appearance.
    const unique = new Set(options.map((o) => o.toLowerCase()));
    if (unique.size !== options.length) throw new ContentError('options_duplicate');

    const answer = entry.answer;
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
      throw new ContentError('answer_invalid');
    }

    return { prompt, options, answer };
  });

  return { questions };
}

/**
 * Validate the content attached to a game for a given template.
 * An 'entry' game carries no content at all.
 */
export function parseTemplateContent(template, content) {
  if (template === 'entry') {
    if (content !== undefined && content !== null) throw new ContentError('content_not_allowed');
    return null;
  }
  if (template === 'quiz') {
    const parsed = parseQuiz(content);
    return { questions: parsed.questions };
  }
  throw new ContentError('template_invalid');
}

export { ContentError };