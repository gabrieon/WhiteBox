import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';
import {
  getSession,
  signOut as apiSignOut,
  isConfigured,
} from './authClient.js';
import { setClerkToken } from './clerkToken.js';
import { AuthContext, AuthStatus } from './authContext.js';

// Session state is shared across the app: the header shows the account menu,
// games can show the player's name, and nothing should fetch the session twice.
//
// Two implementations behind one context. Clerk owns the session when a
// publishable key is configured; otherwise the original Google + cookie flow
// runs unchanged. Separate components rather than a conditional hook, because
// useAuth() throws when there is no ClerkProvider above it.

function clerkProfile(user) {
  if (!user) return null;
  const emailAddress = user.primaryEmailAddress?.emailAddress
    || user.emailAddresses?.[0]?.emailAddress
    || null;
  return {
    id: user.id,
    name: user.fullName || user.username || null,
    email: emailAddress,
    emailVerified: Boolean(user.emailAddresses?.[0]?.verification?.status === 'verified'),
    picture: user.imageUrl || null,
    createdAt: user.createdAt ? new Date(user.createdAt).getTime() : null,
  };
}

function ClerkAuthProvider({ children }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  // Keep a current token available to apiFetch. Refreshed well inside Clerk's
  // expiry so a long play session never sends a token that lapses mid-request.
  useEffect(() => {
    if (!isLoaded) return undefined;

    if (!isSignedIn) {
      setClerkToken(null);
      return undefined;
    }

    let alive = true;
    let timer = null;

    async function publish() {
      try {
        const token = await getToken();
        if (!alive) return;
        setClerkToken(token);
      } catch {
        if (!alive) return;
        setClerkToken(null);
      }
      if (alive) timer = setTimeout(publish, 60_000);
    }

    publish();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      setClerkToken(null);
    };
  }, [isLoaded, isSignedIn, getToken]);

  const signOut = useCallback(async () => {
    try {
      await clerkSignOut();
    } finally {
      setClerkToken(null);
    }
  }, [clerkSignOut]);

  const value = useMemo(() => {
    let status = AuthStatus.SIGNED_OUT;
    if (!isLoaded) status = AuthStatus.LOADING;
    else if (isSignedIn) status = AuthStatus.SIGNED_IN;

    return {
      status,
      profile: status === AuthStatus.SIGNED_IN ? clerkProfile(user) : null,
      error: null,
      configured: true,
      isSignedIn: status === AuthStatus.SIGNED_IN,
      // Clerk signs in through its own modal; nothing to hand back here.
      onSignedIn: () => {},
      signOut,
    };
  }, [isLoaded, isSignedIn, user, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function LegacyAuthProvider({ children }) {
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

export function AuthProvider({ mode = 'legacy', children }) {
  if (mode === 'clerk') {
    return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
  }
  return <LegacyAuthProvider>{children}</LegacyAuthProvider>;
}