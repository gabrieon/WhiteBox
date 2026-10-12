// WhiteBox Game SDK — local 1v1 match transport.
//
// Lets two browser tabs on the same machine play a turn-based 1v1 with no
// server at all, by relaying JSON messages over BroadcastChannel. One tab is
// elected "host" and is the only authority allowed to advance the match; the
// other tab proposes moves and renders whatever the host broadcasts. That
// mirrors the real Worker-backed flow (clients propose, server decides) so a
// game written against this API can move to the remote transport unchanged.
//
// Scope: same-origin, same-device. It is a complete 1v1 for the turn-based
// games (Higher or Lower, Rhyme Battle, ...). Real-time arena play still uses
// the WebSocket Worker because it needs a shared clock and sub-frame authority.

const PROTOCOL = 1;

export const MatchRole = {
  HOST: 'host',
  GUEST: 'guest',
};

export const MatchStatus = {
  IDLE: 'idle',
  OPENING: 'opening',
  WAITING: 'waiting',
  CONNECTED: 'connected',
  CLOSED: 'closed',
  ERROR: 'error',
};

export const MatchMsg = {
  // guest -> host
  HELLO: 'hello',
  PROPOSE: 'propose', // { action, payload }
  LEAVE: 'leave',
  // host -> guest
  WELCOME: 'welcome', // { seed, state }
  STATE: 'state', // authoritative snapshot
  BYE: 'bye',
};

function channelName(room) {
  return `whitebox:match:${room}`;
}

function post(channel, msg) {
  channel.postMessage({ v: PROTOCOL, ...msg });
}

// Read the room code out of a URL hash like #hl/ABCD2, or '' when absent.
export function roomFromLocation() {
  const m = /^#([a-z0-9-]+)\/([A-Za-z0-9]{4,8})$/.exec(window.location.hash);
  return m ? m[2].toUpperCase() : '';
}

// A short, unambiguous room code players can read aloud or type.
export function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

// Build a shareable link for this game+room.
export function matchLink(gameId, room) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#${gameId}/${room}`;
}

/**
 * Open a local 1v1 match.
 *
 * `createMatch`  — opens a room and waits for a second tab to join. The first
 *                  tab to claim a free room becomes host.
 * `joinMatch`    — joins an existing room as the guest.
 *
 * Both return the same handle, so a game can stay transport-agnostic.
 */
export function createMatch({ gameId, room, role, onChange, onState, onStatus, onError }) {
  const state = {
    room,
    role,
    connected: false,
    score: [0, 0],
    turn: 0,
    round: 0,
    over: false,
    data: {},
  };

  if (typeof BroadcastChannel === 'undefined') {
    const err = { code: 'unsupported', message: 'This browser cannot host local 1v1 matches.' };
    onError?.(err);
    onStatus?.(MatchStatus.ERROR, err);
    return { close() {}, send() {}, get state() { return state; } };
  }

  let channel;
  try {
    channel = new BroadcastChannel(channelName(room));
  } catch (err) {
    const e = { code: 'channel_failed', message: String(err) };
    onError?.(e);
    onStatus?.(MatchStatus.ERROR, e);
    return { close() {}, send() {}, get state() { return state; } };
  }

  const isHost = role === MatchRole.HOST;

  // Host handshake timer: if nobody joins, we stop pretending to be waiting.
  let hostTimer = null;
  function waitForGuest() {
    onStatus?.(MatchStatus.WAITING);
    hostTimer = window.setTimeout(() => {
      if (!state.connected) {
        const e = { code: 'no_guest', message: 'No second player joined this room.' };
        onError?.(e);
        onStatus?.(MatchStatus.ERROR, e);
      }
    }, 20_000);
  }

  function applyState(next) {
    state.score = next.score || [0, 0];
    state.turn = next.turn ?? 0;
    state.round = next.round ?? 0;
    state.over = Boolean(next.over);
    state.data = next.data || {};
    onState?.({ ...state, data: state.data });
  }

  function setConnected(value) {
    if (state.connected === value) return;
    state.connected = value;
    if (hostTimer) { clearTimeout(hostTimer); hostTimer = null; }
    onStatus?.(value ? MatchStatus.CONNECTED : MatchStatus.WAITING);
    if (value) onChange?.({ ...state, data: state.data });
  }

  channel.onmessage = (event) => {
    const msg = event.data;
    if (!msg || msg.v !== PROTOCOL) return;

    if (isHost) {
      switch (msg.t) {
        case MatchMsg.HELLO: {
          // First tab to greet wins the room; respond with the live state.
          setConnected(true);
          post(channel, { t: MatchMsg.WELCOME, state: snapshot() });
          break;
        }
        case MatchMsg.PROPOSE:
          // The host decides: proposals are handed to the game, which returns
          // the next authoritative state through `commit`.
          onChange?.({ ...state, data: { proposal: msg.action, payload: msg.payload } });
          break;
        case MatchMsg.LEAVE:
          setConnected(false);
          onError?.({ code: 'guest_left', message: 'The other player left the room.' });
          break;
        default:
          break;
      }
      return;
    }

    // guest
    switch (msg.t) {
      case MatchMsg.WELCOME:
        setConnected(true);
        applyState(msg.state || {});
        break;
      case MatchMsg.STATE:
        applyState(msg.state || {});
        break;
      case MatchMsg.BYE:
        setConnected(false);
        onError?.({ code: 'host_left', message: 'The host closed this room.' });
        break;
      default:
        break;
    }
  };

  function snapshot() {
    return {
      score: state.score,
      turn: state.turn,
      round: state.round,
      over: state.over,
      data: state.data,
    };
  }

  if (isHost) {
    waitForGuest();
  } else {
    onStatus?.(MatchStatus.OPENING);
    // Re-announce briefly: the host tab may still be starting up.
    let tries = 0;
    const greet = () => {
      post(channel, { t: MatchMsg.HELLO, gameId });
      tries += 1;
      if (tries < 12 && !state.connected) hostTimer = window.setTimeout(greet, 250);
    };
    greet();
  }

  return {
    get room() { return room; },
    get role() { return role; },
    get state() { return { ...state, data: state.data }; },
    get connected() { return state.connected; },

    // Guest -> host: propose an action. Ignored by the host.
    send(action, payload) {
      if (!isHost) post(channel, { t: MatchMsg.PROPOSE, action, payload });
    },

    // Host: accept a local action and publish the resulting state to the guest.
    commit(nextState) {
      if (!isHost) return;
      Object.assign(state, {
        score: nextState.score ?? state.score,
        turn: nextState.turn ?? state.turn,
        round: nextState.round ?? state.round,
        over: nextState.over ?? state.over,
        data: nextState.data ?? state.data,
      });
      post(channel, { t: MatchMsg.STATE, state: snapshot() });
      onState?.({ ...state, data: state.data });
    },

    close() {
      if (hostTimer) clearTimeout(hostTimer);
      post(channel, { t: isHost ? MatchMsg.BYE : MatchMsg.LEAVE });
      setConnected(false);
      onStatus?.(MatchStatus.CLOSED);
      channel.close();
    },
  };
}