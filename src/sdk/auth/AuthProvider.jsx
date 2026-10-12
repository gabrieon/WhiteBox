import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getSession,
  signOut as apiSignOut,
  isConfigured,
} from './authClient.js';
import { AuthContext, AuthStatus } from './authContext.js';

// Session state is shared across the app: the header shows the account menu,
// games can show the player's name, and nothing should fetch the session twice.

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(
    isConfigured() ? AuthStatus.LOADING : AuthStatus.UNAVAILABLE,
  );
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Without a client id there is nothing to sign in with; skip the request.
    if (!isConfigured()) return undefined;

    let alive = true;
    (async () => {
      try {
        const data = await getSession();
        if (!alive) return;
        if (data?.profile) {
          setProfile(data.profile);
          setStatus(AuthStatus.SIGNED_IN);
        } else {
          setStatus(AuthStatus.SIGNED_OUT);
        }
      } catch (err) {
        // A missing Worker is the common local case: degrade to guest play
        // instead of surfacing an error on every page load.
        if (!alive) return;
        setError(err.message);
        setStatus(AuthStatus.ERROR);
      }
    })();

    return () => { alive = false; };
  }, []);

  const onSignedIn = useCallback((nextProfile) => {
    setProfile(nextProfile);
    setError(null);
    setStatus(AuthStatus.SIGNED_IN);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiSignOut();
    } catch {
      // Even if the call fails, drop local state so the UI cannot get stuck
      // showing a signed-in shell.
    }
    setProfile(null);
    setStatus(AuthStatus.SIGNED_OUT);
  }, []);

  const value = useMemo(() => ({
    status,
    profile,
    error,
    configured: isConfigured(),
    isSignedIn: status === AuthStatus.SIGNED_IN,
    onSignedIn,
    signOut,
  }), [status, profile, error, onSignedIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}