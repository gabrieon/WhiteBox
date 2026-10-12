// Verifies the Google ID-token validation rules with a real RSA key pair,
// exercising the exact code path the Worker uses.
// Run: node scripts/test-google-verify.mjs

import { generateKeyPair, createSign } from 'node:crypto';

// The Worker module relies on the WebCrypto global, which Node 20+ provides.

const { verifyGoogleIdToken } = await import('../worker/src/google.js');

const CLIENT_ID = 'test-client.apps.googleusercontent.com';

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const { publicKey, privateKey } = await new Promise((resolve, reject) => {
  generateKeyPair('rsa', { modulusLength: 2048 }, (err, pub, priv) => {
    if (err) reject(err);
    else resolve({ publicKey: pub, privateKey: priv });
  });
});

// Build a token signed by our key, standing in for Google.
async function makeToken(payload, { kid = 'kid-1', alg = 'RS256' } = {}) {
  const header = b64url(JSON.stringify({ alg, typ: 'JWT', kid }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createSign('RSA-SHA256').update(data).end().sign(privateKey);
  return `${data}.${b64url(sig)}`;
}

// Serve our public key as the JWKS the verifier will fetch.
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'kid-1', alg: 'RS256', use: 'sig' };
globalThis.fetch = async (url) => {
  if (String(url).includes('oauth2/v3/certs')) {
    return { ok: true, json: async () => ({ keys: [jwk] }) };
  }
  throw new Error(`unexpected fetch: ${url}`);
};

const now = Math.floor(Date.now() / 1000);
const good = {
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: '1234567890',
  email: 'player@example.com',
  email_verified: true,
  name: 'Test Player',
  picture: 'https://example.com/a.png',
  exp: now + 3600,
  iat: now,
};

const results = [];
async function check(name, fn, expectOk) {
  try {
    const out = await fn();
    const ok = expectOk === true;
    results.push({ name, pass: ok, detail: ok ? JSON.stringify(out).slice(0, 60) : 'unexpected success' });
  } catch (err) {
    const ok = expectOk === false && err.message === name.replace(/^rejects: /, '');
    results.push({ name, pass: ok, detail: ok ? `rejected (${err.message})` : `UNEXPECTED: ${err.message}` });
  }
}

await check('accepts a valid token',
  async () => verifyGoogleIdToken(await makeToken(good), { clientId: CLIENT_ID }), true);

await check('rejects: bad_signature',
  async () => {
    const t = await makeToken(good);
    const parts = t.split('.');
    // Tamper with the payload, keeping the original signature.
    const forged = `${parts[0]}.${b64url(JSON.stringify({ ...good, sub: 'attacker' }))}.${parts[2]}`;
    return verifyGoogleIdToken(forged, { clientId: CLIENT_ID });
  }, false);

await check('rejects: bad_audience',
  async () => verifyGoogleIdToken(await makeToken({ ...good, aud: 'other-client' }), { clientId: CLIENT_ID }), false);

await check('rejects: bad_issuer',
  async () => verifyGoogleIdToken(await makeToken({ ...good, iss: 'https://evil.example' }), { clientId: CLIENT_ID }), false);

await check('rejects: token_expired',
  async () => verifyGoogleIdToken(await makeToken({ ...good, exp: now - 3600 }), { clientId: CLIENT_ID }), false);

await check('rejects: bad_algorithm',
  async () => verifyGoogleIdToken(await makeToken(good, { alg: 'none' }), { clientId: CLIENT_ID }), false);

await check('rejects: malformed_token',
  () => verifyGoogleIdToken('not.a.jwt', { clientId: CLIENT_ID }), false);

await check('rejects: auth_not_configured',
  () => verifyGoogleIdToken('x.y.z', { clientId: '' }), false);

let failed = 0;
for (const r of results) {
  if (!r.pass) failed += 1;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  ${r.detail}`);
}
console.log(failed ? `\n${failed} failing` : '\nall verification checks passed');
process.exit(failed ? 1 : 0);