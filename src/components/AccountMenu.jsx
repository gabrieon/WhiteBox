import { useEffect, useRef, useState } from 'react';
import { useAuth, AuthStatus } from '../sdk/auth/authContext.js';
import { renderGoogleButton } from '../sdk/auth/authClient.js';

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H1v2.34A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H1a9 9 0 0 0 0 8.12l2.97-2.34Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 1 4.94l2.97 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function initials(name, email) {
  const source = (name || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function AccountMenu() {
  const { status, profile, configured, error, onSignedIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [signInError, setSignInError] = useState(null);
  const buttonSlot = useRef(null);
  const rootRef = useRef(null);

  // Mount Google's own button whenever we are in a signed-out, configured state.
  useEffect(() => {
    if (!buttonSlot.current || !configured) return undefined;
    if (status !== AuthStatus.SIGNED_OUT) return undefined;

    let cancelled = false;
    renderGoogleButton(buttonSlot.current, {
      onProfile: onSignedIn,
    }).then((result) => {
      if (cancelled) return;
      if (result?.error) setSignInError(result.error);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [status, configured, onSignedIn]);

  // Close the popover on outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!configured) {
    return (
      <div className="wb-account" title="Google sign-in is not configured (VITE_GOOGLE_CLIENT_ID)">
        <GoogleIcon />
        <span className="wb-account-label">Guest</span>
      </div>
    );
  }

  if (status === AuthStatus.SIGNED_IN && profile) {
    return (
      <div className="wb-account-root" ref={rootRef}>
        <button
          type="button"
          className="wb-account-chip"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          {profile.picture ? (
            <img className="wb-account-avatar" src={profile.picture} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="wb-account-avatar is-initials" aria-hidden="true">
              {initials(profile.name, profile.email)}
            </span>
          )}
          <span className="wb-account-name">{profile.name || 'Player'}</span>
        </button>

        {open && (
          <div className="wb-account-menu" role="menu">
            <div className="wb-account-card">
              {profile.picture ? (
                <img className="wb-account-avatar is-large" src={profile.picture} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="wb-account-avatar is-large is-initials" aria-hidden="true">
                  {initials(profile.name, profile.email)}
                </span>
              )}
              <div className="wb-account-card-copy">
                <strong>{profile.name || 'Player'}</strong>
                <span>{profile.email}</span>
                {profile.emailVerified && (
                  <span className="wb-account-verified">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="m12 2 2.2 1.6 2.7-.2 1 2.5 2.3 1.4-.7 2.6.7 2.6-2.3 1.4-1 2.5-2.7-.2L12 22l-2.2-1.6-2.7.2-1-2.5L3.8 16.7l.7-2.6-.7-2.6L6.1 10.1l1-2.5 2.7.2L12 2Z" />
                    </svg>
                    Verified
                  </span>
                )}
              </div>
            </div>
            <button type="button" className="wb-account-action" role="menuitem" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  // Signed out, loading, or unavailable: show Google's button slot.
  return (
    <div className="wb-account-root">
      <div className="wb-signin" ref={buttonSlot} aria-busy={status === AuthStatus.LOADING} />
      {status === AuthStatus.ERROR && (
        <span className="wb-account-error" title={error || ''}>offline</span>
      )}
      {signInError && (
        <span className="wb-account-error" title={signInError}>sign-in failed</span>
      )}
    </div>
  );
}