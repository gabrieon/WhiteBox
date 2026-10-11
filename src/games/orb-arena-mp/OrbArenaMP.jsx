// Orb Arena Online — REAL multiplayer 3D (React Three Fiber).
//
// Networking model (see shared/mp-protocol.js + worker/):
//   * The client only PROPOSES movement (throttled) and PROPOSES pickups.
//   * The server (Cloudflare Durable Object) is authoritative: it clamps/validates
//     movement, rejects teleports, validates pickup proximity, and owns every
//     score. It broadcasts throttled snapshots (~10 Hz), never per-frame.
//   * Remote avatars are interpolated between snapshots; the local avatar is
//     client-predicted for responsiveness.
//
// The lobby (create/join a room) is DOM via drei <Html>. Once joined, everyone in
// the same room sees each other's avatars move and the server-controlled score.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGame } from '../../sdk/gameContext.js';
import { ConnState } from '../../sdk/multiplayer/client.js';
import {
  ARENA,
  ORB_SPOTS,
  ORB_PICKUP_RADIUS,
  clamp,
  distance2D,
  isRoomCode,
} from '../../../shared/mp-protocol.js';
import './OrbArenaMP.css';

const ARENA_HALF = 15; // visual floor; server clamps movement to ARENA (±14)
const REMOTE_COLORS = ['#4ff3ff', '#ff6b6b', '#ffd166', '#c77dff', '#06d6a0', '#f78c6b', '#8ecae6', '#ff9ecd'];

function connLabel(state) {
  switch (state) {
    case ConnState.CONNECTING: return 'connecting…';
    case ConnState.OPEN: return 'connected';
    case ConnState.JOINED: return 'online';
    case ConnState.RECONNECTING: return 'reconnecting…';
    case ConnState.CLOSED: return 'disconnected';
    case ConnState.ERROR: return 'error';
    default: return 'idle';
  }
}

// --- static scenery (visual only; MP positions are server-driven) ------------
function Arena() {
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1b2a55', emissive: '#2447b8', emissiveIntensity: 0.5, transparent: true, opacity: 0.5, roughness: 0.6,
  }), []);
  return (
    <group>
      <mesh receiveShadow position={[0, -0.5, 0]}>
        <boxGeometry args={[ARENA_HALF * 2, 1, ARENA_HALF * 2]} />
        <meshStandardMaterial color="#0d1226" roughness={0.95} metalness={0.05} />
      </mesh>
      <gridHelper args={[ARENA_HALF * 2, 30, '#3355aa', '#1c2748']} position={[0, 0.02, 0]} />
      {[
        { pos: [ARENA_HALF, 1.5, 0], args: [0.5, 1.5, ARENA_HALF] },
        { pos: [-ARENA_HALF, 1.5, 0], args: [0.5, 1.5, ARENA_HALF] },
        { pos: [0, 1.5, ARENA_HALF], args: [ARENA_HALF, 1.5, 0.5] },
        { pos: [0, 1.5, -ARENA_HALF], args: [ARENA_HALF, 1.5, 0.5] },
      ].map((wall, i) => (
        <mesh key={i} position={wall.pos} material={wallMat}>
          <boxGeometry args={[wall.args[0] * 2, wall.args[1] * 2, wall.args[2] * 2]} />
        </mesh>
      ))}
    </group>
  );
}

function OrbMP({ position, collected }) {
  const matRef = useRef();
  const lightRef = useRef();
  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const pulse = 1.1 + Math.sin(clock.elapsedTime * 3 + position[0]) * 0.5;
    matRef.current.emissiveIntensity = pulse;
    if (lightRef.current) lightRef.current.intensity = pulse * 1.6;
  });
  if (collected) return null;
  return (
    <group position={[position[0], 0.9, position[1]]}>
      <mesh castShadow>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshStandardMaterial ref={matRef} color="#0a2a3a" emissive="#4ff3ff" emissiveIntensity={1.4} roughness={0.25} metalness={0.1} />
      </mesh>
      <pointLight ref={lightRef} color="#4ff3ff" intensity={2} distance={5} decay={2} />
    </group>
  );
}

// A remote player. Lerps its mesh toward the latest authoritative snapshot so
// motion stays smooth between the ~10 Hz server updates.
function RemoteAvatar({ id, name, color, playersRef }) {
  const ref = useRef();
  useFrame((_, dt) => {
    const p = playersRef.current.get(id);
    if (!p || !ref.current) return;
    const k = 1 - Math.exp(-dt * 12);
    p.x += (p.targetX - p.x) * k;
    p.z += (p.targetZ - p.z) * k;
    ref.current.position.set(p.x, 0, p.z);
    ref.current.rotation.y = p.ry || 0;
  });
  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.4, 0.8, 6, 12]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.15} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 1.05, -0.5]}>
        <coneGeometry args={[0.16, 0.4, 12]} />
        <meshStandardMaterial color="#171717" />
      </mesh>
      <Html center position={[0, 2.1, 0]} distanceFactor={16} style={{ pointerEvents: 'none' }}>
        <div className="oamp-nametag">{name}</div>
      </Html>
    </group>
  );
}

function LocalAvatar({ groupRef, color }) {
  return (
    <group ref={groupRef}>
      <mesh castShadow position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.42, 0.84, 6, 12]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.15} emissive="#3a4a00" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 1.05, -0.52]}>
        <coneGeometry args={[0.17, 0.42, 12]} />
        <meshStandardMaterial color="#171717" />
      </mesh>
      <Html center position={[0, 2.15, 0]} distanceFactor={16} style={{ pointerEvents: 'none' }}>
        <div className="oamp-nametag oamp-nametag-you">you</div>
      </Html>
    </group>
  );
}

export default function OrbArenaMP() {
  const { services, onExit } = useGame();
  const mpCfg = services.config.get('mp', {});
  const speed = mpCfg.speed ?? 8;
  const camHeight = mpCfg.camHeight ?? 12;
  const camDistance = mpCfg.camDistance ?? 13;

  // Connection + net state live in refs (mutated from socket callbacks / frames).
  const connRef = useRef(null);
  const playersRef = useRef(new Map());     // id -> { x, z, targetX, targetZ, ry, name, score }
  const localRef = useRef({ x: 0, z: 0, ry: 0 });
  const collectedRef = useRef(new Set());   // server-authoritative collected orb ids
  const pendingRef = useRef(new Set());     // pickups sent, awaiting confirmation
  const collectedSigRef = useRef('');
  const rosterSigRef = useRef('');
  const youIdRef = useRef(null);
  const phaseRef = useRef('lobby');
  const localGroupRef = useRef();
  const camTarget = useMemo(() => new THREE.Vector3(), []);

  // React-rendered mirrors (only updated when a signature actually changes).
  const [phase, setPhaseState] = useState('lobby'); // lobby | connecting | playing
  const [connState, setConnState] = useState(ConnState.IDLE);
  const [roomCode, setRoomCode] = useState('');
  const [youId, setYouId] = useState(null);
  const [roster, setRoster] = useState([]);         // [{ id, name, score }]
  const [collected, setCollected] = useState(() => new Set());
  const [netError, setNetError] = useState('');
  const [rtt, setRtt] = useState(null);
  const [name, setName] = useState(() => services.player.name || 'Player');
  const [joinCode, setJoinCode] = useState('');

  function setPhase(p) { phaseRef.current = p; setPhaseState(p); }

  const total = ORB_SPOTS.length;

  function applyPlayers(players) {
    const map = playersRef.current;
    const seen = new Set();
    for (const p of players) {
      seen.add(p.id);
      const ex = map.get(p.id);
      if (ex) {
        ex.targetX = p.x; ex.targetZ = p.z; ex.ry = p.ry || 0; ex.name = p.name; ex.score = p.score;
      } else {
        map.set(p.id, { x: p.x, z: p.z, targetX: p.x, targetZ: p.z, ry: p.ry || 0, name: p.name, score: p.score });
      }
    }
    for (const id of [...map.keys()]) if (!seen.has(id)) map.delete(id);
    const next = players.map((p) => ({ id: p.id, name: p.name, score: p.score }));
    const sig = next.map((p) => `${p.id}:${p.score}`).join('|');
    if (sig !== rosterSigRef.current) { rosterSigRef.current = sig; setRoster(next); }
  }

  function applyCollected(ids) {
    const next = new Set(ids);
    for (const id of next) pendingRef.current.delete(id);
    const sig = [...next].sort((a, b) => a - b).join(',');
    if (sig === collectedSigRef.current) return;
    const grew = next.size > collectedRef.current.size;
    collectedSigRef.current = sig;
    collectedRef.current = next;
    setCollected(next);
    if (grew) services.audio.play({ freq: 600 + next.size * 30, duration: 0.1, type: 'triangle', gain: 0.22 });
  }

  function startConnection(code) {
    setNetError('');
    setRoomCode(code);
    setPhase('connecting');
    const conn = services.multiplayer.connect({
      room: code,
      name,
      autoJoin: true,
      onState: (s) => setConnState(s),
      onRtt: (v) => setRtt(v),
      onJoined: ({ youId: id, players }) => {
        youIdRef.current = id;
        setYouId(id);
        const me = players.find((p) => p.id === id);
        if (me) { localRef.current.x = me.x; localRef.current.z = me.z; localRef.current.ry = me.ry || 0; }
        applyPlayers(players);
        setPhase('playing');
      },
      onPlayers: (players) => applyPlayers(players),
      onSnapshot: (snap) => { applyPlayers(snap.players || []); applyCollected(snap.collectedOrbs || []); },
      onScore: ({ id, score }) => { const p = playersRef.current.get(id); if (p) p.score = score; },
      onError: (e) => {
        if (e.code === 'orb_invalid') { pendingRef.current.clear(); return; }
        if (e.code === 'rate_limited') return;
        setNetError(e.message || e.code);
        if (e.code === 'room_full') { connRef.current?.close(); setPhase('lobby'); }
      },
    });
    connRef.current = conn;
  }

  async function handleCreate() {
    setNetError('');
    setPhase('connecting');
    setConnState(ConnState.CONNECTING);
    try {
      const code = await services.multiplayer.createRoom();
      startConnection(code);
    } catch {
      setNetError('Could not reach the multiplayer server. Start it with `npm run worker:dev`, then try again.');
      setPhase('lobby');
      setConnState(ConnState.ERROR);
    }
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (!isRoomCode(code)) { setNetError('Enter the 5-character room code to join.'); return; }
    startConnection(code);
  }

  function leaveRoom() {
    connRef.current?.leave();
    connRef.current?.close();
    connRef.current = null;
    playersRef.current.clear();
    collectedRef.current = new Set();
    collectedSigRef.current = '';
    rosterSigRef.current = '';
    pendingRef.current.clear();
    youIdRef.current = null;
    setYouId(null);
    setRoster([]);
    setCollected(new Set());
    setRoomCode('');
    setNetError('');
    setPhase('lobby');
  }

  // Close the socket if this component unmounts (e.g. host restart / navigate away).
  useEffect(() => () => { connRef.current?.close(); }, []);

  // Local prediction + camera + pickups. Everything here runs in the frame loop,
  // so it reads refs (never stale) and touches React state only via the throttled
  // socket callbacks above.
  useFrame((state, dt) => {
    if (phaseRef.current !== 'playing') return;
    const d = Math.min(dt, 0.05);
    const L = localRef.current;
    let ax = services.input.axisX();
    let az = services.input.axisZ();
    const len = Math.hypot(ax, az);
    if (len > 0) {
      ax /= len; az /= len;
      L.x = clamp(L.x + ax * speed * d, ARENA.minX, ARENA.maxX);
      L.z = clamp(L.z + az * speed * d, ARENA.minZ, ARENA.maxZ);
      L.ry = Math.atan2(ax, az);
    }
    if (localGroupRef.current) {
      localGroupRef.current.position.set(L.x, 0, L.z);
      localGroupRef.current.rotation.y = L.ry;
    }
    camTarget.set(L.x, camHeight, L.z + camDistance);
    state.camera.position.lerp(camTarget, 1 - Math.exp(-d * 6));
    state.camera.lookAt(L.x, 1, L.z);

    connRef.current?.sendMove(L.x, L.z, L.ry);

    // Propose pickups for orbs we are actually near; the server re-validates.
    for (let i = 0; i < ORB_SPOTS.length; i += 1) {
      if (collectedRef.current.has(i) || pendingRef.current.has(i)) continue;
      const [ox, oz] = ORB_SPOTS[i];
      if (distance2D(L.x, L.z, ox, oz) <= ORB_PICKUP_RADIUS) {
        pendingRef.current.add(i);
        connRef.current?.sendPickup(i);
      }
    }
  });

  const remotes = roster
    .filter((p) => p.id !== youId)
    .map((p, i) => ({ ...p, color: REMOTE_COLORS[i % REMOTE_COLORS.length] }));
  const leaderboard = [...roster].sort((a, b) => b.score - a.score);
  const online = connState === ConnState.JOINED || connState === ConnState.OPEN;

  async function copyCode() {
    try { await navigator.clipboard.writeText(roomCode); } catch { /* clipboard blocked; code is visible anyway */ }
  }

  return (
    <group>
      <Arena />
      {ORB_SPOTS.map((pos, i) => (
        <OrbMP key={i} position={pos} collected={collected.has(i)} />
      ))}

      {phase === 'playing' && (
        <>
          <LocalAvatar groupRef={localGroupRef} color="#d9ff43" />
          {remotes.map((p) => (
            <RemoteAvatar key={p.id} id={p.id} name={p.name} color={p.color} playersRef={playersRef} />
          ))}
        </>
      )}

      {/* Lobby / menu overlay */}
      {phase !== 'playing' && (
        <Html fullscreen zIndexRange={[30, 0]} style={{ pointerEvents: 'auto' }}>
          <div className="oamp-lobby">
            <div className="oamp-lobby-card">
              <p className="oamp-kicker">multiplayer · server-authoritative</p>
              <h2 className="oamp-title">Orb Arena Online</h2>
              <p className="oamp-sub">
                Create a room and share the code, or join a friend&rsquo;s room. Real players only — the
                server validates every move and owns the score.
              </p>

              <label className="oamp-field">
                <span className="oamp-field-label">Your name</span>
                <input
                  className="oamp-input"
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Player"
                />
              </label>

              <button type="button" className="oamp-btn oamp-btn-primary" onClick={handleCreate} disabled={phase === 'connecting'}>
                {phase === 'connecting' ? 'Connecting…' : 'Create room'}
              </button>

              <div className="oamp-divider"><span>or join</span></div>

              <div className="oamp-joinrow">
                <input
                  className="oamp-input oamp-input-code"
                  value={joinCode}
                  maxLength={5}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                />
                <button type="button" className="oamp-btn" onClick={handleJoin} disabled={phase === 'connecting'}>Join</button>
              </div>

              {netError && <p className="oamp-error">{netError}</p>}
              <p className="oamp-note">
                Needs the multiplayer server running locally (<code>npm run worker:dev</code>) or a deployed
                Worker URL set via <code>VITE_MP_URL</code>.
              </p>
              <button type="button" className="oamp-link" onClick={onExit}>← back to the box</button>
            </div>
          </div>
        </Html>
      )}

      {/* In-game HUD */}
      {phase === 'playing' && (
        <Html fullscreen zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="oamp-hud">
            <div className="oamp-hud-top">
              <div className="oamp-room">
                <span className="oamp-room-label">ROOM</span>
                <span className="oamp-room-code">{roomCode}</span>
                <button type="button" className="oamp-copy" onClick={copyCode}>copy</button>
              </div>
              <div className="oamp-chip">
                <span className="oamp-chip-label">ORBS</span>
                <span className="oamp-chip-value">{collected.size}<em>/{total}</em></span>
              </div>
              <div className={`oamp-pill ${online ? 'is-online' : 'is-offline'}`}>
                <span className="oamp-dot" />{connLabel(connState)}{rtt !== null ? ` · ${rtt}ms` : ''}
              </div>
              <button type="button" className="oamp-btn oamp-btn-small" onClick={leaveRoom}>Leave</button>
            </div>

            <div className="oamp-board">
              <div className="oamp-board-title">Players ({roster.length})</div>
              {leaderboard.map((p) => (
                <div key={p.id} className={`oamp-board-row ${p.id === youId ? 'is-you' : ''}`}>
                  <span className="oamp-board-name">{p.id === youId ? `${p.name} (you)` : p.name}</span>
                  <span className="oamp-board-score">{p.score}</span>
                </div>
              ))}
            </div>

            {netError && <div className="oamp-banner">{netError}</div>}

            {collected.size >= total && (
              <div className="oamp-clear">
                <strong>All orbs collected!</strong> This round is over — create a new room to play again.
              </div>
            )}

            <div className="oamp-hint">WASD / arrows to move · grab orbs · first to the score wins · leave anytime</div>
          </div>
        </Html>
      )}
    </group>
  );
}
