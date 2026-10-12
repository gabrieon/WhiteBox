// WhiteBox Game SDK — runtime host.
//
// Mounts a game by engine, provides the service context, owns the lifecycle
// phase, and guarantees cleanup. Heavy engines (r3f, phaser) are lazy-loaded so
// their libraries stay out of the main bundle until a game needs them.
//
// Restart works by bumping `runId`, used as the React `key` on the game element —
// a full remount that cannot leak prior state or listeners. Services (audio/input)
// persist across restarts and are disposed only on host unmount.

import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './GameHost.css';
import { GamePhase } from './lifecycle.js';
import { createServices } from './services.js';
import { GameContext } from './gameContext.js';

// Lazy engine adapters — each statically imports its heavy library, so the
// dynamic import here creates a separate chunk loaded only when needed.
const ThreeAdapter = lazy(() => import('./adapters/ThreeAdapter.jsx'));
const PhaserAdapter = lazy(() => import('./adapters/PhaserAdapter.jsx'));

class GameErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.props.onCatch?.(error, info);
  }

  reset() {
    this.setState({ error: null });
    this.props.onReset?.();
  }

  render() {
    if (this.state.error) {
      return this.props.renderError(this.state.error, this.reset);
    }
    return this.props.children;
  }
}

function LoadingOverlay({ label = 'Loading game…' }) {
  return (
    <div className="wb-host-overlay" role="status" aria-live="polite">
      <div className="wb-host-orb" aria-hidden="true" />
      <p className="wb-host-kicker">LOADING ROOM</p>
      <div className="wb-host-title">{label}</div>
      <div className="wb-host-loadbar" aria-hidden="true"><i /></div>
    </div>
  );
}

function ErrorOverlay({ error, onRetry }) {
  return (
    <div className="wb-host-overlay is-error" role="alert">
      <p className="wb-host-kicker">ROOM OFFLINE</p>
      <div className="wb-host-title">Something broke</div>
      <div className="wb-host-msg">{error?.message || String(error)}</div>
      <button type="button" className="wb-host-btn" onClick={onRetry}>Try again</button>
    </div>
  );
}

export default function GameHost({ manifest, onExit }) {
  // Services are recreated only when the manifest identity changes.
  const services = useMemo(() => createServices(manifest), [manifest]);
  const [phase, setPhase] = useState(GamePhase.RUNNING);
  const [result, setResult] = useState(null);
  const [runId, setRunId] = useState(0);
  const boundaryRef = useRef(null);

  // Dispose all services when the host unmounts (leaving the game).
  useEffect(() => () => services.dispose(), [services]);

  const restart = useCallback(() => {
    setResult(null);
    setPhase(GamePhase.RUNNING);
    boundaryRef.current?.reset();
    setRunId((n) => n + 1);
  }, []);

  const reportResult = useCallback((r) => {
    setResult(r);
    setPhase(GamePhase.OVER);
  }, []);

  const reportError = useCallback((err) => {
    services.log.error(err);
    setPhase(GamePhase.ERROR);
  }, [services]);

  const ctx = useMemo(() => ({
    manifest,
    services,
    phase,
    runId,
    result,
    setPhase,
    restart,
    reportResult,
    reportError,
    onExit,
  }), [manifest, services, phase, runId, result, restart, reportResult, reportError, onExit]);

  // Resolve the React entry for react/r3f engines (static component or lazy loader).
  const Game = useMemo(() => {
    if (manifest.engine === 'phaser') return null;
    if (typeof manifest.component === 'function') return manifest.component;
    if (typeof manifest.loader === 'function') return lazy(manifest.loader);
    return null;
  }, [manifest]);

  function renderEngine() {
    switch (manifest.engine) {
      case 'r3f':
        return <ThreeAdapter key={runId} manifest={manifest} ctx={ctx} Game={Game} />;
      case 'phaser':
        return <PhaserAdapter key={runId} manifest={manifest} ctx={ctx} />;
      default: {
        if (!Game) {
          return <ErrorOverlay error={{ message: 'This game has no runnable entry point.' }} onRetry={restart} />;
        }
        return <Game key={runId} ctx={ctx} />;
      }
    }
  }

  return (
    <GameContext.Provider value={ctx}>
      <div className="wb-host" data-phase={phase} data-engine={manifest.engine}>
        <GameErrorBoundary
          ref={boundaryRef}
          onCatch={(err) => services.log.error('render error', err)}
          onReset={() => setPhase(GamePhase.RUNNING)}
          renderError={(err, reset) => <ErrorOverlay error={err} onRetry={reset} />}
        >
          <Suspense fallback={<LoadingOverlay label={`Loading ${manifest.title}…`} />}>
            {renderEngine()}
          </Suspense>
        </GameErrorBoundary>
      </div>
    </GameContext.Provider>
  );
}
