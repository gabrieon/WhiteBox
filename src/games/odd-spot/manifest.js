import { defineManifest } from '../../sdk/manifest.js';

// Odd Spot — find the one tile that does not belong, ten rounds in a row.
//
// The `rules` array is not decoration: the play shell renders it verbatim on
// the rules screen, so the player reads the same instructions here that they
// would see at runtime. Keeping them on the manifest means a game carries its
// own rules and the play shell stays generic.
export default defineManifest({
  id: 'odd-spot',
  title: 'Odd Spot',
  description: 'Nine tiles, one impostor. Ten rounds of almost-identical letters.',
  categories: ['Visual', 'Puzzle'],
  tags: ['visual', 'perception', 'solo', 'touch'],
  type: 'visual',
  engine: 'react',
  playModes: ['single'],
  players: { min: 1, max: 1 },
  input: ['touch', 'mouse'],

  // Consumed by the play shell's rules screen.
  rules: [
    'Nine tiles appear. Eight match and one is slightly different.',
    'Tap the odd tile to advance to the next round.',
    'A wrong tap counts as a miss, but the round continues.',
    'Clear all ten rounds with as few misses as possible.',
    'The clock starts on your first tap.',
  ],
  ruleIcons: ['grid', 'hand', 'cross', 'trophy', 'clock'],

  config: {
    rounds: 10,
    cells: 9,
  },
});
