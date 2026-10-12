import { defineManifest } from '../../sdk/manifest.js';

// Orb Duel — local 1v1 in 3D. Two players share one machine and one keyboard,
// so this declares `single` play mode with both keyboard bindings: it needs no
// server, no room code and no network round-trip to be genuinely competitive.
export default defineManifest({
  id: 'orb-duel',
  title: 'Orb Duel',
  description:
    'Local 1v1 in 3D. Two players, one keyboard — race each other for the orbs and take the first to ten.',
  categories: ['3D', 'Multiplayer', 'Action', 'Party'],
  tags: ['local', '1v1', 'split-keyboard', 'physics', '3d', 'versus'],
  type: 'arena',
  engine: 'r3f',
  playModes: ['single'],
  players: { min: 2, max: 2 },
  input: ['keyboard'],
  mode: '1v1 Local',
  config: {
    three: {
      background: '#070b18',
      gravity: [0, -22, 0],
      // The game drives the camera itself (overhead view framing both players),
      // so this is only the starting pose before the first frame.
      camera: { position: [0, 25, 17], fov: 50 },
      shadows: true,
    },
    duel: { targetScore: 10, activeOrbs: 5 },
  },
  loader: () => import('./OrbDuel.jsx'),
});