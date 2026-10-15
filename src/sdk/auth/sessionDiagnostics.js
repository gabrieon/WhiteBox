// Session diagnostics.
//
// Enabled only with `?debug=session` in the URL, so it costs nothing in normal
// use. When it is on we record every auth event Supabase emits, because "I get
// logged out when I close the browser" has too many plausible causes to reason
// about — the event name alone ("SIGNED_OUT") says nothing about *why*. Guessing
// at it was wrong three times before this existed.
//
// Lives outside AuthProvider.jsx so that file only exports components, which is
// what React Fast Refresh requires.

const STORAGE_KEY = 'sb-lwyvvotptayfdlbuwhfh-auth-token';

export const debugEnabled = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('debug') === 'session';

const events = [];
const errors = [];

export function recordAuthEvent(event, session) {
  if (!debugEnabled) return;
  events.unshift({
    event,
    at: new Date().toISOString().slice(11, 23),
    hasSession: Boolean(session && session.access_token),
  });
  if (events.length > 40) events.length = 40;
}

export function recordAuthError(where, err) {
  if (!debugEnabled) return;
  errors.unshift({
    where,
    message: (err && err.message) || String(err) || 'unknown',
    at: new Date().toISOString().slice(11, 23),
  });
  if (errors.length > 20) errors.length = 20;
}

/**
 * Read the persisted session straight out of storage, bypassing the Supabase
 * client. Answers "is the token still on disk right now" independently of
 * anything the client believes about it — which is precisely the distinction
 * that separates "the browser deleted it" from "Supabase rejected it".
 */
export function readStoredSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { present: false, note: 'no key in localStorage' };

    const parsed = JSON.parse(raw);
    return {
      present: true,
      expiresAt: parsed.expires_at || null,
      hasRefreshToken: Boolean(parsed.refresh_token),
      provider: (parsed.user && parsed.user.app_metadata && parsed.user.app_metadata.provider) || null,
      email: (parsed.user && parsed.user.email) || null,
    };
  } catch (err) {
    return { present: false, note: (err && err.message) || 'unreadable' };
  }
}

export function storageWritable() {
  try {
    const probe = '__wb_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function sessionDiagnostics() {
  return {
    enabled: debugEnabled,
    stored: readStoredSession(),
    storageWritable: storageWritable(),
    events: events.slice(),
    errors: errors.slice(),
  };
}