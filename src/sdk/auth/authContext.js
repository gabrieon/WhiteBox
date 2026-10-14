// WhiteBox Game SDK — auth session context.
//
// One shape for both backends. Downstream code reads `status`, `profile` and
// `isSignedIn` and never learns which provider is behind them, so swapping the
// auth backend is a change to AuthProvider alone.

import { createContext, useContext } from 'react';

export const AuthStatus = {
  LOADING: 'loading',
  SIGNED_IN: 'signed_in',
  SIGNED_OUT: 'signed_out',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
};

export const AuthContext = createContext({
  status: AuthStatus.LOADING,
  profile: null,
  error: null,
  configured: false,
  isSignedIn: false,
  onSignedIn: () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
