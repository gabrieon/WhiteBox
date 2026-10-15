// Publishing trust controls: moderation states and write rate limits.
//
// Two different protections live here for one reason — both answer “who is
// allowed to change the public catalogue, and how fast?” Moderation decides
// whether a new entry may appear at all; rate limiting decides how quickly a
// caller may try. Either control alone leaves the other hole open: moderation
// stops junk from going live but not a script from filling the database with
// pending rows, while rate limits stop floods but not one carefully abusive
// game.
//
// Rate limits reuse the SESSIONS KV binding rather than adding a new one. A new
// namespace would need provisioning before the first deploy, and this is
// exactly the kind of deploy-order dependency that strands a feature: the
// code would be live while its binding is missing. Counters are namespaced
// under `ratelimit:` so they can never collide with a session id.

export const GAME_STATUSES = ['pending', 'approved', 'rejected'];
export const DEFAULT_REVIEW_STATUS = 'pending';

export function isGameStatus(value) {
  return GAME_STATUSES.includes(value);
}

/**
 * Validate a human moderation decision. Unknown strings are rejected rather
 * than coerced — a typo in the client must fail loudly, not become an
 * accidental publish.
 */
export function parseReviewDecision(decision) {
  if (decision === 'approved' || decision === 'rejected') return decision;
  throw new Error('decision_invalid');
}

// Fixed windows with per-scope budgets. These are abuse ceilings, not product
// quotas, so they are generous to legitimate use and strict about floods:
//
// - publishing is capped around legitimate authoring (a human does not ship
//   twenty catalogue entries in an hour);
// - edits and media changes get a much higher ceiling because correcting a
//   mistake must not itself be throttled;
// - review and delete are admin-only paths but are still capped, because a
//   compromised or buggy admin client can do more damage per request.
const WRITE_POLICIES = {
  'auth:login': { limit: 30, windowSeconds: 300 },
  'games:create': { limit: 20, windowSeconds: 3600 },
  'games:update': { limit: 120, windowSeconds: 3600 },
  'games:thumb': { limit: 120, windowSeconds: 3600 },
  'games:delete': { limit: 120, windowSeconds: 3600 },
  'games:review': { limit: 120, windowSeconds: 3600 },
  'builtin:thumb': { limit: 60, windowSeconds: 3600 },
  'progress:save': { limit: 300, windowSeconds: 3600 },
};

function policyFor(scope) {
  return WRITE_POLICIES[scope] || { limit: 60, windowSeconds: 3600 };
}

// An authenticated user is keyed by id; everyone else by observed IP. Mixing
// the two would let one abusive IP burn through every account's budget, or one
// abusive account burn the IP budget everyone behind a NAT shares.
function callerKey(request, userId) {
  if (userId) return `user:${userId}`;
  const ip = request.headers.get('cf-connecting-ip')
    || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || 'unknown';
  return `ip:${ip.slice(0, 80)}`;
}

/**
 * Fixed-window rate check backed by KV.
 *
 * Returns `{ allowed, remaining, retryAfterSeconds, enforced }`. `enforced` is
 * false when there is no usable counter store (local dev without the binding,
 * or a KV outage): writes stay available rather than failing the whole site,
 * because an abuse control must degrade open, not take publishing down.
 */
export async function checkWriteRate(env, request, scope, userId = null, now = Date.now()) {
  const policy = policyFor(scope);
  const key = `ratelimit:${scope}:${callerKey(request, userId)}`;
  const windowMs = policy.windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;

  if (!env.SESSIONS || typeof env.SESSIONS.get !== 'function') {
    return {
      allowed: true, remaining: policy.limit, retryAfterSeconds: 0, enforced: false,
    };
  }

  let record = null;
  try {
    const raw = await env.SESSIONS.get(key);
    if (raw) record = JSON.parse(raw);
  } catch (err) {
    console.error('[whitebox-mp] rate-limit read failed', scope, err?.message);
    return {
      allowed: true, remaining: policy.limit, retryAfterSeconds: 0, enforced: false,
    };
  }

  const count = record && record.windowStart === windowStart
    ? Number(record.count) || 0
    : 0;

  if (count >= policy.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
      enforced: true,
    };
  }

  const next = { windowStart, count: count + 1 };
  try {
    // Counters expire with the window. Without a TTL a hot key would live in KV
    // forever; with one, an idle caller's counter cleans itself up.
    await env.SESSIONS.put(key, JSON.stringify(next), {
      expirationTtl: Math.max(60, policy.windowSeconds),
    });
  } catch (err) {
    console.error('[whitebox-mp] rate-limit write failed', scope, err?.message);
    return {
      allowed: true, remaining: policy.limit, retryAfterSeconds: 0, enforced: false,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, policy.limit - next.count),
    retryAfterSeconds: 0,
    enforced: true,
  };
}

/** 429 shape shared by every throttled write. */
export function rateLimitedResponse(json, cors, retryAfterSeconds) {
  return json(
    { error: 'rate_limited', retryAfterSeconds },
    429,
    cors,
    { 'Retry-After': String(Math.max(1, retryAfterSeconds || 1)) },
  );
}
