import { useEffect, useRef, useState } from 'react';
import { SignInButton, UserButton } from '@clerk/clerk-react';
import { useAuth, AuthStatus } from '../sdk/auth/authContext.js';
import { renderGoogleButton } from '../sdk/auth/authClient.js';

// Account control in the header. Two implementations:
//
//   Clerk  — one flat capsule that opens Clerk's modal, which lists every
//            provider you enabled (Google, Apple, GitHub, email link, ...).
//            Clerk renders the buttons, so they are brand-compliant and don't
//            bring Google's iframe background problem with them.
//   Google — the original single-provider path, kept as the fallback so the
//            site still signs in if the Clerk key is removed.

function ClerkAccount() {
  const { profile, isSignedIn } = useAuth();

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button type="button" className="wb-signin-btn">Sign in</button>
      </SignInButton>
    );
  }

  return (
    <div className="wb-signin-row">
      <UserButton
        appearance={{
          elements: {
            avatarBox: 'wb-clerk-avatar',
          },
        }}
      />
      <span className="wb-signin-name">{profile?.name || 'Player'}</span>
    </div>
  );
}

function GoogleAccount() {
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

export default function SignIn({ mode = 'legacy' }) {
  return mode === 'clerk' ? <ClerkAccount /> : <GoogleAccount />;
}