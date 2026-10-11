import { defineManifest } from '../../../sdk/manifest.js';

// TEMPLATE manifest for a minimal 2D (Phaser 3) game. Copy the folder, rename
// id/title/etc., and register it in src/games/registry.js.
export default defineManifest({
  id: 'template-2d',
  title: 'Template 2D',
  description:
    'Minimal Phaser 3 starter: a sprite you move with arrows/WASD and a collectible that respawns until you hit the goal.',
  categories: ['2D'],
  tags: ['template', 'phaser', 'starter'],
  type: '2d',
  engine: 'phaser',
  playModes: ['single'],
  players: { min: 1, max: 1 },
  input: ['keyboard'],
  config: {
    phaser: { backgroundColor: '#101322' },
  },
  // For Phaser, `loader` resolves the scene module (default export = a Scene).
  loader: () => import('./scene.js'),
});
