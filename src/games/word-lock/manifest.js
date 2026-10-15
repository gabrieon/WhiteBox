import { defineManifest } from '../../sdk/manifest.js';

// WORDLOCK — six guesses at a five-letter word.
//
// The `rules` array is not decoration: the Create/play flow renders it verbatim
// on the rules screen, so the player reads the same instructions here that they
// would see at runtime. Keeping them on the manifest means a game carries its
// own rules and the play shell stays generic.
export default defineManifest({
  id: 'word-lock',
  title: 'WordLock',
  description: 'Six guesses, five letters, one word. The green tells you where.',
  categories: ['Words', 'Puzzle'],
  tags: ['word', 'daily', 'solo', 'keyboard'],
  type: 'word',
  engine: 'react',
  playModes: ['single'],
  players: { min: 1, max: 1 },
  input: ['keyboard', 'touch'],

  // Consumed by the play shell's rules screen.
  rules: [
    'Guess the hidden five-letter word in six tries.',
    'After each guess the tiles change colour to show how close you are.',
    'Green means the letter is right and in the right spot.',
    'Amber means the letter is in the word, but somewhere else.',
    'Grey means the letter is not in the word at all.',
    'Type your guess and press Enter. Use the on-screen keys or your keyboard.',
  ],

  config: {
    wordLength: 5,
    maxGuesses: 6,
  },
});
