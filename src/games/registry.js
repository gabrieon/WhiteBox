// WhiteBox game registry.
//
// Games are described by manifests (see src/sdk/manifest.js). Registering
// validates the manifest, normalizes defaults, and derives `playable` from
// whether the game actually ships a runnable entry point. Adding a game = drop a
// folder under src/games/ with a manifest and add ONE import + array entry here.
// Nothing else in the app needs to change.
//
// This registry holds BUILT-IN games only — the ones whose code ships in the
// bundle. Games created by players through the Create screen live in the
// database and are fetched at runtime instead; see src/sdk/games/api.js. The two
// sources are merged by the library view so a created game appears alongside a
// built-in one without pretending it has an engine attached.

import { normalizeManifest, validateManifest } from '../sdk/manifest.js';
import wordLock from './word-lock/manifest.js';
import pairVault from './memory-match/manifest.js';

const registry = new Map();

function hasEntry(m) {
  if (m.available === false) return false;
  if (typeof m.loader === 'function') return true;
  if (m.engine === 'phaser') {
    return typeof m.scene === 'function'
      || (Array.isArray(m.scenes) && m.scenes.length > 0);
  }
  return typeof m.component === 'function';
}

export function registerGame(manifest) {
  const { valid, errors } = validateManifest(manifest);
  if (!valid) {
    // One broken game must not take down the whole library. Log loudly, and in
    // dev throw so the author (or agent) fixes it immediately.
    console.error(`[wb-registry] invalid manifest "${manifest && manifest.id}":`, errors);
    if (import.meta.env?.DEV) {
      throw new Error(`Invalid game manifest "${manifest && manifest.id}": ${errors.join('; ')}`);
    }
    return null;
  }
  const normalized = normalizeManifest(manifest);
  normalized.playable = hasEntry(normalized);
  registry.set(normalized.id, normalized);
  return normalized;
}

// Code-split: each game ships its own component and data, so neither is pulled
// into the library bundle for visitors who never open it.
wordLock.loader = () => import('./word-lock/WordLock.jsx');
pairVault.loader = () => import('./memory-match/PairVault.jsx');

const builtIns = [wordLock, pairVault];

builtIns.forEach(registerGame);

export function getGame(id) {
  return registry.get(id) || null;
}

// Kept as an alias — the existing UI imports findGame.
export const findGame = getGame;

export function listGames() {
  return [...registry.values()];
}

// Snapshot for the UI. Registration is synchronous at import time.
export const games = listGames();

// A game is playable only if it validated AND ships a real entry point.
export function isPlayable(manifest) {
  return Boolean(manifest) && manifest.playable === true;
}

// Unique, sorted category list derived from the registry so filter chips always
// match the games that actually exist.
export function listCategories() {
  const set = new Set();
  registry.forEach((game) => (game.categories || []).forEach((c) => set.add(c)));
  return [...set].sort((a, b) => a.localeCompare(b));
}

// Ids of every built-in game. The library view uses this to drop a built-in that
// a created game happens to share an id with.
export function builtinIds() {
  return [...registry.keys()];
}
