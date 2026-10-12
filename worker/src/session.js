// Session handling for WhiteBox sign-in.
//
// The Google ID token is exchanged for an opaque random session id. The id is
// stored in an HttpOnly cookie, so page JavaScript can never read it — an XSS
// bug cannot exfiltrate a working credential. The Worker looks the id up in KV
// and that is the only source of truth for "who is this".

const COOKIE_NAME = 'wb_session';
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const SESSION_PREFIX = 'session:';

// 256 bits of entropy, base64url encoded. crypto.getRandomValues is the CSPRNG
// in Workers; Math.random would not be acceptable for a session credential.
export function newSessionId() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function cookieHeader(value, { maxAge, secure } = {}) {
  const parts = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    // Secure is required in production. Localhost http://dev is exempt by
    // browsers, so we send it based on the request scheme rather than always.
    `Secure=${secure ? 'true' : 'false'}`,
  ];
  if (typeof maxAge === 'number') parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function sessionCookieHeader(request, sessionId) {
  return cookieHeader(sessionId, {
    maxAge: SESSION_TTL_SEC,
    secure: new URL(request.url).protocol === 'https:',
  });
}

export function clearedSessionCookieHeader(request) {
  return cookieHeader('', {
    maxAge: 0,
    secure: new URL(request.url).protocol === 'https:',
  });
}

export async function createSession(env, profile) {
  const id = newSessionId();
  const record = {
    ...profile,
    sessionId: undefined,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  };
  // Expiration is enforced by KV TTL, so no manual cleanup is needed.
  await env.SESSIONS.put(SESSION_PREFIX + id, JSON.stringify(record), {
    expirationTtl: SESSION_TTL_SEC,
  });
  return { id, record };
}

export async function readSession(env, request) {
  const id = parseCookies(request)[COOKIE_NAME];
  if (!id) return null;
  const raw = await env.SESSIONS.get(SESSION_PREFIX + id);
  if (!raw) return null;
  try {
    return { id, record: JSON.parse(raw) };
  } catch {
    return null;
  }
}

export async function destroySession(env, request) {
  const id = parseCookies(request)[COOKIE_NAME];
  if (id) await env.SESSIONS.delete(SESSION_PREFIX + id);
}

// Strip anything the client should not see. Returned verbatim to the browser.
export function publicProfile(record) {
  if (!record) return null;
  return {
    id: record.googleSub,
    name: record.name,
    email: record.email,
    emailVerified: Boolean(record.emailVerified),
    picture: record.picture,
    createdAt: record.createdAt,
  };
}