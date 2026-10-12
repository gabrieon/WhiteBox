import { defineManifest } from '../../sdk/manifest.js';

// Higher or Lower — 1v1 comparison duel.
// Plays against the CPU solo, or against a real second player in another tab
// via the SDK's local match transport (no server required).
export default defineManifest({
  id: 'higher-lower',
  title: 'Higher or Lower',
  description:
    'Read the card, then guess if the next one is higher or lower. Correct calls score — first to seven wins. Solo vs CPU or a real 1v1.',
  categories: ['Guessing', 'Multiplayer', 'Party', 'Knowledge'],
  tags: ['1v1', 'cards', 'trivia', 'local', 'turn-based'],
  type: 'versus',
  engine: 'react',
  playModes: ['multiplayer'],
  players: { min: 1, max: 2 },
  input: ['mouse', 'keyboard'],
  mode: '1v1 / Solo',
  config: {
    higherLower: { targetScore: 7 },
  },
  loader: () => import('./HigherOrLower.jsx'),
});