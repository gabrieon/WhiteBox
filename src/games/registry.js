// WhiteBox game registry.
//
// Games are described by manifests (see src/sdk/manifest.js). Registering
// validates the manifest, normalizes defaults, and derives `playable` from
// whether the game actually ships a runnable entry point. Adding a game = drop a
// folder under src/games/ with a manifest and add ONE import + array entry here.
// Nothing else in the app needs to change.

import { normalizeManifest, validateManifest } from '../sdk/manifest.js';

// Lightweight, already-working React game — imported statically (no engine deps).
import ReactionTest from './ReactionTest.jsx';

// Heavier games declare a `loader` in their manifest so their engine
// (three/rapier/drei, phaser) is code-split and only fetched when opened.
import orbArena from './orb-arena/manifest.js';
import orbArenaMp from './orb-arena-mp/manifest.js';
import orbCollector2d from './orb-collector-2d/manifest.js';

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

// Catalog-only entries: listed in the UI, not yet playable ("coming soon").
const guessTheCountry = {
  id: 'guess-the-country',
  title: 'Guess the Country',
  description: 'Use the clues to find your way around the world.',
  categories: ['Guessing', 'Knowledge'],
  type: 'country',
  engine: 'react',
  available: false,
};

const humanOrAi = {
  id: 'human-or-ai',
  title: 'Human or AI',
  description: 'Can you tell what is real at a glance?',
  categories: ['Visual'],
  type: 'visual',
  engine: 'react',
  available: false,
};

const reactionTest = {
  id: 'reaction-test',
  title: 'Reaction Test',
  description: 'A quick challenge for your reflexes and focus.',
  categories: ['Tests'],
  type: 'reaction',
  engine: 'react',
  input: ['mouse', 'keyboard'],
  component: ReactionTest,
};

[reactionTest, guessTheCountry, humanOrAi, orbArena, orbArenaMp, orbCollector2d].forEach(registerGame);

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
