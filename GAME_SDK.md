# WhiteBox Game SDK

The Game SDK is the layer that lets a new game be added **without touching the
app**. A game is a folder with a **manifest** and an **entry point**; the SDK
provides the **runtime host**, **engine adapters**, **shared services**, and the
**registry** the UI reads from.

This document is the architecture reference. For the step-by-step "how do I add
a game" guide and the pre-ship checklist, see [`GAME_AUTHORING.md`](./GAME_AUTHORING.md).

```
src/sdk/
  manifest.js         the manifest contract: defineManifest / validateManifest / normalizeManifest
  lifecycle.js        GamePhase, RUNTIME_METHODS, a tiny event emitter
  services.js         player identity, input, audio, scores, logging, config, multiplayer
  gameContext.js      React context + useGame() hook
  GameHost.jsx        mounts a game by engine, owns lifecycle, guarantees cleanup
  GameHost.css        scoped host overlays (loading / error) — never global
  adapters/
    ThreeAdapter.jsx  React Three Fiber + Rapier host (Canvas, lights, <Physics>)
    PhaserAdapter.jsx Phaser 3 host (boots a Scene, RESIZE scaling, destroy on unmount)
  three/
    usePlayerController.js  reusable 3D player controller (movement, jump, camera)
  multiplayer/
    client.js         browser WebSocket client for the authoritative server
shared/
  mp-protocol.js      the ONE protocol module imported by both client and Worker
```

## Design goals

- **Additive.** Adding a game = one folder + one import + one array entry in the
  registry. No changes to routing, the homepage, or global CSS.
- **Isolated.** Each game owns its own UI, theme and HUD. Host overlays are scoped
  under `.wb-host*`; game styles are scoped under their own prefixes.
- **Lazy.** Heavy engines (three, rapier, drei, phaser) are code-split. They are
  fetched only when a game that needs them is opened, keeping the main bundle lean.
- **Leak-free.** Every service is disposable; the host disposes them on unmount,
  and restart is a full remount (React `key`), so no listener/canvas/timer survives.
- **Honest.** A game is `playable` only if it validates **and** ships a real entry
  point. Placeholders are listed as "coming soon", never faked.

## The manifest

Every game is described by a manifest created with `defineManifest(...)`
(`src/sdk/manifest.js`). `validateManifest` enforces the contract;
`normalizeManifest` fills defaults.

Required / validated fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | unique, kebab-case |
| `title` | string | shown on the card + game header |
| `description` | string | shown on the card + game header |
| `engine` | `'react' \| 'r3f' \| 'phaser'` | selects the adapter |
| entry point | varies | `component` (react/r3f) or `loader` (lazy) or `scene`/`scenes` (phaser). Required unless `available: false` |
| `categories` | string[] | drive the filter chips (derived dynamically) |
| `playModes` | `('single' \| 'multiplayer')[]` | multiplayer requires `players.max >= 2` |
| `players` | `{ min, max }` | |
| `input` | string[] | `keyboard`, `mouse`, `touch`, `pointer-lock`, `gamepad` |

Optional: `tags`, `type` (drives card artwork in `GameArt.jsx`), `thumbnail`,
`config` (engine + game tuning), `available` (default `true`; set `false` for a
catalog-only "coming soon" entry).

`config` is passed to the engine adapter and to `services.config`. For `r3f`:
`config.three = { background, gravity, camera: { position, fov } }`. For `phaser`:
`config.phaser = { backgroundColor, ... }`.

## Registry

`src/games/registry.js` is the single source of truth the UI reads.

- `registerGame(manifest)` → validates, normalizes, derives `playable` from
  whether a real entry point exists, and stores it. In dev an invalid manifest
  **throws** (fail fast for authors/agents); in prod it logs and skips so one bad
  game can't take down the library.
- `getGame(id)` / `findGame(id)` → the normalized manifest or `null`.
- `listGames()` / `games` → all registered games.
- `isPlayable(manifest)` → `true` only if it validated and has an entry point.
- `listCategories()` → unique sorted categories, so filter chips always match the
  games that actually exist.

## Runtime host (`GameHost`)

`<GameHost manifest={...} onExit={...} />` (mounted by `App.jsx`) does all of:

1. **Creates services** once per manifest (`useMemo`) and **disposes** them on
   unmount.
2. **Owns lifecycle phase** (`GamePhase.RUNNING/PAUSED/OVER/ERROR`) and the run
   `result`.
3. **Picks the adapter** by `manifest.engine` and renders the entry inside a
   `Suspense` (lazy engines) and an **error boundary** (a crash shows a retry
   overlay instead of a blank screen).
4. **Restart** = bump `runId`, used as the React `key` on the game element → a
   clean remount that cannot leak prior state. Services persist across restarts.

### The game context

Every game reads the context with `useGame()` (react/r3f) or
`this.game.registry.get('ctx')` (phaser). Shape:

```js
{
  manifest,     // the normalized manifest
  services,     // { player, input, audio, scores, log, config, multiplayer, dispose }
  phase,        // current GamePhase
  runId,        // increments on restart (also the React key)
  result,       // last value passed to reportResult(), or null
  setPhase,     // (GamePhase) => void
  restart,      // () => void  — remounts the game fresh
  reportResult, // (result) => void — sets phase OVER
  reportError,  // (error) => void — logs + sets phase ERROR
  onExit,       // () => void — leave the game, back to the library
}
```

## Shared services (`services.js`)

Small, disposable objects handed to every game so games don't reinvent them:

- **`player`** — anonymous, per-tab identity (`{ id, name, isLocal }`), persisted
  in `sessionStorage`. No accounts.
- **`input`** — keyboard state tracker: `isDown(code)`, `axisX()`, `axisZ()`,
  `jumpPressed()`, `onChange(fn)`, `dispose()`. Listeners are cleaned up for you.
- **`audio`** — lazy WebAudio blip synth: `play({ freq, duration, type, gain })`,
  `setMuted(v)`, `isMuted()`, `dispose()`. The context is created on first play to
  respect autoplay policies.
- **`scores`** — local per-game persistence for **single-player**: `getBest()`,
  `submit(score, 'high' | 'low')`, `getHistory()`, `reset()`. (Multiplayer scores
  are server-controlled and flow through the connection, not here.)
- **`log`** — scoped `debug/info/warn/error`.
- **`config`** — `get(key, fallback)`, `all()` over the frozen manifest `config`.
- **`multiplayer`** — `createRoom()`, `connect(opts)`, `current`, `dispose()`.
  A thin façade over `sdk/multiplayer/client.js`.

## Engine adapters

### `r3f` (ThreeAdapter)

Renders `<Canvas shadows>` with hemisphere + directional lights, a drei starfield,
and `<Physics gravity timeStep="vary">` from `config.three`. Your game component
is mounted inside, so it is pure React Three Fiber — add `<RigidBody>`, colliders,
`useFrame`, drei `<Html>` HUDs, etc. Reuse `usePlayerController` for a
camera-relative mover with jumping and ground detection.

### `phaser` (PhaserAdapter)

Resolves the Scene (from `scene`/`scenes` or `loader()`), boots `new Phaser.Game`
with `Phaser.Scale.RESIZE`, wires a `ResizeObserver`, puts the context on the
registry under `'ctx'`, mirrors pause/resume from `ctx.phase`, and calls
`game.destroy(true)` on unmount so nothing leaks.

## Lifecycle & cleanup contract

- Phases: `LOADING → RUNNING ⇄ PAUSED → OVER` (or `ERROR`).
- Runtime methods a game/adapter may implement: `init, load, start, pause, resume,
  restart, resize, dispose` (see `lifecycle.js`).
- **Cleanup is guaranteed:** services dispose on host unmount; restart remounts;
  the Phaser adapter destroys its game; the ThreeAdapter unmounts the Canvas. A
  game must not add global listeners it doesn't remove — prefer `services.input`
  and R3F/Phaser-managed handlers.

## Multiplayer (authoritative)

Real multiplayer runs on a Cloudflare Worker + Durable Object using the WebSocket
Hibernation API. **The server is authoritative**: clients propose moves/pickups,
the server validates (bounds, anti-teleport, pickup proximity, rate limit, payload
cap) and owns all scoring, broadcasting throttled snapshots (~10 Hz).

`shared/mp-protocol.js` is imported by **both** the browser client and the Worker
so validation can't drift. The browser side is `sdk/multiplayer/client.js`
(`connectMultiplayer`, `createRoom`), surfaced to games via `services.multiplayer`.
See `worker/README.md` for the server, local dev, and deployment. There are **no
bots or client-side simulation** — two clients only see each other through the
server.
