// Orb Arena — a complete, playable 3D demonstration game (single-player).
// Rendered INSIDE the host Canvas, so everything here is React Three Fiber.
// The HUD is DOM via drei <Html>, styled by OrbArena.css with its own neon
// identity (deliberately NOT the Sticker Bomb platform theme).
//
// Goal: roll/jump around a bounded arena and collect every glowing orb as fast
// as possible. Physics, collisions and boundaries are real (Rapier).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CapsuleCollider, BallCollider } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGame } from '../../sdk/gameContext.js';
import { usePlayerController } from '../../sdk/three/usePlayerController.js';
import { ORB_SPOTS } from '../../../shared/mp-protocol.js';
import './OrbArena.css';

const ARENA_HALF = 15;

// Module-scope clock accessor. Keeping the impure `performance.now()` call out
// of component render scope satisfies React's purity rules; game callbacks read
// the time through this instead.
const nowMs = () => performance.now();

function Orb({ position, onCollect, collected }) {
  const matRef = useRef();
  const lightRef = useRef();
  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const pulse = 1.1 + Math.sin(clock.elapsedTime * 3 + position[0]) * 0.5;
    matRef.current.emissiveIntensity = collected ? 0 : pulse;
    if (lightRef.current) lightRef.current.intensity = collected ? 0 : pulse * 1.6;
  });

  if (collected) return null;

  return (
    <RigidBody
      type="fixed"
      sensor
      colliders={false}
      position={[position[0], 0.9, position[1]]}
      onIntersectionEnter={({ other }) => {
        if (other?.rigidBodyObject?.userData?.player) onCollect();
      }}
    >
      <BallCollider args={[0.55]} sensor />
      <mesh castShadow>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshStandardMaterial
          ref={matRef}
          color="#0a2a3a"
          emissive="#4ff3ff"
          emissiveIntensity={1.4}
          roughness={0.25}
          metalness={0.1}
        />
      </mesh>
      <pointLight ref={lightRef} color="#4ff3ff" intensity={2} distance={5} decay={2} />
    </RigidBody>
  );
}

function Arena() {
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1b2a55', emissive: '#2447b8', emissiveIntensity: 0.5, transparent: true, opacity: 0.55, roughness: 0.6,
  }), []);

  return (
    <group>
      {/* Floor */}
      <RigidBody type="fixed" colliders={false} userData={{ ground: true }}>
        <CuboidCollider args={[ARENA_HALF, 0.5, ARENA_HALF]} position={[0, -0.5, 0]} />
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[ARENA_HALF * 2, 1, ARENA_HALF * 2]} />
          <meshStandardMaterial color="#0d1226" roughness={0.95} metalness={0.05} />
        </mesh>
      </RigidBody>
      <gridHelper args={[ARENA_HALF * 2, 30, '#3355aa', '#1c2748']} position={[0, 0.02, 0]} />

      {/* Boundary walls */}
      {[
        { pos: [ARENA_HALF, 1.5, 0], args: [0.5, 1.5, ARENA_HALF] },
        { pos: [-ARENA_HALF, 1.5, 0], args: [0.5, 1.5, ARENA_HALF] },
        { pos: [0, 1.5, ARENA_HALF], args: [ARENA_HALF, 1.5, 0.5] },
        { pos: [0, 1.5, -ARENA_HALF], args: [ARENA_HALF, 1.5, 0.5] },
      ].map((wall, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={wall.pos}>
          <CuboidCollider args={wall.args} />
          <mesh material={wallMat}>
            <boxGeometry args={[wall.args[0] * 2, wall.args[1] * 2, wall.args[2] * 2]} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

function readArenaProgress(loadProgress) {
  try {
    const data = loadProgress();
    if (!data || typeof data !== 'object') return null;
    const collected = Array.isArray(data.collected)
      ? data.collected.filter((i) => Number.isInteger(i) && i >= 0 && i < ORB_SPOTS.length)
      : [];
    const elapsed = Number.isFinite(data.elapsed) && data.elapsed >= 0 ? data.elapsed : 0;
    return { collected, elapsed };
  } catch {
    return null;
  }
}

export default function OrbArena() {
  const { services, restart, reportResult, saveProgress, loadProgress, clearProgress } = useGame();
  const bodyRef = useRef();
  const noseRef = useRef();
  const [initial] = useState(() => readArenaProgress(loadProgress) || { collected: [], elapsed: 0 });
  const [collected, setCollected] = useState(() => new Set(initial.collected));
  const [elapsed, setElapsed] = useState(initial.elapsed);
  const [won, setWon] = useState(false);
  const [paused, setPaused] = useState(false);
  const startRef = useRef(0);
  const tickRef = useRef(0);

  const total = ORB_SPOTS.length;
  const best = services.scores.getBest();
  // Ref is the synchronous source of truth for which orbs are collected; the
  // `collected` state mirrors it for rendering. A ref avoids stale-closure bugs
  // if several orbs are collected within the same frame.
  const collectedRef = useRef(new Set(initial.collected));

  const { yaw, onGroundEnter, onGroundExit } = usePlayerController({
    bodyRef,
    speed: 8,
    jumpSpeed: 8.5,
    enabled: !paused && !won,
    pointerLock: true,
  });

  // Start the clock on mount, continuing from a resumed run. The host remounts
  // this component on every restart (key = runId), so a fresh mount with no
  // saved progress always means a fresh run.
  useEffect(() => { startRef.current = nowMs() - initial.elapsed * 1000; }, [initial.elapsed]);

  // Called from a physics intersection event (not during render), so state
  // updates and side effects here are safe and fire exactly once per orb.
  function collect(index) {
    if (won || paused || collectedRef.current.has(index)) return;
    collectedRef.current.add(index);
    const size = collectedRef.current.size;
    setCollected(new Set(collectedRef.current));
    services.audio.play({ freq: 520 + size * 40, duration: 0.12, type: 'triangle', gain: 0.25 });
    // Persist every pickup so leaving mid-run resumes with these orbs gone.
    saveProgress({
      collected: [...collectedRef.current],
      elapsed: (nowMs() - startRef.current) / 1000,
    });
    if (size === total) {
      const timeMs = Math.round(nowMs() - startRef.current);
      services.scores.submit(timeMs, 'low');
      services.audio.play({ freq: 880, duration: 0.4, type: 'sawtooth', gain: 0.2 });
      setWon(true);
      clearProgress();
      if (typeof document !== 'undefined' && document.exitPointerLock) document.exitPointerLock();
      reportResult({ win: true, timeMs, orbs: total });
    }
  }

  useFrame(() => {
    if (noseRef.current) noseRef.current.rotation.y = yaw.current;
    if (won || paused) return;
    if (!startRef.current) startRef.current = nowMs();
    const t = (nowMs() - startRef.current) / 1000;
    const tick = Math.floor(t * 10);
    if (tick !== tickRef.current) {
      tickRef.current = tick;
      setElapsed(t);
    }
  });

  function togglePause() {
    if (!paused && typeof document !== 'undefined' && document.exitPointerLock) document.exitPointerLock();
    // Resuming: shift the start so elapsed continues from where it paused.
    if (paused) startRef.current = nowMs() - elapsed * 1000;
    setPaused((p) => !p);
  }

  return (
    <group>
      <Arena />

      {ORB_SPOTS.map((pos, i) => (
        <Orb key={i} position={pos} collected={collected.has(i)} onCollect={() => collect(i)} />
      ))}

      {/* Player */}
      <RigidBody
        ref={bodyRef}
        colliders={false}
        lockRotations
        position={[0, 1.2, 0]}
        userData={{ player: true }}
        onCollisionEnter={onGroundEnter}
        onCollisionExit={onGroundExit}
      >
        <CapsuleCollider args={[0.4, 0.4]} />
        <mesh castShadow>
          <capsuleGeometry args={[0.4, 0.8, 6, 12]} />
          <meshStandardMaterial color="#d9ff43" roughness={0.4} metalness={0.15} emissive="#3a4a00" emissiveIntensity={0.4} />
        </mesh>
        {/* nose shows facing */}
        <group ref={noseRef}>
          <mesh position={[0, 0.15, -0.5]}>
            <coneGeometry args={[0.16, 0.4, 12]} />
            <meshStandardMaterial color="#171717" />
          </mesh>
        </group>
      </RigidBody>

      {/* HUD (DOM overlay). Orb Arena's own neon identity. */}
      <Html fullscreen zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="oa-hud">
          <div className="oa-hud-top">
            <div className="oa-chip">
              <span className="oa-chip-label">ORBS</span>
              <span className="oa-chip-value">{collected.size}<em>/{total}</em></span>
            </div>
            <div className="oa-chip">
              <span className="oa-chip-label">TIME</span>
              <span className="oa-chip-value">{elapsed.toFixed(1)}<em>s</em></span>
            </div>
            {best !== null && (
              <div className="oa-chip">
                <span className="oa-chip-label">BEST</span>
                <span className="oa-chip-value">{(best / 1000).toFixed(1)}<em>s</em></span>
              </div>
            )}
            <button type="button" className="oa-btn" onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
          </div>

          <div className="oa-hud-hint">WASD / arrows to move · Space to jump · Click to look · Collect every orb</div>

          {(paused || won) && (
            <div className="oa-overlay">
              <div className="oa-panel">
                <h2 className="oa-panel-title">{won ? 'Arena Cleared' : 'Paused'}</h2>
                {won && <p className="oa-panel-stat">All {total} orbs in <strong>{elapsed.toFixed(1)}s</strong></p>}
                {won && best !== null && <p className="oa-panel-sub">Best: {(best / 1000).toFixed(1)}s</p>}
                <div className="oa-panel-actions">
                  <button type="button" className="oa-btn oa-btn-primary" onClick={() => { clearProgress(); restart(); }}>Restart</button>
                  {paused && !won && <button type="button" className="oa-btn" onClick={togglePause}>Resume</button>}
                </div>
              </div>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
