import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  supabase,
  supabaseEnabled,
  setSupabaseToken,
  signOutSupabase,
} from './supabaseClient.js';
import {
  getSession,
  signOut as apiSignOut,
  isConfigured,
} from './authClient.js';
import { AuthContext, AuthStatus } from './authContext.js';

// Session state is shared across the app: the header shows the account menu,
// games can show the player's name, and nothing should fetch the session twice.
//
// Two implementations behind one context. Supabase owns the session when its
// keys are configured; otherwise the original Google + HttpOnly-cookie flow runs
// unchanged. Separate components rather than a conditional hook, so neither
// backend's internals leak into the other's call path.

function supabaseProfile(user) {
  if (!user) return null;
  // Supabase keeps provider-specific fields in user_metadata; the shape differs
  // per provider (Google gives full_name/picture, GitHub gives user_name/avatar_url).
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    name: meta.full_name || meta.name || meta.user_name || (user.email || '').split('@')[0] || null,
    email: user.email || null,
    // Supabase only sets this once the address is confirmed, which for an OAuth
    // sign-in is effectively immediate.
    emailVerified: Boolean(user.email_confirmed_at),
    picture: meta.picture || meta.avatar_url || null,
    createdAt: user.created_at ? new Date(user.created_at).getTime() : null,
  };
}

function SupabaseAuthProvider({ children }) {
  const [status, setStatus] = useState(AuthStatus.LOADING);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    function apply(session) {
      if (!alive) return;
      if (session?.access_token) {
        // Publish before flipping status so the first progress fetch after a
        // sign-in already carries the token.
        setSupabaseToken(session.access_token);
        setProfile(supabaseProfile(session.user));
        setStatus(AuthStatus.SIGNED_IN);
      } else {
        setSupabaseToken(null);
        setProfile(null);
        setStatus(AuthStatus.SIGNED_OUT);
      }
    }

    // getSession() rehydrates after a reload; onAuthStateChange covers sign-in,
    // token refresh, and sign-out from any tab.
    supabase.auth.getSession().then(({ data, error: err }) => {
      if (!alive) return;
      if (err) {
        setError(err.message);
        setStatus(AuthStatus.ERROR);
        return;
      }
      apply(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
      setSupabaseToken(null);
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutSupabase();
    } catch {
      // Sign-out should never leave the UI stuck on a signed-in shell; the
      // onAuthStateChange listener above clears state regardless.
    }
    setSupabaseToken(null);
    setProfile(null);
    setStatus(AuthStatus.SIGNED_OUT);
  }, []);

  const value = useMemo(() => ({
    status,
    profile,
    error,
    configured: true,
    isSignedIn: status === AuthStatus.SIGNED_IN,
    // Supabase drives its own redirect/modal; nothing to hand back here.
    onSignedIn: () => {},
    signOut,
  }), [status, profile, error, signOut]);

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

export function AuthProvider({ mode, children }) {
  const resolved = mode || (supabaseEnabled() ? 'supabase' : 'legacy');
  return resolved === 'supabase'
    ? <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
    : <LegacyAuthProvider>{children}</LegacyAuthProvider>;
}
