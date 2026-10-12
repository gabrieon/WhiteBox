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
import orbDuel from './orb-duel/manifest.js';
import higherLower from './higher-lower/manifest.js';

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
const catalogGames = [
  {
    id: 'vibe-check',
    title: 'Vibe Check',
    description: 'A playful personality quiz built for laughs, not labels.',
    categories: ['Tests', 'Party'],
    type: 'test',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'adrenaline-test',
    title: 'Adrenaline Test',
    description: 'Risky choices, fast taps and pressure rounds.',
    categories: ['Tests', 'Reflex'],
    type: 'reaction',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'iq-test',
    title: 'IQ Sprint',
    description: 'Short logic puzzles with a live leaderboard.',
    categories: ['Tests', 'Knowledge'],
    type: 'puzzle',
    engine: 'react',
    mode: 'Ranked',
    available: false,
  },
  {
    id: 'guess-my-country-mp',
    title: 'Guess My Country',
    description: 'Ask clever clues and find the other player’s country first.',
    categories: ['Multiplayer', 'Geography', 'Guessing'],
    type: 'country',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'introvert-test',
    title: 'Introvert Meter',
    description: 'A cozy social-style quiz with shareable results.',
    categories: ['Tests', 'Party'],
    type: 'test',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'charisma-test',
    title: 'Charisma Check',
    description: 'Pick responses and see how the crowd rates your charm.',
    categories: ['Tests', 'Party'],
    type: 'test',
    engine: 'react',
    mode: 'Party',
    available: false,
  },
  {
    id: 'guess-language-written',
    title: 'Guess the Language',
    description: 'Identify written languages before the timer runs out.',
    categories: ['Knowledge', 'Guessing'],
    type: 'language',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'guess-language-spoken',
    title: 'Spoken Language Duel',
    description: 'Hear a clip, buzz in and name the language.',
    categories: ['Audio', 'Knowledge', 'Multiplayer'],
    type: 'audio',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'human-or-ai',
    title: 'Human or AI',
    description: 'Read the chat and decide who is real.',
    categories: ['AI', 'Guessing', 'Multiplayer'],
    type: 'ai',
    engine: 'react',
    mode: 'Party',
    available: false,
  },
  {
    id: 'cake-or-fake',
    title: 'Cake or Fake?',
    description: 'Objects, desserts, deception. Trust nothing.',
    categories: ['Visual', 'Guessing'],
    type: 'visual',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'real-or-ai',
    title: 'Real or AI?',
    description: 'Spot synthetic images and climb the accuracy board.',
    categories: ['AI', 'Visual'],
    type: 'ai',
    engine: 'react',
    mode: 'Ranked',
    available: false,
  },
  {
    id: 'fill-states',
    title: 'Fill the States',
    description: 'Type every US state before the map fades out.',
    categories: ['Geography', 'Typing'],
    type: 'map',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'fill-country',
    title: 'Fill the Country',
    description: 'Name countries from memory in a speed run.',
    categories: ['Geography', 'Typing'],
    type: 'map',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'guess-where',
    title: 'Guess Where It Is',
    description: 'Use scenery and clues to pin the mystery place.',
    categories: ['Geography', 'Guessing'],
    type: 'map',
    engine: 'react',
    mode: 'Ranked',
    available: false,
  },
  {
    id: 'sudoku',
    title: 'Sudoku Rush',
    description: 'Classic logic, fast timer, clean browser board.',
    categories: ['Puzzle', 'Logic'],
    type: 'puzzle',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'chess',
    title: 'Chess Blitz',
    description: 'Quick browser chess rooms for friends and rivals.',
    categories: ['Strategy', 'Multiplayer'],
    type: 'strategy',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'guess-logo',
    title: 'Guess the Logo',
    description: 'Brands, shapes and tiny details under pressure.',
    categories: ['Brands', 'Guessing'],
    type: 'brand',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'guess-car-brand',
    title: 'Guess the Car Brand',
    description: 'Identify cars from silhouettes, details and badges.',
    categories: ['Brands', 'Guessing'],
    type: 'brand',
    engine: 'react',
    mode: 'Ranked',
    available: false,
  },
  {
    id: 'guess-origin',
    title: 'Guess the Origin',
    description: 'Where did the food, object or trend come from?',
    categories: ['Knowledge', 'Guessing'],
    type: 'country',
    engine: 'react',
    mode: 'Party',
    available: false,
  },
  {
    id: 'guess-song',
    title: 'Guess the Song',
    description: 'Name the track from short clips and clues.',
    categories: ['Audio', 'Guessing'],
    type: 'audio',
    engine: 'react',
    mode: 'Party',
    available: false,
  },
  {
    id: 'draw-battle',
    title: 'Competitive Draw',
    description: 'Draw fast, guess faster and steal the round.',
    categories: ['Drawing', 'Multiplayer', 'Party'],
    type: 'drawing',
    engine: 'react',
    mode: 'Party',
    available: false,
  },
  {
    id: 'guess-side',
    title: 'Guess the Side',
    description: 'Pick the winning side from stats, hints and chaos.',
    categories: ['Guessing', 'Party'],
    type: 'versus',
    engine: 'react',
    mode: 'Party',
    available: false,
  },
  {
    id: 'guess-flag',
    title: 'Guess the Flag',
    description: 'Flag trivia built for streaks and duels.',
    categories: ['Geography', 'Guessing'],
    type: 'flag',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'country-shape',
    title: 'Country by Shape',
    description: 'Recognize countries from outlines only.',
    categories: ['Geography', 'Guessing'],
    type: 'map',
    engine: 'react',
    mode: 'Ranked',
    available: false,
  },
  {
    id: 'typing-speed',
    title: 'Typing Speed Test',
    description: 'Race your words-per-minute against friends.',
    categories: ['Typing', 'Multiplayer'],
    type: 'typing',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'fill-blank',
    title: 'Fill in the Blank',
    description: 'Complete phrases before the other player does.',
    categories: ['Words', 'Multiplayer'],
    type: 'word',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'guess-person',
    title: 'Guess the Person',
    description: 'Use hints to name famous people fast.',
    categories: ['Knowledge', 'Guessing'],
    type: 'visual',
    engine: 'react',
    mode: 'Party',
    available: false,
  },
  {
    id: 'guess-year',
    title: 'Guess the Year',
    description: 'Place events, songs and inventions on the timeline.',
    categories: ['Knowledge', 'Guessing'],
    type: 'puzzle',
    engine: 'react',
    mode: 'Ranked',
    available: false,
  },
  {
    id: 'correct-logo',
    title: 'Correct Logo',
    description: 'Choose the real logo from tiny fake differences.',
    categories: ['Brands', 'Visual'],
    type: 'brand',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'brand-colors',
    title: 'Brand Colors',
    description: 'Guess the brand from only its color palette.',
    categories: ['Brands', 'Visual'],
    type: 'brand',
    engine: 'react',
    mode: 'Ranked',
    available: false,
  },
  {
    id: 'spot-difference',
    title: 'Spot the Difference',
    description: 'Find the hidden visual change before your rival.',
    categories: ['Visual', 'Multiplayer'],
    type: 'visual',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'which-bigger',
    title: 'Which Is Bigger?',
    description: 'Compare wild stats and pick the larger one.',
    categories: ['Guessing', 'Knowledge'],
    type: 'versus',
    engine: 'react',
    mode: 'Party',
    available: false,
  },
  {
    id: 'whats-missing',
    title: 'What’s Missing?',
    description: 'Memorize a scene, then spot the missing item.',
    categories: ['Memory', 'Visual'],
    type: 'memory',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'memory-tile',
    title: 'Memory Tiles',
    description: 'Repeat the board pattern as it gets harder.',
    categories: ['Memory', 'Puzzle'],
    type: 'memory',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'color-sequence',
    title: 'Color Sequence',
    description: 'Repeat longer color chains under time pressure.',
    categories: ['Memory', 'Reflex'],
    type: 'memory',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'draw-logo-memory',
    title: 'Draw the Logo',
    description: 'Draw famous logos from memory and compare scores.',
    categories: ['Drawing', 'Brands', 'Party'],
    type: 'drawing',
    engine: 'react',
    mode: 'Party',
    available: false,
  },
  {
    id: 'happened-first',
    title: 'Which Happened First?',
    description: 'Timeline battles across history and pop culture.',
    categories: ['Knowledge', 'Guessing'],
    type: 'puzzle',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'guess-number-1v1',
    title: 'Guess the Number',
    description: 'A simple 1v1 bluffing game with narrowing clues.',
    categories: ['Multiplayer', 'Logic'],
    type: 'versus',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'atlas',
    title: 'ATLAS',
    description: 'A flagship geography gauntlet for serious map players.',
    categories: ['Geography', 'Multiplayer'],
    type: 'map',
    engine: 'react',
    mode: 'Ranked',
    available: false,
  },
  {
    id: 'country-rush',
    title: 'Country Rush',
    description: 'Rapid-fire geography prompts in a race lobby.',
    categories: ['Geography', 'Multiplayer'],
    type: 'map',
    engine: 'react',
    mode: 'Party',
    available: false,
  },
  {
    id: 'map-pin',
    title: 'Map Pin',
    description: 'Drop your pin closest to the hidden location.',
    categories: ['Geography', 'Multiplayer'],
    type: 'map',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'treasure-map',
    title: 'Find the Treasure',
    description: 'A hidden country, two players and one winning pin.',
    categories: ['Geography', 'Multiplayer'],
    type: 'map',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'rich-character',
    title: 'Richer Character?',
    description: 'Compare fictional fortunes and famous net worths.',
    categories: ['Guessing', 'Party'],
    type: 'versus',
    engine: 'react',
    mode: 'Party',
    available: false,
  },
  {
    id: 'guess-price',
    title: 'Guess the Price',
    description: 'Estimate prices and win by being closest.',
    categories: ['Guessing', 'Knowledge'],
    type: 'versus',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'word-unscramble',
    title: 'Word Unscramble',
    description: 'Rebuild scrambled words against the clock.',
    categories: ['Words', 'Typing'],
    type: 'word',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'reverse-word',
    title: 'Reverse a Word',
    description: 'Read backwards words faster than your opponent.',
    categories: ['Words', 'Typing'],
    type: 'word',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'emoji-to-word',
    title: 'Emoji to Word',
    description: 'Decode emoji puzzles into words and phrases.',
    categories: ['Words', 'Party'],
    type: 'word',
    engine: 'react',
    mode: 'Party',
    available: false,
  },
  {
    id: 'word-rhyme-battle',
    title: 'Rhyme Battle',
    description: 'Out-rhyme your opponent before the beat drops.',
    categories: ['Words', 'Multiplayer', 'Audio'],
    type: 'word',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'perfect-timing',
    title: 'Perfect Timing',
    description: 'Hit the exact moment. Milliseconds decide it.',
    categories: ['Reflex', 'Multiplayer'],
    type: 'reaction',
    engine: 'react',
    mode: '1v1',
    available: false,
  },
  {
    id: 'guess-animal',
    title: 'Guess the Animal',
    description: 'Identify animals from sounds, silhouettes and clues.',
    categories: ['Guessing', 'Audio'],
    type: 'audio',
    engine: 'react',
    mode: 'Solo',
    available: false,
  },
  {
    id: 'pick-a-song',
    title: 'Pick a Song',
    description: 'Two tracks side-by-side. Vote with your ears.',
    categories: ['Audio', 'Party'],
    type: 'audio',
    engine: 'react',
    mode: 'Party',
    available: false,
  },
];

const reactionTest = {
  id: 'reaction-test',
  title: 'Reaction Test',
  description: 'A quick challenge for your reflexes and focus.',
  categories: ['Tests'],
  type: 'reaction',
  engine: 'react',
  input: ['mouse', 'keyboard'],
  mode: 'Solo',
  component: ReactionTest,
};

[reactionTest, orbArena, orbArenaMp, orbCollector2d, orbDuel, higherLower, ...catalogGames].forEach(registerGame);

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
