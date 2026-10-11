// TEMPLATE — minimal 3D game (React Three Fiber + Rapier).
//
// Copy this whole folder to src/games/<your-game>/, rename the files, tweak the
// manifest, then register it in src/games/registry.js (ONE import + ONE array
// entry). See GAME_AUTHORING.md for the full workflow and the validation checklist.
//
// What this demonstrates:
//   * the reusable player controller + real Rapier physics/collisions
//   * a collectible driven by a sensor intersection event
//   * SDK services (audio, scores) via useGame()
//   * a DOM HUD (drei <Html>), restart, and result reporting
// It is intentionally small — extend or strip it as you like. This folder is NOT
// imported by the registry, so it never appears in the live library or the build.

import { useRef, useState } from 'react';
import { RigidBody, CuboidCollider, CapsuleCollider, BallCollider } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import { useGame } from '../../../sdk/gameContext.js';
import { usePlayerController } from '../../../sdk/three/usePlayerController.js';

// Deterministic orb order (no randomness needed for a starter).
const SPOTS = [[4, -3], [-5, 2], [6, 5], [-3, -6], [0, 7]];

function Orb({ position, onCollect }) {
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
      <BallCollider args={[0.6]} sensor />
      <mesh>
        <sphereGeometry args={[0.45, 20, 20]} />
        <meshStandardMaterial color="#0a2a3a" emissive="#4ff3ff" emissiveIntensity={1.3} />
      </mesh>
    </RigidBody>
  );
}

export default function TemplateGame3D() {
  const { services, restart, reportResult } = useGame();
  const bodyRef = useRef();
  const scoreRef = useRef(0);           // synchronous source of truth (no stale closures)
  const [score, setScore] = useState(0); // render mirror
  const done = score >= SPOTS.length;

  const { onGroundEnter, onGroundExit } = usePlayerController({
    bodyRef,
    speed: 7,
    jumpSpeed: 8,
    pointerLock: false, // fixed follow camera; set true for mouse-look
    enabled: !done,
  });

  // Called from a physics event (not during render), so side effects are safe.
  function collect() {
    if (done) return;
    scoreRef.current += 1;
    const next = scoreRef.current;
    setScore(next);
    services.audio.play({ freq: 520 + next * 40, duration: 0.1, type: 'triangle', gain: 0.25 });
    services.scores.submit(next, 'high');
    if (next >= SPOTS.length) reportResult({ win: true, score: next });
  }

  return (
    <group>
      {/* Ground — tagged userData.ground so the controller's jump knows the floor. */}
      <RigidBody type="fixed" colliders={false} userData={{ ground: true }}>
        <CuboidCollider args={[12, 0.5, 12]} position={[0, -0.5, 0]} />
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[24, 1, 24]} />
          <meshStandardMaterial color="#14203d" roughness={0.95} />
        </mesh>
      </RigidBody>

      {/* Current collectible; key=score remounts it at the next spot. */}
      {!done && <Orb key={score} position={SPOTS[score]} onCollect={collect} />}

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
          <meshStandardMaterial color="#d9ff43" roughness={0.4} />
        </mesh>
      </RigidBody>

      {/* HUD (this game's own look; inline styles keep the template self-contained). */}
      <Html fullscreen zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ position: 'fixed', inset: 0, fontFamily: 'system-ui, sans-serif', color: '#eaf1ff' }}>
          <div style={{ position: 'absolute', top: 14, left: 14, padding: '8px 14px', borderRadius: 12, background: 'rgba(9,14,32,.82)', border: '1px solid rgba(120,170,255,.28)', fontSize: 14 }}>
            ORBS <strong>{score}</strong>/{SPOTS.length}
          </div>
          <button
            type="button"
            onClick={restart}
            style={{ position: 'absolute', top: 14, right: 14, pointerEvents: 'auto', padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(120,170,255,.35)', background: 'rgba(30,46,92,.7)', color: '#eaf1ff', cursor: 'pointer' }}
          >
            Restart
          </button>
          {done && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', padding: '18px 24px', borderRadius: 14, background: 'rgba(9,14,32,.92)', border: '1px solid rgba(79,243,255,.5)', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>All orbs collected!</div>
              <button type="button" onClick={restart} style={{ pointerEvents: 'auto', padding: '10px 16px', borderRadius: 10, border: 'none', background: '#35e0ff', color: '#04121a', fontWeight: 700, cursor: 'pointer' }}>
                Play again
              </button>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', fontSize: 12, color: '#8fa2cc' }}>
            WASD / arrows to move · Space to jump · collect every orb
          </div>
        </div>
      </Html>
    </group>
  );
}
