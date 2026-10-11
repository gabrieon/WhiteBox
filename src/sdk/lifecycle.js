// WhiteBox Game SDK — lifecycle contract.
//
// The host owns a game's phase and drives it. Games react to `phase` (React/R3F)
// or implement imperative handlers (Phaser). This module defines the shared
// vocabulary and a tiny event emitter used for error/result/state signals so a
// game can notify the host without the host polling.

export const GamePhase = {
  LOADING: 'loading',
  RUNNING: 'running',
  PAUSED: 'paused',
  OVER: 'over',
  ERROR: 'error',
};

export const PHASES = Object.values(GamePhase);

// The imperative contract an adapter/game controller MAY implement. The host
// calls these when present; React games instead receive `phase` + `runId` props
// and are remounted on restart (which guarantees no leaked state).
//
//   init(ctx)     — one-time setup with the service context
//   load()        — async resource load; resolves when ready to run
//   start()       — begin play
//   pause()       — suspend loops/timers (keep state)
//   resume()      — continue from pause
//   restart()     — reset to initial state and start again
//   resize(w, h)  — container size changed
//   dispose()     — release listeners, GL contexts, canvases, timers
export const RUNTIME_METHODS = ['init', 'load', 'start', 'pause', 'resume', 'restart', 'resize', 'dispose'];

// Minimal, dependency-free emitter for lifecycle signals.
export function createEmitter() {
  const listeners = new Map();
  return {
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type)?.delete(fn);
    },
    emit(type, payload) {
      listeners.get(type)?.forEach((fn) => {
        try {
          fn(payload);
        } catch (err) {
          // A listener throwing must not break the emitter loop.
          console.error('[wb-sdk] listener error', err);
        }
      });
    },
    clear() {
      listeners.clear();
    },
  };
}
