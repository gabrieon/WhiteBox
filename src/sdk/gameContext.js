// Shared React context for the game runtime. Kept in its own module so games can
// import `useGame()` without pulling in the host, and so the host file stays a
// clean single-component module.

import { createContext, useContext } from 'react';

export const GameContext = createContext(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame() must be used inside a <GameHost>');
  return ctx;
}
