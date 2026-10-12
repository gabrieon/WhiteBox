// Orb Duel — local 1v1 in real 3D (React Three Fiber + Rapier).
//
// Two players share one machine and one keyboard:
//   Player 1  W A S D  move  ·  Space  jump
//   Player 2  ↑ ← ↓ →  move  ·  Right Shift  jump
//
// First to TARGET_SCORE orbs wins. Movement is world-space (the camera is a
// fixed overhead view that frames the whole arena), so W always means "away
// from the camera" for both players — no mouse look, no pointer lock, which is
// what makes two-player-on-one-keyboard possible at all.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CapsuleCollider, BallCollider } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGame } from '../../sdk/gameContext.js';
import { useDuelCamera } from '../../sdk/three/useDuelCamera.js';
import './OrbDuel.css';

const ARENA_HALF = 13;
const TARGET_SCORE = 10;
const ACTIVE_ORBS = 5;
const PLAYER_RADIUS = 0.45;

const KEYMAPS = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', jump: 'ShiftRight' },
];

// Out of module render scope, keeping component renders pure.
const nowMs = () => performance.now();

function randomSpot() {
  const pad = 2.5;
  const span = (ARENA_HALF - pad) * 2;
  return [
    (Math.random() * span - (ARENA_HALF - pad)) * 0.92,
    (Math.random() * span - (ARENA_HALF - pad)) * 0.92,
  ];
}

function seedOrbs() {
  return Array.from({ length: ACTIVE_ORBS }, () => randomSpot());
}

// --- orbs -------------------------------------------------------------------

function Orb({ index, position, onBodyReady, onCollect, tint }) {
  const matRef = useRef();
  const lightRef = useRef();

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 3 + index) * 0.5;
    if (lightRef.current) lightRef.current.intensity = 2 + Math.sin(clock.elapsedTime * 3 + index) * 0.8;
  });

  return (
    <RigidBody
      ref={(api) => onBodyReady(index, api)}
      type="fixed"
      sensor
      colliders={false}
      position={[position[0], 0.9, position[1]]}
      onIntersectionEnter={({ other }) => {
        const who = other?.rigidBodyObject?.userData?.duelist;
        if (who !== undefined) onCollect(index, who);
      }}
    >
      <BallCollider args={[0.7]} sensor />
      <mesh castShadow position={[0, 0, 0]}>
        <sphereGeometry args={[0.45, 22, 22]} />
        <meshStandardMaterial
          ref={matRef}
          color="#0a2a3a"
          emissive={tint}
          emissiveIntensity={1.4}
          roughness={0.25}
          metalness={0.1}
        />
      </mesh>
      <pointLight ref={lightRef} color={tint} intensity={2} distance={6} decay={2} />
    </RigidBody>
  );
}

// --- arena ------------------------------------------------------------------

function Arena() {
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1b2a55', emissive: '#2447b8', emissiveIntensity: 0.5, transparent: true, opacity: 0.55, roughness: 0.6,
  }), []);

  const walls = [
    { pos: [ARENA_HALF, 1.5, 0], args: [0.5, 1.5, ARENA_HALF] },
    { pos: [-ARENA_HALF, 1.5, 0], args: [0.5, 1.5, ARENA_HALF] },
    { pos: [0, 1.5, ARENA_HALF], args: [ARENA_HALF, 1.5, 0.5] },
    { pos: [0, 1.5, -ARENA_HALF], args: [ARENA_HALF, 1.5, 0.5] },
  ];

  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={{ ground: true }}>
        <CuboidCollider args={[ARENA_HALF, 0.5, ARENA_HALF]} position={[0, -0.5, 0]} />
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[ARENA_HALF * 2, 1, ARENA_HALF * 2]} />
          <meshStandardMaterial color="#0d1226" roughness={0.95} metalness={0.05} />
        </mesh>
      </RigidBody>
      <gridHelper args={[ARENA_HALF * 2, 26, '#3355aa', '#1c2748']} position={[0, 0.02, 0]} />

      {walls.map((w, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={w.pos}>
          <CuboidCollider args={w.args} />
          <mesh material={wallMat}>
            <boxGeometry args={[w.args[0] * 2, w.args[1] * 2, w.args[2] * 2]} />
          </mesh>
        </RigidBody>
      ))}

      {/* Centre line marks the two halves. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[0.2, ARENA_HALF * 2]} />
        <meshBasicMaterial color="#4ff3ff" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

// --- duelists ---------------------------------------------------------------

function Duelist({ index, spawn, color, bodyRef, keymapRef, enabled }) {
  const { onGroundEnter, onGroundExit } = useDuelistKeys(bodyRef, keymapRef, enabled);
  const facingRef = useRef();

  useFrame(() => {
    const body = bodyRef.current;
    if (!body || !facingRef.current) return;
    const vel = body.linvel();
    // Point the marker along the current travel direction.
    if (Math.abs(vel.x) > 0.4 || Math.abs(vel.z) > 0.4) {
      facingRef.current.rotation.y = Math.atan2(vel.x, vel.z);
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      lockRotations
      position={spawn}
      userData={{ duelist: index }}
      onCollisionEnter={onGroundEnter}
      onCollisionExit={onGroundExit}
    >
      <CapsuleCollider args={[0.4, PLAYER_RADIUS * 2]} />
      <mesh castShadow>
        <capsuleGeometry args={[PLAYER_RADIUS, 0.9, 6, 14]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.15} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <group ref={facingRef} position={[0, 0.25, 0]}>
        <mesh position={[0, 0.55, -0.62]}>
          <coneGeometry args={[0.17, 0.42, 12]} />
          <meshStandardMaterial color="#101010" />
        </mesh>
      </group>
    </RigidBody>
  );
}

// Movement + jump for one duelist. `keymapRef` lets the parent swap control
// schemes without remounting the physics body.
function useDuelistKeys(bodyRef, keymapRef, enabled) {
  const keys = useRef(Object.create(null));
  const grounded = useRef(true);
  const jumpLatch = useRef(false);

  useEffect(() => {
    const down = (e) => { keys.current[e.code] = true; };
    const up = (e) => { keys.current[e.code] = false; };
    const blur = () => { keys.current = Object.create(null); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const isGround = (obj) => Boolean(obj?.userData?.ground);
  const onGroundEnter = useCallback(({ other }) => {
    if (isGround(other?.rigidBodyObject)) grounded.current = true;
  }, []);
  const onGroundExit = useCallback(({ other }) => {
    if (isGround(other?.rigidBodyObject)) grounded.current = false;
  }, []);

  useFrame(() => {
    const body = bodyRef?.current;
    if (!body || !enabled) return;
    const k = keys.current;
    const m = keymapRef.current;
    if (!m) return;

    const fwd = (k[m.up] ? 1 : 0) - (k[m.down] ? 1 : 0);
    const side = (k[m.right] ? 1 : 0) - (k[m.left] ? 1 : 0);

    // World-space: camera looks down -Z, so -Z is "forward" for both players.
    const speed = 8.5;
    let vx = side * speed;
    let vz = -fwd * speed;

    const len = Math.hypot(vx, vz);
    if (len > speed) { vx = (vx / len) * speed; vz = (vz / len) * speed; }

    const vel = body.linvel();
    body.setLinvel({ x: vx, y: vel.y, z: vz }, true);

    const wantJump = Boolean(k[m.jump]);
    if (wantJump && !jumpLatch.current && grounded.current) {
      body.setLinvel({ x: vel.x, y: 8.5, z: vel.z }, true);
      grounded.current = false;
    }
    jumpLatch.current = wantJump;
  });

  return { onGroundEnter, onGroundExit };
}

// --- main -------------------------------------------------------------------

export default function OrbDuel() {
  const { services, restart, reportResult } = useGame();

  const [orbs, setOrbs] = useState(seedOrbs);
  const [score, setScore] = useState([0, 0]);
  const [won, setWon] = useState(-1);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const [flash, setFlash] = useState(0);

  const orbRefs = useRef([]);
  const bodyA = useRef(null);
  const bodyB = useRef(null);
  const keymapA = useRef(KEYMAPS[0]);
  const keymapB = useRef(KEYMAPS[1]);
  const scoreRef = useRef([0, 0]);
  const wonRef = useRef(false);
  const startRef = useRef(0);

  // Stable callbacks so the orb bodies are registered once, not every render.
  const onOrbBody = useCallback((index, api) => {
    orbRefs.current[index] = api;
  }, []);

  useDuelCamera({ bodyA, bodyB, height: 25, distance: 17 });

  const active = !paused && !won && started;

  // A fresh mount happens on every host restart, so seeding here is enough.
  useEffect(() => {
    startRef.current = nowMs();
    services.audio.play({ freq: 420, duration: 0.12, type: 'triangle', gain: 0.18 });
  }, [services]);

  useEffect(() => {
    function onKey(e) {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (!wonRef.current) setPaused((p) => !p);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const collect = useCallback((orbIndex, who) => {
    if (wonRef.current) return;
    const body = orbRefs.current[orbIndex];
    const [nx, nz] = randomSpot();
    if (body) body.setTranslation({ x: nx, y: 0.9, z: nz }, true);
    setOrbs((current) => current.map((p, i) => (i === orbIndex ? [nx, nz] : p)));

    const next = scoreRef.current.slice();
    next[who] += 1;
    scoreRef.current = next;
    setScore(next);
    setFlash(who + 1);

    services.audio.play({
      freq: who === 0 ? 620 : 480,
      duration: 0.12,
      type: 'triangle',
      gain: 0.24,
    });

    if (next[who] >= TARGET_SCORE) {
      wonRef.current = true;
      setWon(who);
      const timeMs = Math.round(nowMs() - startRef.current);
      // A duel has no meaningful personal best; record wins instead.
      services.scores.submit(who === 0 ? 1 : 0, 'high');
      services.audio.play({ freq: 900, duration: 0.35, type: 'sawtooth', gain: 0.18 });
      reportResult({ winner: who === 0 ? 'Player 1' : 'Player 2', score: next, timeMs });
    }
  }, [services, reportResult]);

  // Overhead camera framing the whole arena lives in useDuelCamera above.

  return (
    <group>
      <Arena />

      {orbs.map((pos, i) => (
        <Orb
          key={i}
          index={i}
          position={pos}
          onBodyReady={onOrbBody}
          onCollect={collect}
          tint={i % 2 === 0 ? '#4ff3ff' : '#d9ff43'}
        />
      ))}

      <Duelist index={0} spawn={[-7, 1.3, 7]} color="#d9ff43" bodyRef={bodyA} keymapRef={keymapA} enabled={active} />
      <Duelist index={1} spawn={[7, 1.3, -7]} color="#4ff3ff" bodyRef={bodyB} keymapRef={keymapB} enabled={active} />

      <Html fullscreen zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="od-hud">
          <div className="od-scoreboard">
            <div className={`od-score od-score-p1${flash === 1 ? ' is-flash' : ''}`}>
              <span className="od-score-name">PLAYER 1</span>
              <span className="od-score-value">{score[0]}</span>
              <span className="od-score-keys">WASD · Space</span>
            </div>
            <span className="od-score-target">first to {TARGET_SCORE}</span>
            <div className={`od-score od-score-p2${flash === 2 ? ' is-flash' : ''}`}>
              <span className="od-score-name">PLAYER 2</span>
              <span className="od-score-value">{score[1]}</span>
              <span className="od-score-keys">Arrows · R-Shift</span>
            </div>
          </div>

          {!started && (
            <div className="od-overlay">
              <div className="od-panel">
                <h2 className="od-panel-title">Orb Duel</h2>
                <p className="od-panel-sub">Local 1v1 · grab the orbs · first to {TARGET_SCORE} wins</p>
                <div className="od-panel-keys">
                  <div><strong>Player 1</strong><span>W A S D to move · Space to jump</span></div>
                  <div><strong>Player 2</strong><span>Arrow keys to move · Right Shift to jump</span></div>
                </div>
                <button type="button" className="od-btn od-btn-primary" onClick={() => setStarted(true)}>Start duel</button>
              </div>
            </div>
          )}

          {paused && started && won < 0 && (
            <div className="od-overlay">
              <div className="od-panel">
                <h2 className="od-panel-title">Paused</h2>
                <div className="od-panel-actions">
                  <button type="button" className="od-btn od-btn-primary" onClick={() => setPaused(false)}>Resume</button>
                  <button type="button" className="od-btn" onClick={restart}>Restart</button>
                </div>
              </div>
            </div>
          )}

          {won >= 0 && (
            <div className="od-overlay">
              <div className="od-panel">
                <h2 className="od-panel-title">{won === 0 ? 'Player 1 wins' : 'Player 2 wins'}</h2>
                <p className="od-panel-stat"><strong>{score[0]}</strong> — <strong>{score[1]}</strong></p>
                <div className="od-panel-actions">
                  <button type="button" className="od-btn od-btn-primary" onClick={restart}>Rematch</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}