import { defineManifest } from '../../sdk/manifest.js';

// Orb Arena — 3D (React Three Fiber + Rapier). Single-player for now; the
// multiplayer mode is added in Phase 4 and will extend playModes/players then.
export default defineManifest({
  id: 'orb-arena',
  title: 'Orb Arena',
  description: 'Roll, jump and grab every glowing orb in a neon 3D arena. Beat your best time.',
  categories: ['3D', 'Action'],
  tags: ['arena', 'physics', '3d', 'time-attack'],
  type: 'arena',
  engine: 'r3f',
  playModes: ['single'],
  players: { min: 1, max: 1 },
  input: ['keyboard', 'pointer-lock'],
  config: {
    three: {
      background: '#070b18',
      gravity: [0, -22, 0],
      camera: { position: [0, 7, 12], fov: 55 },
    },
  },
  // Dynamic import keeps three / rapier / drei out of the main bundle.
  loader: () => import('./OrbArena.jsx'),
});
