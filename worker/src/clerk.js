// Clerk session-token verification for the WhiteBox Worker.
//
// Clerk issues short-lived JWTs that the frontend reads with getToken() and
// sends as `Authorization: Bearer <token>`. A token from the browser is
// untrusted input, so it is verified here against Clerk's published signing
// keys before any claim from it is used. Same shape as the Google ID token
// verifier: WebCrypto + fetch only, no JWT library.
//
// Configure with CLERK_ISSUER, e.g. https://your-app.clerk.accounts.dev
// (Clerk dashboard → API Keys → Frontend API).

const JWKS_TTL_MS = 60 * 60 * 1000;
let jwksCache = { keys: null, fetchedAt: 0 };

function base64UrlToBytes(input) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function decodeSegment(segment) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));
}

function getHeaderAndClaims(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return {
      header: decodeSegment(parts[0]),
      claims: decodeSegment(parts[1]),
      signature: base64UrlToBytes(parts[2]),
      signedData: new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    };
  } catch {
    return null;
  }
}

async function getKeys(issuer) {
  const now = Date.now();
  if (jwksCache.keys && now - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;

  const res = await fetch(`${issuer.replace(/\/$/, '')}/.well-known/jwks.json`);
  if (!res.ok) throw new Error(`jwks_fetch_failed:${res.status}`);
  const data = await res.json();
  jwksCache = { keys: data.keys || [], fetchedAt: now };
  return jwksCache.keys;
}

async function importKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

async function verifySignature(parsed, issuer) {
  let keys = await getKeys(issuer);
  let jwk = keys.find((k) => k.kid === parsed.header.kid);

  // Unknown kid usually means Clerk rotated keys — refresh once and retry.
  if (!jwk) {
    jwksCache = { keys: null, fetchedAt: 0 };
    keys = await getKeys(issuer);
    jwk = keys.find((k) => k.kid === parsed.header.kid);
  }
  if (!jwk) return false;

  const key = await importKey(jwk);
  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    parsed.signature,
    parsed.signedData,
  );
}

/**
 * Verify a Clerk session token and return the user id it belongs to.
 * Throws a short reason on any failure.
 */
export async function verifyClerkToken(token, { issuer, clockToleranceSec = 60 }) {
  if (!issuer) throw new Error('auth_not_configured');

  const parsed = getHeaderAndClaims(token);
  if (!parsed) throw new Error('malformed_token');

  // Pin RS256: without this an attacker could try `alg: none` or sign with
  // HS256 using the public RSA key as the HMAC secret.
  if (parsed.header.alg !== 'RS256') throw new Error('bad_algorithm');

  if (!(await verifySignature(parsed, issuer))) throw new Error('bad_signature');

  const { iss, exp, sub, azp } = parsed.claims;
  const expected = issuer.replace(/\/$/, '');

  if (iss !== expected) throw new Error('bad_issuer');
  // Clerk tokens are audience-bound; azp carries the authorized party.
  const audience = parsed.claims.aud;
  const audienceOk = audience === expected
    || (Array.isArray(audience) && audience.includes(expected))
    || azp === expected;
  if (!audienceOk) throw new Error('bad_audience');

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof exp !== 'number' || nowSec > exp + clockToleranceSec) throw new Error('token_expired');
  if (typeof sub !== 'string' || !sub) throw new Error('missing_subject');

  return { clerkUserId: sub };
}

/** Pull the bearer token out of an Authorization header. */
export function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}