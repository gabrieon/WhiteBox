import { useEffect, useRef, useState } from 'react';
import {
  signInWithProvider,
  signInWithEmail,
} from '../sdk/auth/supabaseClient.js';
import { useAuth, AuthStatus } from '../sdk/auth/authContext.js';
import { renderGoogleButton } from '../sdk/auth/authClient.js';

// Account control in the header. Two implementations:
//
//   Supabase — a capsule that opens a modal built from scratch here. Supabase
//              only brokers the identity; every pixel of the UI is ours, so
//              there is no third-party badge or watermark on any plan.
//   Google   — the original single-provider path, kept as the fallback so the
//              site still signs in if the Supabase keys are removed.

// Inline marks rather than remote images: they cost no extra requests and stay
// correct in both page themes.
function ProviderMark({ kind }) {
  if (kind === 'google') {
    return (
      <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.34A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.95H.96a9 9 0 0 0 0 8.1l2.99-2.34z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l2.99 2.34C4.66 5.16 6.65 3.58 9 3.58z" />
      </svg>
    );
  }
  if (kind === 'apple') {
    return (
      <svg width="15" height="18" viewBox="0 0 16 19" fill="currentColor" aria-hidden="true">
        <path d="M13.09 10.02c.03-2.72 2.22-4.02 2.32-4.09-1.27-1.85-3.24-2.1-3.94-2.13-1.68-.17-3.27.98-4.12.98-.85 0-2.16-.96-3.55-.93-1.83.03-3.51 1.06-4.4 2.69-1.87 3.24-.48 8.04 1.35 10.67.89 1.29 1.96 2.73 3.36 2.68 1.35-.05 1.86-.87 3.5-.87s2.1.87 3.52.84c1.45-.02 2.37-1.32 3.26-2.61 1.03-1.5 1.45-2.95 1.47-3.03-.03-.01-2.83-1.09-2.87-4.2zM10.34 2.02c.76-.92 1.27-2.2 1.13-3.47-1.09.04-2.42.73-3.2 1.65-.7.81-1.31 2.11-1.15 3.35 1.21.09 2.46-.61 3.22-1.53z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const PROVIDERS = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'apple', label: 'Continue with Apple' },
  { id: 'github', label: 'Continue with GitHub' },
];

function SupabaseAccount() {
  const { profile, isSignedIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  // Close on Escape, and restore focus/scroll when dismissed.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function handleProvider(id) {
    setError('');
    setBusy(id);
    try {
      // Navigates away, so there is no teardown to do on success.
      await signInWithProvider(id);
    } catch (err) {
      setError(err?.message || 'Sign in failed. Please try again.');
      setBusy('');
    }
  }

  async function handleEmail(e) {
    e.preventDefault();
    if (!email) return;
    setError('');
    setBusy('email');
    try {
      await signInWithEmail(email);
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Could not send the sign-in link.');
    } finally {
      setBusy('');
    }
  }

  if (isSignedIn) {
    return (
      <div className="wb-signin-row">
        {profile?.picture && (
          <img src={profile.picture} alt="" className="wb-avatar" />
        )}
        <span className="wb-signin-name">{profile?.name || 'Player'}</span>
        <button type="button" className="wb-signin-link" onClick={signOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="wb-signin-wrapper">
      <button
        type="button"
        className="wb-signin-btn"
        onClick={() => setOpen(true)}
      >
        Sign in
      </button>

      {open && (
        <div
          className="wb-modal-backdrop"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="wb-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in to WhiteBox"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wb-modal-header">
              <h3>Sign in to WhiteBox</h3>
              <button
                type="button"
                className="wb-modal-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {error && (
              <div className="wb-modal-error" role="alert">{error}</div>
            )}

            {sent ? (
              <div className="wb-modal-success">
                <p>
                  Check <strong>{email}</strong> — we sent you a sign-in link.
                  Open it on this device to finish.
                </p>
                <button
                  type="button"
                  className="wb-signin-btn"
                  onClick={() => { setSent(false); setEmail(''); }}
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                <div className="wb-provider-list">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="wb-provider-btn"
                      disabled={Boolean(busy)}
                      onClick={() => handleProvider(p.id)}
                    >
                      <ProviderMark kind={p.id} />
                      <span>{busy === p.id ? 'Opening…' : p.label}</span>
                    </button>
                  ))}
                </div>

                <div className="wb-modal-divider"><span>or use email</span></div>

                <form className="wb-email-form" onSubmit={handleEmail}>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                  <button
                    type="submit"
                    className="wb-signin-btn"
                    disabled={Boolean(busy)}
                  >
                    {busy === 'email' ? 'Sending…' : 'Email me a sign-in link'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
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

export default function SignIn({ mode }) {
  return mode === 'legacy' ? <GoogleAccount /> : <SupabaseAccount />;
}
