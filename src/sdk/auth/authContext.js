import { createContext, useContext } from 'react';

// Kept in its own module so AuthProvider.jsx exports only a component, which
// is what React Fast Refresh needs to hot-reload it safely.
export const AuthContext = createContext(null);

export const AuthStatus = {
  LOADING: 'loading',
  SIGNED_OUT: 'signed_out',
  SIGNED_IN: 'signed_in',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>');
  return ctx;
}