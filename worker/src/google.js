// Google ID token verification for the WhiteBox Worker.
//
// A Google credential arriving from the browser is UNTRUSTED input: the client
// can be modified, and anyone can POST anything to this endpoint. So the token
// is verified here against Google's published signing keys before a single
// claim from it is used. Nothing in the ID token is ever read before the
// signature checks out.
//
// Verification uses only WebCrypto + fetch, both available in Workers, so
// there is no Node crypto dependency and no JWT library to keep patched.

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

// Google rotates signing keys infrequently. Cache the JWKS for an hour so we
// are not refetching it on every login, but re-fetch if a kid we do not hold
// turns up (which is what a key rotation looks like).
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
  const json = new TextDecoder().decode(base64UrlToBytes(segment));
  return JSON.parse(json);
}

function getHeaderAndClaims(idToken) {
  if (typeof idToken !== 'string') return null;
  const parts = idToken.split('.');
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

async function getKeys() {
  const now = Date.now();
  if (jwksCache.keys && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`jwks fetch failed: ${res.status}`);
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

async function verifySignature(parsed, kid) {
  let keys = await getKeys();
  let jwk = keys.find((k) => k.kid === kid);

  // Unknown kid: most likely a key rotation, so refresh once and retry.
  if (!jwk) {
    jwksCache = { keys: null, fetchedAt: 0 };
    keys = await getKeys();
    jwk = keys.find((k) => k.kid === kid);
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
 * Verify a Google ID token and return its claims.
 * Throws with a short reason on any failure. Returns claims only when the
 * signature is valid AND aud/iss/exp all check out.
 */
export async function verifyGoogleIdToken(idToken, { clientId, clockToleranceSec = 60 }) {
  if (!clientId) throw new Error('auth_not_configured');

  const parsed = getHeaderAndClaims(idToken);
  if (!parsed) throw new Error('malformed_token');

  // Pin the algorithm: prevents the classic "alg: none" / HS256 confusion where
  // an attacker signs with the public key as an HMAC secret.
  if (parsed.header.alg !== 'RS256') throw new Error('bad_algorithm');

  const valid = await verifySignature(parsed, parsed.header.kid);
  if (!valid) throw new Error('bad_signature');

  const { iss, aud, exp, sub, email, email_verified, name, picture } = parsed.claims;

  if (!ISSUERS.has(iss)) throw new Error('bad_issuer');
  if (aud !== clientId) throw new Error('bad_audience');

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof exp !== 'number' || nowSec > exp + clockToleranceSec) throw new Error('token_expired');
  if (typeof sub !== 'string' || !sub) throw new Error('missing_subject');

  // email_verified arrives as a string "true" in some responses; normalise.
  const verifiedEmail = email_verified === true || email_verified === 'true';

  return {
    googleSub: sub,
    email: typeof email === 'string' ? email : null,
    emailVerified: verifiedEmail,
    name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 64) : null,
    picture: typeof picture === 'string' ? picture.slice(0, 512) : null,
  };
}