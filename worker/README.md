# WhiteBox Multiplayer Worker

Real, authoritative multiplayer for WhiteBox games (currently **Orb Arena Online**).
Built on **Cloudflare Workers + Durable Objects** using the **WebSocket Hibernation
API**, so idle rooms cost nothing while sockets stay open.

This Worker is **isolated**. It does **not** modify, replace, or redeploy the
existing WhiteBox frontend, and it does **not** touch DNS. Deploying it is
optional and entirely under your control.

---

## Architecture

```
Browser client (src/sdk/multiplayer/client.js)
      │  WebSocket: ws(s)://<worker>/room/<CODE>
      ▼
Worker HTTP entry (src/index.js)
      │  POST /rooms  -> mint a room code
      │  GET  /room/:code -> route to the room's Durable Object
      ▼
GameRoom Durable Object (src/GameRoom.js)   ── one instance per room code
      │  owns room state (src/room.js, PURE + unit-testable)
      │  validates every message (shared/mp-protocol.js)
      │  controls scoring; broadcasts throttled snapshots (~10 Hz)
      ▼
All clients in that room
```

The **same** protocol module (`shared/mp-protocol.js`) is imported by both the
Worker and the browser client, so validation rules can never drift between the
two sides.

### The server is authoritative — clients are never trusted

Enforced in `src/GameRoom.js` + `src/room.js` + `shared/mp-protocol.js`:

| Protection | Where |
| --- | --- |
| Protocol version check | `decodeMessage` (rejects `bad_version`) |
| Payload size cap (2048 B) | `decodeMessage` (rejects `payload_too_large`) |
| Structural validation of every client message | `validateClientMessage` |
| Movement clamped to arena bounds | `normalizeMove` / `applyMove` |
| Anti-teleport (max step per update) | `isPlausibleStep` / `applyMove` |
| **Scoring is server-owned** — a pickup only counts if the orb exists, is uncollected, and the player is within `ORB_PICKUP_RADIUS` | `applyPickup` |
| Clients cannot submit a score (unknown message type) | `validateClientMessage` -> `bad_message` |
| Per-connection rate limit (40 msg/s) | `GameRoom.allow` |
| Room capacity (8 players) | `addPlayer` -> `room_full` |
| Per-room isolated state | one Durable Object per code |
| Idle-room cleanup (60 s empty) | `GameRoom.alarm` via `storage.setAlarm` |
| Disconnect cleanup | `webSocketClose` |

These are all exercised by `scripts/test-multiplayer.mjs` (two real WebSocket
clients) — see **Testing** below.

---

## Local development (no Cloudflare account required)

Local dev uses `wrangler dev`, which runs the Worker in **miniflare** with a
local SQLite-backed Durable Object. Nothing is uploaded.

**Terminal 1 — the multiplayer server:**

```bash
npm install            # first time only
npm run worker:dev     # wrangler dev --config worker/wrangler.toml
```

You should see:

```
Ready on http://127.0.0.1:8787
env.ROOMS (GameRoom)   Durable Object   local
```

**Terminal 2 — the app:**

```bash
npm run dev            # Vite dev server (e.g. http://localhost:5173)
```

Open the app, launch **Orb Arena Online**, click **Create room**, then open a
second browser tab/window, launch **Orb Arena Online**, and **Join** with the
5-character code. Each client sees the other's avatar move; orbs and scores are
server-controlled.

The browser client connects to `ws://127.0.0.1:8787` by default. Override with
the `VITE_MP_URL` env var (see below) — you do **not** need to edit source.

> First run of `wrangler dev` may prompt to allow the `workerd` binary. If the
> postinstall was skipped, run: `npm rebuild workerd` (or approve it via your
> package manager's allow-scripts mechanism).

---

## Configuration

### Pointing the frontend at a server

`src/sdk/multiplayer/client.js` resolves the URL from Vite env:

```js
import.meta.env?.VITE_MP_URL || 'ws://127.0.0.1:8787'
```

Set it in a `.env.local` at the repo root (this file is git-ignored):

```
# local dev (default, can be omitted)
VITE_MP_URL=ws://127.0.0.1:8787

# OR a deployed Worker (note wss:// for production)
# VITE_MP_URL=wss://whitebox-mp.<your-subdomain>.workers.dev
```

Then rebuild/restart the frontend so Vite picks it up.

### wrangler.toml

```toml
name = "whitebox-mp"
main = "src/index.js"
compatibility_date = "2026-01-01"

[[durable_objects.bindings]]
name = "ROOMS"
class_name = "GameRoom"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["GameRoom"]

[observability]
enabled = true
```

---

## Deployment (optional — you control this entirely)

> **No credentials are stored in this repo and none are invented here.** Wrangler
> authenticates against **your own** Cloudflare account via browser OAuth. This
> Worker is separate from the existing frontend deployment; deploying it changes
> nothing about the site's DNS or hosting.

1. **Authenticate with your Cloudflare account** (opens a browser):

   ```bash
   npx wrangler login
   ```

2. **Deploy the Worker** (the Durable Object migration `v1` is applied on first
   deploy):

   ```bash
   npx wrangler deploy --config worker/wrangler.toml
   ```

   Wrangler prints the deployed URL, e.g.
   `https://whitebox-mp.<your-subdomain>.workers.dev`.

3. **Point the frontend at it** by setting `VITE_MP_URL` to the **`wss://`**
   form of that URL (see Configuration), then rebuild and redeploy the frontend
   through whatever pipeline you already use:

   ```
   VITE_MP_URL=wss://whitebox-mp.<your-subdomain>.workers.dev
   ```

4. **Smoke-test** the deployed Worker:

   ```bash
   curl https://whitebox-mp.<your-subdomain>.workers.dev/health
   # -> {"ok":true,"service":"whitebox-mp"}
   ```

### Notes & limits

- The WebSocket route is `wss://<worker>/room/<CODE>`; room creation is
  `POST /rooms`. Both send permissive CORS headers so the frontend can be hosted
  on a different origin. Tighten `Access-Control-Allow-Origin` in
  `src/index.js` if you want to restrict callers.
- `compatibility_date` and the SQLite Durable Object class require a reasonably
  recent wrangler/runtime (this repo pins `wrangler ^4.149.0`).
- Room state persists in Durable Object storage and is debounced; empty rooms
  are torn down after `idleTimeoutMs` (60 s) via a DO alarm.
- To change tuning (capacity, snapshot cadence, rate limit, arena bounds, orb
  layout), edit `shared/mp-protocol.js` — **both** sides read it, so they stay in
  sync. Redeploy the Worker and rebuild the frontend after changing it.

---

## Testing

Two automated suites cover the server without a browser:

```bash
node scripts/test-sdk.mjs           # manifest validation + protocol unit tests
node scripts/test-multiplayer.mjs   # two real WebSocket clients vs. a running worker
```

`test-multiplayer.mjs` expects a server on `http://127.0.0.1:8787` (start it with
`npm run worker:dev`); it waits for `/health` before running. It verifies: both
clients join with distinct identities, presence, **movement by A visible to B**,
far-away pickups rejected, valid pickups awarded by the server, no double-collect,
clients cannot self-submit scores, bad version / oversized payload / teleport
rejected, disconnect cleanup, and room isolation.

---

## Files

```
worker/
  wrangler.toml        isolated Worker + Durable Object config
  src/
    index.js           HTTP entry: /health, POST /rooms, /room/:code -> DO
    GameRoom.js        Durable Object (WebSocket Hibernation API), authoritative
    room.js            PURE room reducer (unit-testable, no transport deps)
shared/
  mp-protocol.js       canonical client+server protocol, bounds, validation
scripts/
  test-multiplayer.mjs two-client integration test
src/sdk/multiplayer/
  client.js            browser WebSocket client used by games
```
