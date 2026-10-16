import { defineManifest } from '../../sdk/manifest.js';

// Player Quiz — the template runtime for a quiz a player created.
//
// This manifest is NOT a catalogue entry. It is never registered, never shown as
// a card, and never appears in the library or the category list; it exists so a
// created quiz's database row can be resolved into something playable. App.jsx
// synthesises a per-game manifest from this one at play time, swapping in the
// row's title, description and questions — see synthesizePlayManifest.
//
// Catalogue metadata is intentionally empty. This template has no identity of
// its own: every field that would appear to the player is supplied by the row
// that is actually being played.
export default defineManifest({
  id: 'player-quiz',
  title: 'Quiz',
  description: '',
  categories: [],
  tags: [],
  type: 'test',
  engine: 'react',
  playModes: ['single'],
  players: { min: 1, max: 1 },
  input: ['touch', 'mouse'],

  // The component itself is attached below as a lazy loader, matching how every
  // other game ships. Importing it here directly would pull the quiz runtime
  // into the bundle for every visitor, including the ones who never open a
  // player-created game.
  loader: () => import('./PlayerQuiz.jsx'),
});