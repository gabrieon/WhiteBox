// Reusable React Three Fiber host adapter.
//
// Provides the canvas, camera, lighting, physics world, responsive sizing and a
// Suspense boundary for in-scene asset loading, then renders the game's scene
// component inside. Games supply their own world, entities and HUD; this host
// supplies the shared 3D scaffolding so a new 3D game is mostly scene content.
//
// This module is lazy-loaded by GameHost, so three / fiber / drei / rapier stay
// out of the main bundle until an r3f game is opened.

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Stars } from '@react-three/drei';

export default function ThreeAdapter({ manifest, ctx, Game }) {
  const cfg = manifest.config?.three || {};
  const camera = cfg.camera || { position: [0, 6, 11], fov: 55 };
  const gravity = cfg.gravity || [0, -22, 0];
  const background = cfg.background || '#0b0e1a';

  return (
    <div
      className="wb-three-host"
      style={{
        position: 'relative',
        width: '100%',
        height: 'min(72vh, 620px)',
        minHeight: '340px',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '2px solid var(--ink)',
        background,
      }}
    >
      <Canvas
        shadows={cfg.shadows !== false}
        dpr={[1, 2]}
        camera={camera}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => { gl.setClearColor(background); }}
      >
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#bcd3ff', '#20242f', 0.7]} />
        <directionalLight
          position={[8, 14, 6]}
          intensity={1.15}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <Stars radius={70} depth={40} count={1800} factor={3} fade speed={0.6} />

        <Physics gravity={gravity} timeStep="vary">
          <Suspense fallback={null}>
            <Game ctx={ctx} />
          </Suspense>
        </Physics>
      </Canvas>
    </div>
  );
}
