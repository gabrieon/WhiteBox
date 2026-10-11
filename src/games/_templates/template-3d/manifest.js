import { defineManifest } from '../../../sdk/manifest.js';

// TEMPLATE manifest for a minimal 3D (React Three Fiber) game. Copy the folder,
// rename id/title/etc., and register it in src/games/registry.js.
export default defineManifest({
  id: 'template-3d',
  title: 'Template 3D',
  description:
    'Minimal React Three Fiber starter: a controllable capsule, real physics, one collectible, a HUD and restart.',
  categories: ['3D'],
  tags: ['template', 'r3f', 'starter'],
  type: 'arena',
  engine: 'r3f',
  playModes: ['single'],
  players: { min: 1, max: 1 },
  input: ['keyboard'],
  config: {
    three: {
      background: '#0b1024',
      gravity: [0, -22, 0],
      camera: { position: [0, 7, 12], fov: 55 },
    },
  },
  // Dynamic import keeps three / rapier / drei out of the main bundle.
  loader: () => import('./TemplateGame3D.jsx'),
});
