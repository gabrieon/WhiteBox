// Reusable 3D player controller (React Three Fiber + Rapier).
//
// Camera-relative WASD/arrow movement, space to jump, optional pointer-lock
// mouse-look, and a smooth third-person follow camera. Ground detection uses the
// physics collision events (stable for a rotation-locked body) so jumping only
// fires when actually on the ground.
//
// The RigidBody lives in the game's scene; this hook returns the ref plus the
// collision handlers to wire onto it.

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const DESIRED = new THREE.Vector3();
const CAM_TARGET = new THREE.Vector3();
const CAM_POS = new THREE.Vector3();

export function usePlayerController({
  bodyRef,
  speed = 7,
  jumpSpeed = 8,
  camDistance = 9,
  camHeight = 5.5,
  pointerLock = true,
  enabled = true,
} = {}) {
  const { camera, gl } = useThree();
  const keys = useRef(Object.create(null));
  const yaw = useRef(0);
  const grounded = useRef(true);
  const jumpLatch = useRef(false);

  // Keyboard state.
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

  // Pointer-lock mouse look.
  useEffect(() => {
    if (!pointerLock) return undefined;
    const canvas = gl.domElement;
    const requestLock = () => { if (enabled) canvas.requestPointerLock?.(); };
    const onMove = (e) => {
      if (document.pointerLockElement === canvas) {
        yaw.current -= e.movementX * 0.0025;
      }
    };
    canvas.addEventListener('click', requestLock);
    document.addEventListener('mousemove', onMove);
    return () => {
      canvas.removeEventListener('click', requestLock);
      document.removeEventListener('mousemove', onMove);
    };
  }, [gl, pointerLock, enabled]);

  // Ground detection via collision events with anything tagged userData.ground.
  function isGround(obj) {
    return Boolean(obj && obj.userData && obj.userData.ground);
  }
  const onGroundEnter = ({ other }) => { if (isGround(other?.rigidBodyObject)) grounded.current = true; };
  const onGroundExit = ({ other }) => { if (isGround(other?.rigidBodyObject)) grounded.current = false; };

  useFrame((_, delta) => {
    const body = bodyRef?.current;
    if (!body || !enabled) return;
    const dt = Math.min(delta, 0.05);
    const k = keys.current;

    const w = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const d = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);

    // Camera basis on the XZ plane for the current yaw.
    const sin = Math.sin(yaw.current);
    const cos = Math.cos(yaw.current);
    FORWARD.set(-sin, 0, -cos);
    RIGHT.set(cos, 0, -sin);

    DESIRED.set(0, 0, 0)
      .addScaledVector(FORWARD, w)
      .addScaledVector(RIGHT, d);
    if (DESIRED.lengthSq() > 0) DESIRED.normalize();

    const t = body.translation();
    const vel = body.linvel();
    body.setLinvel({ x: DESIRED.x * speed, y: vel.y, z: DESIRED.z * speed }, true);

    // Jump on the rising edge of Space while grounded.
    const wantJump = Boolean(k.Space);
    if (wantJump && !jumpLatch.current && grounded.current) {
      body.setLinvel({ x: vel.x, y: jumpSpeed, z: vel.z }, true);
      grounded.current = false;
    }
    jumpLatch.current = wantJump;

    // Smooth third-person follow camera.
    CAM_POS.set(t.x - FORWARD.x * camDistance, t.y + camHeight, t.z - FORWARD.z * camDistance);
    const alpha = 1 - Math.pow(0.0001, dt);
    camera.position.lerp(CAM_POS, alpha);
    CAM_TARGET.set(t.x, t.y + 1, t.z);
    camera.lookAt(CAM_TARGET);
  });

  return { grounded, yaw, onGroundEnter, onGroundExit };
}
