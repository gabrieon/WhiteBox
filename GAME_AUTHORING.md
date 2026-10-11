# Authoring a WhiteBox game

How to add a game — for humans **and** for AI agents generating one. The goal:
drop in a folder, register it with one line, and it appears in the library with
its own theme, HUD and rules. No app changes, no global CSS, no faked behavior.

For the underlying architecture see [`GAME_SDK.md`](./GAME_SDK.md).

---

## Start from a template

Copy one of these (they are **not** registered, so they never ship):

- **3D** → `src/games/_templates/template-3d/` (React Three Fiber + Rapier)
- **2D** → `src/games/_templates/template-2d/` (Phaser 3)
- **Multiplayer** → copy `src/games/orb-arena-mp/` (the reference networked game)

---

## The workflow

1. **Create the module.** Copy a template to `src/games/<your-game-id>/`. Use the
   same kebab-case id for the folder and the manifest `id`.

2. **Define the manifest** (`manifest.js`) with `defineManifest({...})`:

   ```js
   import { defineManifest } from '../../sdk/manifest.js';

   export default defineManifest({
     id: 'my-game',                 // unique, kebab-case
     title: 'My Game',
     description: 'One line shown on the card.',
     categories: ['Arcade'],        // drives the filter chips
     tags: ['arcade'],
     type: '2d',                    // drives card artwork (see GameArt.jsx)
     engine: 'phaser',              // 'react' | 'r3f' | 'phaser'
     playModes: ['single'],         // add 'multiplayer' (requires players.max >= 2)
     players: { min: 1, max: 1 },
     input: ['keyboard'],           // keyboard | mouse | touch | pointer-lock | gamepad
     config: { phaser: { backgroundColor: '#101322' } },
     loader: () => import('./scene.js'),   // keeps the engine out of the main bundle
   });
   ```

   - **react / r3f** entry: `component: MyGame` (static) **or** `loader: () =>
     import('./MyGame.jsx')` (lazy — preferred for r3f so three/rapier/drei split
     out). The entry is a React component that calls `useGame()`.
   - **phaser** entry: `loader: () => import('./scene.js')` (default export = a
     `Phaser.Scene`) or a static `scene` / `scenes`.

3. **Use the runtime + shared interfaces.** Read the context, don't reinvent it:

   ```js
   // react / r3f
   const { services, restart, reportResult, reportError, setPhase, onExit } = useGame();

   // phaser (inside a Scene)
   const ctx = this.game.registry.get('ctx');
   ctx.services.audio.play({ freq: 520, duration: 0.1, type: 'triangle' });
   ctx.reportResult({ win: true, score: 10 });
   ```

   Available on `services`: `player`, `input`, `audio`, `scores`, `log`,
   `config`, `multiplayer`. For 3D movement/jump/camera reuse
   `usePlayerController` (`src/sdk/three/usePlayerController.js`).

4. **Own your UI.** Build your HUD/menus inside the game (drei `<Html>` for r3f,
   Phaser game objects for 2D, plain DOM for react). Scope every CSS class under a
   game-specific prefix (e.g. `.oa-*`, `.oamp-*`). **Never** edit global styles or
   the homepage.

5. **Multiplayer (optional).** Use `services.multiplayer`:
   - `await services.multiplayer.createRoom()` → a room code (POST `/rooms`).
   - `services.multiplayer.connect({ room, name, onJoined, onPlayers, onSnapshot,
     onScore, onError, onState })` → a connection with `sendMove(x, z, ry)`,
     `sendPickup(orbId)`, `leave()`, `close()`.
   - **The server owns scoring and validates movement.** The client only proposes
     moves/pickups and renders authoritative snapshots. Never trust the client
     with scores or world state. Tune bounds/orbs/limits in `shared/mp-protocol.js`
     (both sides read it). See `worker/README.md`.

6. **Register it** in `src/games/registry.js` — one import, one array entry:

   ```js
   import myGame from './my-game/manifest.js';
   // ...
   [reactionTest, /* ... */, myGame].forEach(registerGame);
   ```

7. **Preview & test.** `npm run dev`, open the game from the library. For
   multiplayer also run `npm run worker:dev`. Then run the checks below.

---

## Rules that keep the platform honest

- **No fakes.** Don't simulate multiplayer with bots or client-side broadcasts.
  Don't render a "win" that didn't happen. If something isn't implemented, mark the
  manifest `available: false` (it shows as "coming soon") rather than stubbing it.
- **No `eval` of arbitrary source.** Generated/remote code must never be executed
  inside the main app without a real sandbox, resource limits and permission
  boundaries. Games are first-class modules, imported and bundled — not strings.
- **No hardcoded secrets / API keys.** Never embed credentials. Multiplayer config
  comes from env (`VITE_MP_URL`) and the Worker.
- **Clean up.** Prefer `services.input` and engine-managed handlers over manual
  global listeners. If you add a listener/timer, remove it on unmount. Restart is a
  remount — don't rely on state surviving it.
- **Stay in your lane.** Scope CSS to your game. Don't change global tokens, the
  shell, or other games.

---

## Validation checklist (run before calling a game done)

**Build & static checks**
- [ ] `npm run lint` → exit 0 (no new warnings/errors).
- [ ] `npm run build` → exit 0; the game is code-split into its own chunk (heavy
      engines are NOT in the main `index-*.js` bundle).
- [ ] `node scripts/test-sdk.mjs` → passes (manifest + protocol contracts intact).

**Manifest & registration**
- [ ] `id` is unique and kebab-case; folder name matches `id`.
- [ ] `validateManifest` accepts it (in dev, an invalid manifest throws on load —
      the app must still boot cleanly).
- [ ] `engine` matches the entry point shape; `loader`/`component`/`scene` resolves.
- [ ] `categories`/`tags`/`type` set; card artwork renders (add a `type` case in
      `GameArt.jsx` if it's a new type, else it falls back to the neutral box).
- [ ] If `playModes` includes `'multiplayer'`, `players.max >= 2`.

**Runtime behavior (play it in the browser)**
- [ ] Loads without console errors; loading overlay clears.
- [ ] Input works (the methods declared in `input`).
- [ ] Core loop is genuinely playable — real win/lose/score, not a placeholder.
- [ ] `restart` resets state fully; `onExit`/back returns to the library.
- [ ] Pause/resume behaves (if implemented).
- [ ] No leaked listeners/canvases/timers after exit and after several restarts.
- [ ] A thrown error shows the host error overlay with retry (not a blank screen).

**3D specifics (r3f)**
- [ ] Physics/collisions/boundaries work; the player can't escape the arena.
- [ ] Camera follows correctly; resize keeps the aspect ratio.
- [ ] Resources dispose on unmount (no WebGL context warnings on repeat open/close).

**2D specifics (phaser)**
- [ ] Scene boots via the adapter; `RESIZE` scaling keeps it correct on resize.
- [ ] `game.destroy(true)` runs on exit (no orphaned canvas/audio).

**Multiplayer specifics**
- [ ] `npm run worker:dev` is running; room create + join work.
- [ ] Two separate clients (tabs/contexts) see each other's avatars move.
- [ ] Scores come from the server; a client cannot set its own score.
- [ ] Invalid messages are rejected (bad version, oversize, teleport, far pickup).
- [ ] Disconnect cleans up presence; rooms are isolated.
- [ ] `node scripts/test-multiplayer.mjs` → all checks pass.

**Preservation**
- [ ] Existing games, routes, nav and the homepage are unchanged.
- [ ] No global CSS edits; the game's styles are scoped to its own prefix.
- [ ] Responsive at narrow widths (HUD doesn't overflow, game stays usable).

---

## Quick reference

| I want to… | Use |
| --- | --- |
| read the game context (react/r3f) | `useGame()` |
| read the game context (phaser) | `this.game.registry.get('ctx')` |
| play a sound | `services.audio.play({ freq, duration, type, gain })` |
| save a single-player best | `services.scores.submit(score, 'high' \| 'low')` |
| read keyboard | `services.input.axisX()/axisZ()/isDown(code)` |
| 3D movement + jump + camera | `usePlayerController({ bodyRef, ... })` |
| restart the run | `ctx.restart()` |
| finish + show a result | `ctx.reportResult({ win, score, ... })` |
| leave the game | `ctx.onExit()` |
| create/join a room | `services.multiplayer.createRoom()` / `.connect({ room, ... })` |
| send movement / a pickup | `conn.sendMove(x, z, ry)` / `conn.sendPickup(orbId)` |
