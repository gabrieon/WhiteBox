# Google sign-in

WhiteBox uses **Sign in with Google** so players keep progress and an identity
across devices. The flow is deliberately split: the browser gets a credential,
the Worker decides whether it is real.

```
 browser                        Worker
   |-- GIS button -------------------|
   |<-- signed ID token -----------   (short-lived, verified then discarded)
   |-- POST /auth/google {idToken} ->|
   |                                 | verify signature against Google's JWKS
   |                                 | check aud / iss / exp
   |                                 | mint opaque session id -> KV
   |<-- Set-Cookie: wb_session ------|   HttpOnly, JS cannot read it
   |-- GET /auth/session ----------->|
   |<-- profile ---------------------|
```

## Why it is built this way

**The token is never trusted from the browser.** Anything can POST anything to
`/auth/google`, so the Worker verifies the RS256 signature against Google's
published keys before reading a single claim.

**The browser never holds a usable credential.** The ID token is exchanged once
and thrown away. What persists is a 256-bit random session id in an
`HttpOnly` `SameSite=None; Secure` cookie — `None` is required because the
frontend and the Worker are different origins in every environment
(`rarelyknown.in` vs `workers.dev` in prod, `localhost:5173` vs
`127.0.0.1:8787` in dev), and `Lax` cookies are never sent on cross-site
fetch/WebSocket requests, so login would silently never work otherwise.

**The algorithm is pinned to RS256.** Without this check an attacker can set
`alg: none`, or sign with HS256 using Google's *public* key as the HMAC secret.

**Guest play still works.** With no client id configured the header shows a
`Guest` chip and nothing breaks, so sign-in can be added to a live site
without a flag day.

## Setup

### 1. Google Cloud project

1. [Google Cloud console](https://console.cloud.google.com/) → create/select a project.
2. Enable **Google Identity Services** (APIs & Services → Library).
3. Configure the **OAuth consent screen**:
   - *External* (or *Internal* if you have a Workspace org).
   - Add your app under **Test users** while the app is in "Testing" status.
   - Scopes: only `openid email profile` — no extra scopes are requested.
4. **Credentials → Create Credentials → OAuth client ID → Web application**.
5. Add authorised JavaScript origins: your dev origin (e.g.
   `http://localhost:5173`) and production origin.

### 2. Worker secrets and bindings

```bash
cd worker

# Real Google client id (encrypted, never committed)
npx wrangler secret put GOOGLE_CLIENT_ID

# KV namespace for sessions
npx wrangler kv namespace create SESSIONS
# paste the returned id into wrangler.toml, replacing REPLACE_WITH_YOUR_KV_NAMESPACE_ID

npm run worker:dev
```

### 3. Front-end env

Create `.env.local` in the repo root:

```
VITE_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
VITE_MP_URL=ws://127.0.0.1:8787
# Only needed if the Worker is on a different origin than VITE_MP_URL implies:
# VITE_API_URL=https://api.example.com
```

Also add production origins to `ALLOWED_ORIGINS` in `worker/wrangler.toml`.
Credentialed cookie requests cannot use `Access-Control-Allow-Origin: *`, so
the Worker echoes an explicit allowlisted origin for `/auth/*`.

## Verifying it works

```bash
npm run test:auth
```

Generates a real RSA key pair and runs the Worker's exact verification code
against 8 cases, including a forged signature and an `alg: none` token.

## Saved progress (mid-run resume)

Signed-in players resume where they left: games report snapshots with
`ctx.saveProgress(data)` and read them back with `ctx.loadProgress()` (both
synchronous localStorage). Leaving a game flushes the snapshot to
`PUT /v1/me/progress`; signing in pulls the server copy into the device
(newer wins per game). Restarting or finishing a run deletes its snapshot.
Supported so far: Higher or Lower (solo), Orb Arena, Orb Dash 2D.

The session is available anywhere via `useAuth()`. To show real names in
Orb Arena Online instead of the anonymous generated ones, have the room read
the session on `join` and use `profile.name`. Note that rooms are currently
unauthenticated by design (codes are unguessable but public) — pass the profile
rather than trusting a client-sent name.