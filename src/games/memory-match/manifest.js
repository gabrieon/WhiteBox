import { defineManifest } from '../../sdk/manifest.js';

// Pair Vault — clear eight shuffled pairs in as few moves as possible.
//
// The `rules` array is not decoration: the play shell renders it verbatim on
// the rules screen, so the player reads the same instructions here that they
// would see at runtime. Keeping them on the manifest means a game carries its
// own rules and the play shell stays generic.
export default defineManifest({
  id: 'pair-vault',
  title: 'Pair Vault',
  description: 'Sixteen cards, eight pairs. Remember where everything hides.',
  categories: ['Memory', 'Puzzle'],
  tags: ['memory', 'pairs', 'solo', 'touch'],
  type: 'memory',
  engine: 'react',
  playModes: ['single'],
  players: { min: 1, max: 1 },
  input: ['touch', 'mouse'],

  // Consumed by the play shell's rules screen.
  rules: [
    'Tap two cards to turn them over.',
    'Matching pairs stay open. Misses turn back down.',
    'Clear all eight pairs in as few moves as you can.',
    'The clock starts on your first tap.',
  ],

  config: {
    pairs: 8,
    columns: 4,
  },
});
