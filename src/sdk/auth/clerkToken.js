// WhiteBox Game SDK — Clerk session-token bridge.
//
// The Worker used to authenticate from an HttpOnly cookie the browser attached
// automatically. Clerk doesn't work that way: the token lives in JS, so every
// API call has to carry it.
//
// Rather than thread a token through every call site (progress sync, etc.), the
// provider publishes the current token here and `apiFetch` picks it up. That
// keeps the rest of the app unchanged whether auth is Google or Clerk.

let currentToken = null;

// Called by the Clerk-aware AuthProvider. Pass null on sign-out.
export function setClerkToken(token) {
  currentToken = token || null;
}

export function getClerkToken() {
  return currentToken;
}

export function clerkEnabled() {
  const key = import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY;
  return typeof key === 'string' && key.startsWith('pk_');
}