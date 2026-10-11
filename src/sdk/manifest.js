// WhiteBox Game SDK — manifest contract.
//
// A game is described by a plain manifest object. The registry validates it, the
// host reads `engine` to pick an adapter, and adapters read the entry point.
// Keep this framework-light: it is plain JS so a coding agent can author a game
// without learning a bespoke DSL.

export const ENGINES = ['react', 'r3f', 'phaser'];
export const PLAY_MODES = ['single', 'multiplayer'];
export const INPUT_METHODS = ['keyboard', 'mouse', 'touch', 'pointer-lock', 'gamepad'];

// Identity helper — returns the manifest unchanged, but gives authors (and
// agents) a single obvious entry point and a place to hang tooling later.
export function defineManifest(manifest) {
  return manifest;
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isStringArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim().length > 0);
}

// Returns { valid: boolean, errors: string[] }. Never throws.
export function validateManifest(manifest) {
  const errors = [];
  const m = manifest || {};

  if (!isNonEmptyString(m.id)) errors.push('id must be a non-empty string');
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.id)) errors.push(`id "${m.id}" must be kebab-case (a-z, 0-9, -)`);

  if (!isNonEmptyString(m.title)) errors.push('title must be a non-empty string');
  if (typeof m.description !== 'string') errors.push('description must be a string');

  if (!ENGINES.includes(m.engine)) errors.push(`engine must be one of: ${ENGINES.join(', ')}`);

  // Entry point depends on engine. Heavy games should use `loader` (a dynamic
  // import) so their engine (three/rapier/phaser) is code-split out of the main
  // bundle and only fetched when the game is opened. Catalog-only entries set
  // `available: false` and are exempt (they render as "coming soon").
  const hasLoader = typeof m.loader === 'function';
  const available = m.available !== false;
  if (available) {
    if (m.engine === 'phaser') {
      const hasScene = typeof m.scene === 'function'
        || (Array.isArray(m.scenes) && m.scenes.length > 0 && m.scenes.every((s) => typeof s === 'function'));
      if (!hasScene && !hasLoader) errors.push('phaser engine requires `scene`/`scenes` (Phaser.Scene classes) or a `loader`');
    } else if (m.engine === 'react' || m.engine === 'r3f') {
      if (typeof m.component !== 'function' && !hasLoader) {
        errors.push(`${m.engine} engine requires \`component\` (a React component) or a \`loader\` (dynamic import)`);
      }
    }
  }

  if (m.categories !== undefined && !isStringArray(m.categories)) errors.push('categories must be an array of non-empty strings');
  if (m.tags !== undefined && !isStringArray(m.tags)) errors.push('tags must be an array of non-empty strings');
  if (m.thumbnail !== undefined && typeof m.thumbnail !== 'string') errors.push('thumbnail must be a string URL/import when provided');

  if (m.playModes !== undefined) {
    if (!Array.isArray(m.playModes) || m.playModes.length === 0 || !m.playModes.every((x) => PLAY_MODES.includes(x))) {
      errors.push(`playModes must be a non-empty subset of: ${PLAY_MODES.join(', ')}`);
    }
  }

  const players = m.players;
  if (players !== undefined) {
    if (!players || typeof players !== 'object') errors.push('players must be an object { min, max }');
    else {
      const { min, max } = players;
      if (!Number.isInteger(min) || min < 1) errors.push('players.min must be an integer >= 1');
      if (!Number.isInteger(max) || max < 1) errors.push('players.max must be an integer >= 1');
      if (Number.isInteger(min) && Number.isInteger(max) && max < min) errors.push('players.max must be >= players.min');
    }
  }

  if (m.input !== undefined) {
    if (!Array.isArray(m.input) || !m.input.every((x) => INPUT_METHODS.includes(x))) {
      errors.push(`input must be a subset of: ${INPUT_METHODS.join(', ')}`);
    }
  }

  // Multiplayer games must declare a room/connection surface.
  const modes = Array.isArray(m.playModes) ? m.playModes : ['single'];
  if (modes.includes('multiplayer')) {
    if (!players || players.max < 2) errors.push('multiplayer games must declare players.max >= 2');
  }

  return { valid: errors.length === 0, errors };
}

// Normalize a validated manifest with sensible defaults so downstream code can
// rely on every field existing.
export function normalizeManifest(manifest) {
  return {
    available: true,
    tags: [],
    categories: [],
    playModes: ['single'],
    input: [],
    players: { min: 1, max: 1 },
    config: {},
    ...manifest,
  };
}
