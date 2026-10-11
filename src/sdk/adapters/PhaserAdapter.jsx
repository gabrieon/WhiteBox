// Reusable Phaser 3 host adapter.
//
// Creates a Phaser.Game inside a container div, injects the SDK context into the
// game registry (so scenes read `this.game.registry.get('ctx')`), keeps it sized
// to the container, and fully destroys it on unmount/restart so no canvas or
// listener leaks. Scenes may be provided statically or via a dynamic loader.
//
// Lazy-loaded by GameHost, so Phaser stays out of the main bundle until a 2D game
// is opened.

import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';

function resolveScenes(mod) {
  if (!mod) return null;
  if (Array.isArray(mod)) return mod;
  if (Array.isArray(mod.scenes)) return mod.scenes;
  if (typeof mod.default === 'function') return [mod.default];
  if (Array.isArray(mod.default)) return mod.default;
  if (typeof mod.scene === 'function') return [mod.scene];
  return null;
}

export default function PhaserAdapter({ manifest, ctx }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const [scenes, setScenes] = useState(() => {
    if (Array.isArray(manifest.scenes)) return manifest.scenes;
    if (typeof manifest.scene === 'function') return [manifest.scene];
    return null;
  });
  const [loadError, setLoadError] = useState(null);

  // Resolve scenes from a dynamic loader when not provided statically.
  useEffect(() => {
    if (scenes || typeof manifest.loader !== 'function') return undefined;
    let alive = true;
    manifest.loader()
      .then((mod) => {
        if (!alive) return;
        const resolved = resolveScenes(mod);
        if (resolved) setScenes(resolved);
        else setLoadError(new Error('Phaser loader did not export a Scene'));
      })
      .catch((err) => { if (alive) setLoadError(err); });
    return () => { alive = false; };
  }, [manifest, scenes]);

  // Create / destroy the Phaser.Game when scenes become available.
  useEffect(() => {
    if (!scenes || !containerRef.current) return undefined;
    const cfg = manifest.config?.phaser || {};
    const el = containerRef.current;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: el,
      backgroundColor: cfg.backgroundColor || '#101322',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: el.clientWidth || 800,
        height: el.clientHeight || 480,
      },
      physics: cfg.physics || { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
      scene: scenes,
    });

    // Expose the SDK context to scenes via the global registry.
    game.registry.set('ctx', ctx);
    game.registry.set('manifest', manifest);
    gameRef.current = game;

    // Keep the canvas matched to the container size.
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w && h) game.scale.resize(w, h);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      // true => remove the canvas element from the DOM as well.
      game.destroy(true);
      gameRef.current = null;
    };
    // ctx/manifest are stable per host instance; recreate only if scenes change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes]);

  // Reflect host pause/resume onto the active scene.
  useEffect(() => {
    const game = gameRef.current;
    if (!game || !game.scene) return;
    const active = game.scene.getScenes(true);
    if (ctx.phase === 'paused') active.forEach((s) => game.scene.pause(s.scene.key));
    else if (ctx.phase === 'running') active.forEach((s) => game.scene.resume(s.scene.key));
  }, [ctx.phase]);

  useEffect(() => {
    if (loadError) ctx.reportError(loadError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadError]);

  return (
    <div className="wb-phaser-host">
      {!scenes && !loadError && (
        <div className="wb-host-overlay" role="status" aria-live="polite">
          <div className="wb-host-spinner" aria-hidden="true" />
          <div className="wb-host-title">Loading {manifest.title}…</div>
        </div>
      )}
      <div
        ref={containerRef}
        className="wb-phaser-canvas"
        style={{
          position: 'relative',
          width: '100%',
          height: 'min(70vh, 560px)',
          minHeight: '320px',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '2px solid var(--ink)',
        }}
      />
    </div>
  );
}
