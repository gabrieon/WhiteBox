import { defineManifest } from '../../sdk/manifest.js';

// Orb Dash 2D — minimal but genuinely playable Phaser 3 example that exercises
// the 2D adapter (load, start, input, resize, restart, cleanup).
export default defineManifest({
  id: 'orb-dash-2d',
  title: 'Orb Dash 2D',
  description: 'A quick 2D warm-up: dash around and scoop up orbs before the clock runs out.',
  categories: ['2D', 'Arcade'],
  tags: ['phaser', '2d', 'arcade', 'reflex'],
  type: '2d',
  engine: 'phaser',
  playModes: ['single'],
  players: { min: 1, max: 1 },
  input: ['keyboard'],
  config: {
    phaser: { backgroundColor: '#101322' },
    rounds: 30, // seconds per round
  },
  loader: () => import('./scene.js'),
});
