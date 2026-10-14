import { useEffect, useRef, useState } from 'react';
import { useAuth, AuthStatus } from '../sdk/auth/authContext.js';
import { renderGoogleButton } from '../sdk/auth/authClient.js';

// Minimal sign-in row for the library: Google's own button when signed out,
// name + sign out when signed in. Nothing else — the library stays a black
// screen with a title and game rows.
export default function SignIn() {
  const { status, profile, configured, onSignedIn, signOut } = useAuth();
  const [error, setError] = useState('');
  const slotRef = useRef(null);

  // Deliberately NOT re-rendered when the page theme changes. Google's
  // `outline` and `filled_black` buttons are not the same size — outline
  // carries a 1px border, filled_black doesn't — so swapping between them
  // shifts the logo by ~2px and changes the button height. Rendering once with
  // a single theme keeps the button pixel-identical in both page themes, and
  // avoids tearing the button down and rebuilding it on every toggle.
  useEffect(() => {
    if (!slotRef.current || !configured) return undefined;
    if (status !== AuthStatus.SIGNED_OUT && status !== AuthStatus.ERROR) return undefined;

    let cancelled = false;
    renderGoogleButton(slotRef.current, { onProfile: onSignedIn })
      .then((result) => {
        // The Worker's rejection reason (bad_audience, bad_signature,
        // token_expired, …) is the only useful thing to show here — a generic
        // "try again" makes this impossible to diagnose.
        if (!cancelled && result?.error) {
          console.error('[whitebox] sign-in failed:', result.error);
          setError(result.error);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[whitebox] sign-in failed:', err);
        setError(err?.message || 'unknown_error');
      });
    return () => { cancelled = true; };
  }, [status, configured, onSignedIn]);

  if (!configured) return null;

  if (status === AuthStatus.SIGNED_IN && profile) {
    return (
      <div className="wb-signin-row">
        <span className="wb-signin-name">{profile.name || 'Player'}</span>
        <button type="button" className="wb-signin-link" onClick={signOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="wb-signin-row">
      <div className="wb-signin-slot" ref={slotRef} />
      {error && (
        <span className="wb-signin-note" role="alert">
          Sign-in failed: <code>{error}</code>
        </span>
      )}
    </div>
  );
}