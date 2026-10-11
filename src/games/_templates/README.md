# Game templates

Two minimal, working starting points. **Neither is registered**, so they never
appear in the library or the production build — they exist to be copied.

| Folder | Engine | Shows |
| --- | --- | --- |
| `template-3d/` | `r3f` (React Three Fiber + Rapier) | reusable player controller, physics/collisions, a sensor collectible, DOM HUD, restart, result reporting |
| `template-2d/` | `phaser` (Phaser 3) | booting a Scene via the adapter, reading the game context from the Phaser registry, shared audio/score services, restart |

## Use one

1. Copy the folder to `src/games/<your-game-id>/`.
2. Rename the entry file if you like, and update the manifest `loader`.
3. Edit the manifest: **unique kebab-case `id`**, `title`, `description`,
   `categories`, `engine`, `playModes`, `players`, `input`, `config`.
4. Register it in `src/games/registry.js` — add ONE import and ONE entry to the
   `registerGame` array. Nothing else in the app changes.
5. `npm run dev`, open the game, and iterate.

Full workflow, the manifest contract, the shared services, and the pre-ship
**validation checklist** live in [`GAME_AUTHORING.md`](../../../GAME_AUTHORING.md).
Runtime/architecture details live in [`GAME_SDK.md`](../../../GAME_SDK.md).

## Multiplayer

For a networked game, copy `src/games/orb-arena-mp/` instead — it wires the
shared multiplayer client (`src/sdk/multiplayer/client.js`) to the authoritative
Cloudflare Worker. The server owns scoring; the client only proposes moves and
pickups. See `worker/README.md`.
