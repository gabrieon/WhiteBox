// WhiteBox Game SDK — services handed to every game via its context.
//
// Each factory returns a small, disposable object. `createServices` bundles them
// and exposes a single `dispose()` the host calls on unmount so no listener,
// AudioContext or timer leaks out of a game.

import { connectMultiplayer, createRoom } from './multiplayer/client.js';

const SESSION_KEY = 'whitebox:player';
const ADJECTIVES = ['Swift', 'Cosmic', 'Pixel', 'Turbo', 'Neon', 'Brave', 'Lazy', 'Hyper', 'Sneaky', 'Mighty'];
const NOUNS = ['Cube', 'Comet', 'Fox', 'Bot', 'Ghost', 'Rocket', 'Ninja', 'Blob', 'Falcon', 'Yeti'];

function safeStorage(get) {
  try {
    return get();
  } catch {
    return null;
  }
}

// --- Player identity -------------------------------------------------------
// Anonymous, temporary, per-tab (sessionStorage). No accounts in v1.
export function createPlayerIdentity() {
  const stored = safeStorage(() => window.sessionStorage.getItem(SESSION_KEY));
  let profile = stored ? JSON.parse(stored) : null;
  if (!profile || !profile.id) {
    const id = (crypto?.randomUUID?.() || `p-${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 32);
    const name = `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`;
    profile = { id, name, isLocal: true };
    safeStorage(() => window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(profile)));
  }
  return Object.freeze({ ...profile, isLocal: true });
}

// --- Input -----------------------------------------------------------------
// Keyboard state tracker. Games may use this or their own controls; if they use
// this, listeners are cleaned up on dispose.
export function createInputService(methods = []) {
  const keys = new Set();
  const handlers = new Set();
  const wantsKeyboard = methods.length === 0 || methods.includes('keyboard') || methods.includes('pointer-lock');

  function notify() {
    handlers.forEach((h) => h(api));
  }

  function onKeyDown(e) {
    if (!keys.has(e.code)) {
      keys.add(e.code);
      notify();
    }
  }
  function onKeyUp(e) {
    if (keys.delete(e.code)) notify();
  }
  function onBlur() {
    if (keys.size) { keys.clear(); notify(); }
  }

  if (wantsKeyboard && typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
  }

  const api = {
    isDown: (code) => keys.has(code),
    down: (code) => keys.has(code),
    // Convenience axes for WASD/arrows.
    axisX: () => (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    axisZ: () => (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0),
    jumpPressed: () => keys.has('Space'),
    onChange: (fn) => { handlers.add(fn); return () => handlers.delete(fn); },
    dispose() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
      }
      keys.clear();
      handlers.clear();
    },
  };
  return api;
}

// --- Audio -----------------------------------------------------------------
// Tiny WebAudio synth. The context is created lazily on first play to respect
// browser autoplay policies.
export function createAudioService() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  return {
    setMuted(v) { muted = Boolean(v); },
    isMuted: () => muted,
    // Simple oscillator blip: { freq=440, duration=0.1, type='sine', gain=0.2 }
    play({ freq = 440, duration = 0.1, type = 'sine', gain = 0.2 } = {}) {
      if (muted) return;
      const ac = ensure();
      if (!ac) return;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
      osc.connect(g).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duration);
    },
    dispose() {
      if (ctx) { ctx.close().catch(() => {}); ctx = null; }
    },
  };
}

// --- Scores ----------------------------------------------------------------
// Local, per-game persistence for single-player. Multiplayer scoring is
// server-controlled and flows through the multiplayer connection, not here.
export function createScoreService(gameId) {
  const bestKey = `whitebox:${gameId}:best`;
  const histKey = `whitebox:${gameId}:history`;

  function readHistory() {
    const raw = safeStorage(() => window.localStorage.getItem(histKey));
    if (!raw) return [];
    try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
  }

  return {
    getBest() {
      const raw = safeStorage(() => window.localStorage.getItem(bestKey));
      const n = raw === null ? null : Number(raw);
      return n === null || Number.isNaN(n) ? null : n;
    },
    // mode: 'low' keeps the smallest (reaction times), 'high' keeps the largest.
    submit(score, mode = 'high') {
      if (typeof score !== 'number' || !Number.isFinite(score)) return false;
      const best = this.getBest();
      const isBetter = best === null || (mode === 'low' ? score < best : score > best);
      if (isBetter) safeStorage(() => window.localStorage.setItem(bestKey, String(score)));
      const history = [score, ...readHistory()].slice(0, 20);
      safeStorage(() => window.localStorage.setItem(histKey, JSON.stringify(history)));
      return isBetter;
    },
    getHistory: readHistory,
    reset() {
      safeStorage(() => { window.localStorage.removeItem(bestKey); window.localStorage.removeItem(histKey); });
    },
  };
}

// --- Logging ---------------------------------------------------------------
export function createLogger(scope) {
  const prefix = `[wb:${scope}]`;
  return {
    debug: (...a) => console.debug(prefix, ...a),
    info: (...a) => console.info(prefix, ...a),
    warn: (...a) => console.warn(prefix, ...a),
    error: (...a) => console.error(prefix, ...a),
  };
}

// --- Config ----------------------------------------------------------------
export function createConfigService(config = {}) {
  const frozen = Object.freeze({ ...config });
  return {
    get: (key, fallback) => (key in frozen ? frozen[key] : fallback),
    all: () => frozen,
  };
}

// --- Multiplayer -----------------------------------------------------------
// Thin façade so games do not import the client directly and so the URL stays
// configurable. Returns the connection object from connectMultiplayer.
export function createMultiplayerService() {
  let active = null;
  return {
    createRoom,
    connect(opts) {
      if (active) active.close();
      active = connectMultiplayer(opts);
      return active;
    },
    get current() { return active; },
    dispose() {
      if (active) { active.close(); active = null; }
    },
  };
}

// --- Bundle ----------------------------------------------------------------
export function createServices(manifest) {
  const player = createPlayerIdentity();
  const input = createInputService(manifest.input);
  const audio = createAudioService();
  const scores = createScoreService(manifest.id);
  const log = createLogger(manifest.id);
  const config = createConfigService(manifest.config);
  const multiplayer = createMultiplayerService();

  return {
    player,
    input,
    audio,
    scores,
    log,
    config,
    multiplayer,
    dispose() {
      input.dispose();
      audio.dispose();
      multiplayer.dispose();
    },
  };
}
