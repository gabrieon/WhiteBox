import { defineManifest } from '../../sdk/manifest.js';

// Orb Arena Online — the 3D arena with REAL multiplayer. Same React Three Fiber
// engine as the single-player Orb Arena, but positions and scoring are owned by
// the Cloudflare Worker / Durable Object room (see shared/mp-protocol.js). The
// client only proposes moves and pickups; the server validates and broadcasts.
export default defineManifest({
  id: 'orb-arena-mp',
  title: 'Orb Arena Online',
  description:
    'Create or join a room and race real players around the neon arena to grab every orb. Movement and scores are validated server-side.',
  categories: ['3D', 'Multiplayer', 'Action'],
  tags: ['arena', 'multiplayer', 'websocket', 'cloudflare', 'durable-objects', '3d'],
  type: 'arena-online',
  engine: 'r3f',
  playModes: ['multiplayer'],
  players: { min: 2, max: 8 },
  input: ['keyboard', 'mouse'],
  config: {
    three: {
      background: '#070b18',
      gravity: [0, -22, 0],
      camera: { position: [0, 12, 14], fov: 52 },
    },
    mp: {
      // Override with VITE_MP_URL at build time (e.g. wss://your-worker...).
      // Defaults to the local `npm run worker:dev` server.
      speed: 8,
      camHeight: 12,
      camDistance: 13,
    },
  },
  loader: () => import('./OrbArenaMP.jsx'),
});
