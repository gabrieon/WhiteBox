// Higher or Lower — 1v1 comparison duel.
//
// Two ways to play, same rules and same code path:
//   SOLO  — you against the CPU on this device.
//   DUEL  — a real second player in another tab on this machine, connected
//           through the SDK's local match transport. The host tab owns the
//           deck and all scoring; the guest tab proposes guesses and renders
//           whatever the host commits, so a guest can never invent a point.
//
// Objective: read the card, guess whether the NEXT card is higher or lower.
// Correct = 1 point. First to TARGET_SCORE wins.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../sdk/gameContext.js';
import {
  createMatch,
  makeRoomCode,
  matchLink,
  MatchRole,
  MatchStatus,
} from '../../sdk/match/localMatch.js';
import { COMPARISON_CARDS, TARGET_SCORE } from './cards.js';
import './HigherOrLower.css';

function shuffledDeck() {
  const deck = [...COMPARISON_CARDS];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function formatValue(card) {
  const n = card.value;
  const text = n >= 1000
    ? n.toLocaleString('en-US')
    : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
  return card.unit ? `${text} ${card.unit}` : text;
}

// One round of pure logic, shared by solo and duel so they can never diverge.
function applyGuess(snapshot, guess) {
  const { card, deck, score, turn, round, winner } = snapshot;
  if (winner !== null || round >= deck.length - 1) return snapshot;

  const nextCard = deck[round + 1];
  const correct = guess === 'higher'
    ? nextCard.value > card.value
    : nextCard.value < card.value;

  const nextScore = score.slice();
  if (correct) nextScore[turn] += 1;

  const reachedTarget = nextScore[turn] >= TARGET_SCORE;
  const exhausted = round + 1 >= deck.length - 1;

  return {
    card: nextCard,
    deck,
    score: nextScore,
    turn: turn === 0 ? 1 : 0,
    round: round + 1,
    winner: reachedTarget ? turn : exhausted ? (nextScore[0] === nextScore[1] ? null : (nextScore[0] > nextScore[1] ? 0 : 1)) : null,
    lastReveal: { guess, correct, revealed: nextCard, previous: card, by: turn },
  };
}

function freshMatch() {
  const deck = shuffledDeck();
  return {
    card: deck[0],
    deck,
    score: [0, 0],
    turn: 0,
    round: 0,
    winner: null,
    lastReveal: null,
  };
}

// --- saved runs -------------------------------------------------------------
// Solo runs persist (locally always, on the account when signed in) so leaving
// mid-game and coming back resumes the exact position. Decks serialize as
// labels and rehydrate against the current card pool; anything unrecognized
// discards the save instead of crashing.

function serializeSnapshot(snap) {
  return {
    card: snap.card.label,
    deck: snap.deck.map((c) => c.label),
    score: snap.score,
    turn: snap.turn,
    round: snap.round,
    winner: snap.winner,
    lastReveal: snap.lastReveal ? {
      guess: snap.lastReveal.guess,
      correct: snap.lastReveal.correct,
      revealed: snap.lastReveal.revealed.label,
      previous: snap.lastReveal.previous.label,
      by: snap.lastReveal.by,
    } : null,
  };
}

function deserializeSnapshot(data) {
  try {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const byLabel = (label) => COMPARISON_CARDS.find((c) => c.label === label) || null;
    const deck = Array.isArray(data.deck) ? data.deck.map(byLabel) : [];
    const card = byLabel(data.card);
    if (!card || deck.length === 0 || deck.some((c) => !c)) return null;
    if (!Array.isArray(data.score) || data.score.length !== 2) return null;
    if (data.winner !== null) return null;
    let lastReveal = null;
    if (data.lastReveal) {
      const revealed = byLabel(data.lastReveal.revealed);
      const previous = byLabel(data.lastReveal.previous);
      if (!revealed || !previous) return null;
      lastReveal = {
        guess: data.lastReveal.guess === 'lower' ? 'lower' : 'higher',
        correct: Boolean(data.lastReveal.correct),
        revealed,
        previous,
        by: data.lastReveal.by === 1 ? 1 : 0,
      };
    }
    return {
      card,
      deck,
      score: data.score.map((n) => Math.max(0, Math.floor(Number(n) || 0))),
      turn: data.turn === 1 ? 1 : 0,
      round: Math.max(0, Math.floor(Number(data.round) || 0)),
      winner: null,
      lastReveal,
    };
  } catch {
    return null;
  }
}

// --- UI ---------------------------------------------------------------------

function ScoreRow({ label, score, active, keys }) {
  return (
    <div className={`hl-score${active ? ' is-active' : ''}`}>
      <span className="hl-score-label">{label}</span>
      <span className="hl-score-value">{score}</span>
      <span className="hl-score-keys">{keys}</span>
    </div>
  );
}

export default function HigherOrLower() {
  const { services, restart, reportResult, saveProgress, loadProgress, clearProgress } = useGame();

  const [mode, setMode] = useState('menu'); // menu | solo | duel
  const [role, setRole] = useState(null); // MatchRole.HOST | MatchRole.GUEST
  const [snapshot, setSnapshot] = useState(freshMatch);
  const [savedRun, setSavedRun] = useState(() => deserializeSnapshot(loadProgress()));
  const [room, setRoom] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [status, setStatus] = useState(MatchStatus.IDLE);
  const [statusNote, setStatusNote] = useState('');
  const [copied, setCopied] = useState(false);

  const matchRef = useRef(null);
  const snapshotRef = useRef(snapshot);

  // Mirror state into a ref for event handlers, which must not close over a
  // stale render. Assigning during render is unsafe, so this runs as an effect.
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  // CPU opponent. Deliberately imperfect so duels stay beatable.
  const cpuGuess = useCallback(() => (Math.random() < 0.62 ? 'higher' : 'lower'), []);

  const announce = useCallback((snap) => {
    const reveal = snap.lastReveal;
    if (reveal) {
      services.audio.play({
        freq: reveal.correct ? 720 : 300,
        duration: 0.14,
        type: reveal.correct ? 'triangle' : 'sawtooth',
        gain: 0.2,
      });
    }
  }, [services]);

  useEffect(() => {
    if (snapshot.winner !== null) {
      services.audio.play({ freq: 900, duration: 0.3, type: 'sine', gain: 0.16 });
      if (mode === 'solo') clearProgress();
      reportResult({ winner: snapshot.winner === 0 ? 'You' : snapshot.winner === 1 ? 'Rival' : 'Draw', score: snapshot.score });
    }
  }, [snapshot.winner, snapshot.score, services, reportResult, mode, clearProgress]);

  useEffect(() => () => { matchRef.current?.close(); matchRef.current = null; }, []);

  // --- solo ---------------------------------------------------------------

  function startSolo() {
    setMode('solo');
    setRole(null);
    clearProgress();
    setSnapshot(freshMatch());
  }

  function resumeSolo() {
    const saved = deserializeSnapshot(loadProgress());
    if (!saved) {
      setSavedRun(null);
      return;
    }
    setMode('solo');
    setRole(null);
    setSnapshot(saved);
  }

  function soloGuess(guess) {
    const snap = snapshotRef.current;
    if (snap.turn === 1) return; // CPU's turn
    const afterYou = applyGuess(snap, guess);
    announce(afterYou);

    if (afterYou.winner !== null) {
      setSnapshot(afterYou);
      return;
    }
    // CPU answers immediately after.
    const afterCpu = applyGuess(afterYou, cpuGuess());
    announce(afterCpu);
    setSnapshot(afterCpu);
    // Persist every completed round so leaving mid-game resumes exactly here.
    // Duels never save: the run belongs to a live opponent, not this device.
    if (afterCpu.winner === null) saveProgress(serializeSnapshot(afterCpu));
  }

  // --- duel ---------------------------------------------------------------

  function startDuelHost() {
    const code = makeRoomCode();
    setRole(MatchRole.HOST);
    setRoom(code);
    setStatus(MatchStatus.WAITING);
    setStatusNote('Waiting for the second player…');
    setMode('duel');
    setSnapshot(freshMatch());

    const match = createMatch({
      gameId: 'higher-lower',
      room: code,
      role: MatchRole.HOST,
      onStatus: (next, meta) => {
        setStatus(next);
        if (next === MatchStatus.CONNECTED) setStatusNote('Rival connected — you go first.');
        if (next === MatchStatus.ERROR && meta) setStatusNote(meta.message);
      },
      onChange: (incoming) => {
        // The guest proposes; only the host decides. Apply the proposal and
        // broadcast the authoritative result back. This bypasses hostGuess's
        // turn guard on purpose — it is the guest's turn right now.
        const proposal = incoming?.data?.proposal;
        if (proposal === 'higher' || proposal === 'lower') applyGuessAndCommit(proposal);
      },
      onState: () => { /* host is the source of truth; nothing to apply */ },
      onError: (err) => setStatusNote(err.message),
    });
    matchRef.current = match;
    announce(freshMatch());
  }

  function startDuelGuest() {
    const code = roomInput.trim().toUpperCase();
    if (code.length < 4) {
      setStatusNote('Enter the room code from your rival.');
      return;
    }
    setRoom(code);
    setRole(MatchRole.GUEST);
    setStatus(MatchStatus.OPENING);
    setStatusNote('Connecting…');
    setMode('duel');

    const match = createMatch({
      gameId: 'higher-lower',
      room: code,
      role: MatchRole.GUEST,
      onStatus: (next, meta) => {
        setStatus(next);
        if (next === MatchStatus.CONNECTED) setStatusNote('Connected. Waiting for the host to start.');
        if (next === MatchStatus.ERROR && meta) setStatusNote(meta.message);
      },
      onState: (next) => {
        // Authoritative state from the host.
        const snap = {
          card: next.data?.card ?? null,
          deck: next.data?.deck ?? [],
          score: next.score,
          turn: next.turn,
          round: next.round,
          winner: next.data?.winner ?? null,
          lastReveal: next.data?.lastReveal ?? null,
        };
        setSnapshot(snap);
        announce(snap);
      },
      onError: (err) => setStatusNote(err.message),
    });
    matchRef.current = match;
  }

  // Apply a guess and publish the result. Deliberately has NO turn guard: the
// host applies its own click only on its own turn, but must accept a guest
// proposal when the turn is the guest's turn.
  function applyGuessAndCommit(guess) {
    const match = matchRef.current;
    const snap = snapshotRef.current;
    if (!match || snap.winner !== null) return;
    const after = applyGuess(snap, guess);
    announce(after);
    setSnapshot(after);
    match.commit({
      score: after.score,
      turn: after.turn,
      round: after.round,
      over: after.winner !== null,
      data: {
        card: after.card,
        deck: after.deck.map((c) => c.label),
        winner: after.winner,
        lastReveal: after.lastReveal,
      },
    });
  }

  function hostGuess(guess) {
    if (snapshotRef.current.turn !== 0) return;
    applyGuessAndCommit(guess);
  }

  function guestGuess(guess) {
    const match = matchRef.current;
    if (!match || snapshotRef.current.turn !== 1) return;
    match.send(guess);
  }

  function leaveDuel() {
    matchRef.current?.close();
    matchRef.current = null;
    setMode('menu');
    setRole(null);
    setStatus(MatchStatus.IDLE);
    setStatusNote('');
    setRoom('');
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(matchLink('higher-lower', room));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setStatusNote('Copy the room code instead — clipboard is blocked.');
    }
  }

  // The role must come from how this tab opened the room, NOT from the
  // connection status: once both tabs are connected both are CONNECTED, so
  // deriving it from status made the guest believe it was the host.
  const isHost = role === MatchRole.HOST;
  const myTurn = snapshot.turn === 0;
  const canGuess = mode === 'solo'
    ? myTurn && snapshot.winner === null
    : (isHost ? snapshot.turn === 0 : snapshot.turn === 1) && snapshot.winner === null;

  const waiting = mode === 'duel' && status !== MatchStatus.CONNECTED;

  const guess = mode === 'solo' ? soloGuess : isHost ? hostGuess : guestGuess;

  const reveal = snapshot.lastReveal;

  const playerLabels = useMemo(() => (
    mode === 'solo'
      ? ['You', 'CPU']
      : isHost ? ['You (host)', 'Rival'] : ['Host', 'You']
  ), [mode, isHost]);

  // --- render -------------------------------------------------------------

  if (mode === 'menu') {
    return (
      <div className="hl">
        <div className="hl-menu">
          <p className="hl-kicker">WHITEBOX DUEL</p>
          <h1 className="hl-title">Higher or Lower</h1>
          <p className="hl-lede">
            Read the card. Guess whether the next one is higher or lower.
            Correct answers score a point — first to {TARGET_SCORE} takes it.
          </p>

          <div className="hl-menu-actions">
            {savedRun && (
              <button type="button" className="hl-btn hl-btn-primary" onClick={resumeSolo}>
                Resume — You {savedRun.score[0]} · CPU {savedRun.score[1]}
              </button>
            )}
            <button type="button" className="hl-btn" onClick={startSolo}>
              {savedRun ? 'New game vs CPU' : 'Play vs CPU'}
            </button>
          </div>

          <div className="hl-divider"><span>or play a friend</span></div>

          <div className="hl-duel">
            <button type="button" className="hl-btn" onClick={startDuelHost}>
              Create 1v1 room
            </button>
            <div className="hl-join">
              <input
                className="hl-input hl-input-code"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={8}
                aria-label="Room code"
              />
              <button type="button" className="hl-btn" onClick={startDuelGuest}>
                Join
              </button>
            </div>
          </div>

          {statusNote && <p className="hl-note">{statusNote}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="hl">
      <div className="hl-scoreboard">
        <ScoreRow label={playerLabels[0]} score={snapshot.score[0]} active={snapshot.turn === 0 && snapshot.winner === null} keys={mode === 'solo' ? 'you' : 'host'} />
        <span className="hl-target">first to {TARGET_SCORE}</span>
        <ScoreRow label={playerLabels[1]} score={snapshot.score[1]} active={snapshot.turn === 1 && snapshot.winner === null} keys={mode === 'solo' ? 'cpu' : 'guest'} />
      </div>

      {waiting && (
        <div className="hl-lobby">
          <h2 className="hl-lobby-title">{status === MatchStatus.CONNECTED ? 'Connected' : 'Waiting for rival'}</h2>
          <p className="hl-lobby-sub">{statusNote}</p>
          {room && (
            <div className="hl-room">
              <span className="hl-room-label">ROOM CODE</span>
              <span className="hl-room-code">{room}</span>
              <button type="button" className="hl-copy" onClick={copyLink}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <p className="hl-room-hint">Open this link in a second tab to play 1v1.</p>
            </div>
          )}
          <button type="button" className="hl-btn" onClick={leaveDuel}>Back</button>
        </div>
      )}

      {!waiting && (
        <>
          <div className="hl-stage">
            <div className="hl-card">
              <span className="hl-card-label">{snapshot.card?.label}</span>
              <span className="hl-card-value">{snapshot.card ? formatValue(snapshot.card) : '—'}</span>
            </div>

            {reveal && (
              <div className={`hl-reveal${reveal.correct ? ' is-correct' : ' is-wrong'}`}>
                <span className="hl-reveal-text">
                  {playerLabels[reveal.by]} guessed {reveal.guess === 'higher' ? 'Higher' : 'Lower'} —{' '}
                  {reveal.correct ? 'correct' : 'wrong'}
                </span>
                <span className="hl-reveal-card">
                  {reveal.revealed.label}: {formatValue(reveal.revealed)}
                </span>
              </div>
            )}

            <div className="hl-guess">
              <button
                type="button"
                className="hl-btn hl-btn-higher"
                onClick={() => guess('higher')}
                disabled={!canGuess}
              >
                Higher
              </button>
              <button
                type="button"
                className="hl-btn hl-btn-lower"
                onClick={() => guess('lower')}
                disabled={!canGuess}
              >
                Lower
              </button>
            </div>

            <p className="hl-status">
              {snapshot.winner !== null
                ? `${playerLabels[snapshot.winner]} wins ${snapshot.score[0]}–${snapshot.score[1]}`
                : canGuess
                  ? 'Your call'
                  : `${playerLabels[snapshot.turn]} is thinking…`}
            </p>

            <div className="hl-footer">
              <button type="button" className="hl-btn hl-btn-ghost" onClick={mode === 'duel' ? leaveDuel : () => { setMode('menu'); setSnapshot(freshMatch()); setSavedRun(deserializeSnapshot(loadProgress())); }}>
                {mode === 'duel' ? 'Leave room' : 'Change mode'}
              </button>
              {mode === 'solo' && (
                <button type="button" className="hl-btn hl-btn-ghost" onClick={() => { clearProgress(); setSavedRun(null); restart(); }}>New game</button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}