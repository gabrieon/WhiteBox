// Overhead duel camera.
//
// A shared camera for two-player games. Pointer lock is impossible with a
// shared keyboard, so both players are viewed from above and "forward" means
// a fixed world direction. The camera eases toward the midpoint between the
// two duelists so a chase stays framed without swinging wildly.
//
// Lives in its own module for the same reason as usePlayerController: the
// camera object is mutated inside useFrame, which belongs here rather than in
// a game component's render scope.

import { useFrame, useThree } from '@react-three/fiber';

const LOOK_TARGET = { x: 0, y: 0, z: 0 };

export function useDuelCamera({ bodyA, bodyB, height = 25, distance = 17, follow = 0.35 }) {
  const { camera } = useThree();

  useFrame(() => {
    const ta = bodyA?.current?.translation();
    const tb = bodyB?.current?.translation();

    const mx = ta && tb ? (ta.x + tb.x) / 2 : 0;
    const mz = ta && tb ? (ta.z + tb.z) / 2 : 0;

    camera.position.set(mx * follow, height, mz * follow + distance);
    LOOK_TARGET.x = mx * follow;
    LOOK_TARGET.y = 0;
    LOOK_TARGET.z = mz * follow;
    camera.lookAt(LOOK_TARGET.x, LOOK_TARGET.y, LOOK_TARGET.z);
  });

  return camera;
}