import { useEffect, useRef, useState } from 'react';
import { useAuth, AuthStatus } from '../sdk/auth/authContext.js';
import { renderGoogleButton } from '../sdk/auth/authClient.js';

// Minimal sign-in row for the library: Google's own button when signed out,
// name + sign out when signed in. Nothing else — the library stays a black
// screen with a title and game rows.
export default function SignIn() {
  const { status, profile, configured, onSignedIn, signOut } = useAuth();
  const [failed, setFailed] = useState(false);
  const slotRef = useRef(null);

  useEffect(() => {
    if (!slotRef.current || !configured) return undefined;
    if (status !== AuthStatus.SIGNED_OUT && status !== AuthStatus.ERROR) return undefined;

    let cancelled = false;
    renderGoogleButton(slotRef.current, { onProfile: onSignedIn })
      .then((result) => {
        if (!cancelled && result?.error) setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
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
      {failed && <span className="wb-signin-note">Sign-in failed — try again.</span>}
    </div>
  );
}
