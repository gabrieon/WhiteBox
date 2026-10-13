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
  // Google's button is rendered once per mount, so we have to tell it when the
  // page theme flips — otherwise a white page keeps a black Google button.
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.dataset.theme || 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!slotRef.current || !configured) return undefined;
    if (status !== AuthStatus.SIGNED_OUT && status !== AuthStatus.ERROR) return undefined;

    let cancelled = false;
    renderGoogleButton(slotRef.current, { onProfile: onSignedIn, theme })
      .then((result) => {
        if (!cancelled && result?.error) setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [status, configured, onSignedIn, theme]);

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
      {/* Keyed on the theme: GIS sizes its iframe at creation, so a theme
            change needs a brand-new container rather than a re-render. */}
        <div className="wb-signin-slot" key={theme} ref={slotRef} />
      {failed && <span className="wb-signin-note">Sign-in failed — try again.</span>}
    </div>
  );
}
