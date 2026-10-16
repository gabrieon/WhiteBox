// AI-generated game artwork.
//
// The Worker generates an image and hands the bytes back to the browser. It
// never stores them and never holds a Supabase service-role key: the browser
// runs the result through the same canvas pipeline a hand-picked photo takes
// (see src/sdk/games/imagePrep.js) and uploads it with the player's own token.
// That keeps storage RLS as the only write path and keeps this file free of any
// credential that could upload on someone's behalf.
//
// Gemini's rate limits are per PROJECT, not per key, so every player who
// generates artwork draws from one shared pool. Two limits apply here:
//
//   - a per-minute burst, reusing the KV rate limiter, which handles a script
//     hammering the endpoint and degrades open if KV is unavailable;
//   - a per-day allowance counted in D1, which protects the actual quota and
//     fails CLOSED. An unreachable counter means "we do not know how much is
//     left", and the safe reading of that is to refuse rather than guess.

// Default daily allowance per account. Deliberately small: this is an abuse
// ceiling on a shared free-tier quota, not an allowance, and the real number
// depends on a plan whose limits Google only shows inside AI Studio. Override
// with the ARTWORK_DAILY_LIMIT var.
export const DEFAULT_DAILY_LIMIT = 10;

export const MAX_PROMPT_LENGTH = 600;

// The per-minute burst lives in moderation.js WRITE_POLICIES alongside every
// other rate in the Worker, so there is one place to look and no chance of the
// two drifting apart. This module owns only the daily allowance, which is
// counted in D1 rather than KV and therefore cannot be expressed as a policy.

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

// Gemini images carry a SynthID watermark. Not removable, and worth saying out
// loud rather than letting a reviewer discover it.
export const SYNTHID_NOTE = 'Gemini stamps every generated image with a SynthID watermark.';

/**
 * Start of the current Pacific day, in epoch milliseconds.
 *
 * Gemini's requests-per-day quota resets at midnight Pacific, so this window has
 * to reset there too. Otherwise the two counters disagree for up to a day and
 * one of them refuses work the other considers available.
 *
 * Fixed at UTC-8 rather than resolving the zone, so this is up to an hour out
 * during Pacific daylight saving. That is deliberate and harmless: the window
 * exists to stop a sustained drain, and being an hour early or late never lets a
 * caller double their allowance across a real boundary.
 */
export function pacificDayStart(now = Date.now()) {
  const PACIFIC_UTC_OFFSET_MS = -8 * 60 * 60 * 1000;
  return Math.floor((now + PACIFIC_UTC_OFFSET_MS) / 86_400_000) * 86_400_000
    - PACIFIC_UTC_OFFSET_MS;
}

export function dailyLimit(env) {
  const raw = Number(env.ARTWORK_DAILY_LIMIT);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_DAILY_LIMIT;
}

/**
 * How many images this account may still generate today.
 *
 * Fails CLOSED. With no counter store there is no way to know what has been
 * spent, and the cost of guessing wrong is the site's shared quota being
 * exhausted by one account.
 */
export async function quotaStatus(env, userId, now = Date.now()) {
  const limit = dailyLimit(env);
  if (!env.GAMES) {
    return { allowed: false, limit, used: limit, remaining: 0, enforced: true };
  }

  let used = 0;
  try {
    const row = await env.GAMES.prepare(
      'SELECT COUNT(*) AS n FROM artwork_generations WHERE user_id = ? AND created_at >= ?',
    ).bind(userId, pacificDayStart(now)).first();
    used = Number(row?.n) || 0;
  } catch (err) {
    console.error('[whitebox-mp] artwork quota read failed', err?.message);
    return { allowed: false, limit, used, remaining: 0, enforced: true };
  }

  return {
    allowed: used < limit,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    enforced: true,
  };
}

/**
 * Reserve one slot against the allowance.
 *
 * The read and the insert are not in a transaction, so two concurrent requests
 * could both read `used = limit - 1` and both proceed. That costs at most one
 * extra image per simultaneous burst, which the per-minute limiter already caps
 * at eight; a transaction is not worth the added failure mode here.
 *
 * Returns false when the allowance is already spent. A generation that then
 * fails still consumes its slot: the upstream call was made and may well have
 * been billed, so counting it is the honest accounting, and not counting it
 * would let a caller farm free retries against a metered resource.
 */
export async function reserveGeneration(env, userId, gameId, now = Date.now()) {
  if (!env.GAMES) return false;
  const id = crypto.randomUUID();
  try {
    await env.GAMES.prepare(
      'INSERT INTO artwork_generations (id, user_id, game_id, created_at) VALUES (?, ?, ?, ?)',
    ).bind(id, userId, gameId, now).run();
    return true;
  } catch (err) {
    console.error('[whitebox-mp] artwork quota reserve failed', err?.message);
    return false;
  }
}

/** Validate a player-supplied prompt. Bounded, and free of control characters. */
export function parsePrompt(raw) {
  if (typeof raw !== 'string') throw new Error('prompt_invalid');
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('prompt_required');
  if (trimmed.length > MAX_PROMPT_LENGTH) throw new Error('prompt_too_long');

  let out = '';
  for (const ch of trimmed) {
    const code = ch.codePointAt(0);
    // Control characters survive a length check and then wreck whatever renders
    // the prompt, including log lines.
    if (code < 32 || code === 127) continue;
    out += ch;
  }
  return out;
}

function modelId(env) {
  return env.ARTWORK_MODEL || 'gemini-3.1-flash-lite-image';
}

/**
 * Ask Gemini for a thumbnail.
 *
 * Returns `{ bytes: Uint8Array, contentType }`. Throws with a short machine
 * readable reason; the caller maps that to a human message. The upstream error
 * body is logged, never returned — it can echo the prompt back and can contain
 * account details that have no business reaching a player's browser.
 */
export async function generateImage(env, prompt) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error('artwork_not_configured');

  const controller = new AbortController();
  // Image models think before they draw. Without a ceiling a single hung
  // request occupies a Worker slot against the user's allowance forever.
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let response;
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        model: modelId(env),
        input: [{ type: 'text', text: prompt }],
        response_format: {
          type: 'image',
          mime_type: 'image/jpeg',
          // 3:2 is the card's native ratio, so the model frames the composition
          // for it instead of the browser centre-cropping a square and losing
          // whatever was at the edges.
          aspect_ratio: '3:2',
          // 1K is the largest this model emits and is far more than the 640px
          // the canvas pipeline needs, so there is nothing to gain from 2K.
          image_size: '1K',
        },
      }),
    });
  } catch (err) {
    // The cause is preserved so the log line keeps the real network error even
    // though the player only ever sees the short reason.
    if (err?.name === 'AbortError') throw new Error('artwork_timeout', { cause: err });
    console.error('[whitebox-mp] artwork request failed', err?.message);
    throw new Error('artwork_unreachable', { cause: err });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    // Logged, not returned: the upstream body can echo the prompt and carries
    // account detail.
    console.error('[whitebox-mp] artwork upstream', response.status, detail.slice(0, 400));

    if (response.status === 429) throw new Error('artwork_quota_exhausted');
    if (response.status === 400 || response.status === 422) {
      // Gemini reports a refused prompt as a 400 with a safety reason. The
      // player asked for something; saying "that prompt was refused" is more
      // useful than "bad request".
      throw new Error(/safety|blocked|prohibited/i.test(detail)
        ? 'artwork_prompt_refused'
        : 'artwork_prompt_rejected');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('artwork_not_configured');
    }
    throw new Error('artwork_failed');
  }

  const payload = await response.json().catch(() => null);
  // `output_image` is the convenience property and is correct for a plain
  // text-to-image turn. It is NOT correct for interleaved text-and-image output,
  // which this endpoint never requests.
  const data = payload?.output_image?.data;
  if (!data || typeof data !== 'string') {
    console.error('[whitebox-mp] artwork response had no image', JSON.stringify(payload).slice(0, 300));
    throw new Error('artwork_no_image');
  }

  let bytes;
  try {
    bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  } catch (err) {
    throw new Error('artwork_no_image', { cause: err });
  }
  if (bytes.byteLength === 0) throw new Error('artwork_no_image');

  return { bytes, contentType: payload?.output_image?.mime_type || 'image/jpeg' };
}

/** Public count for the account, so the UI can say what is left before trying. */
export async function generationUsage(env, userId, now = Date.now()) {
  const quota = await quotaStatus(env, userId, now);
  return { used: quota.used, limit: quota.limit, remaining: quota.remaining };
}