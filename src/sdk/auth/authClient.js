// WhiteBox Game SDK — Google sign-in client.
//
// Flow:
//   1. Google Identity Services (GIS) shows its own branded button and returns
//      a signed ID token to the callback.
//   2. That token is POSTed to the Worker, which verifies it against Google's
//      signing keys and only then issues an HttpOnly session cookie.
//
// The browser therefore never holds a usable credential: the ID token is used
// once and discarded, and the session lives in a cookie page JS cannot read.
//
// If the Worker is unconfigured, sign-in is reported as unavailable rather than
// failing silently, so the rest of the app keeps working as a guest.
//
// This path is the fallback. When Supabase keys are configured the app uses
// Supabase instead (see supabaseClient.js) — these functions stay put so the
// site still signs in if the Supabase keys are ever removed.

import { getSupabaseToken } from './supabaseClient.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCRIPT_ID = 'whitebox-gsi';

let sdkPromise = null;

// The Worker serves both multiplayer and auth. Same origin, different port is
// possible in dev, so the base is configurable and falls back to the default.
export function apiBase() {
  const configured = import.meta.env?.VITE_API_URL;
  if (configured) return String(configured).replace(/\/$/, '');
  const mp = import.meta.env?.VITE_MP_URL || 'ws://127.0.0.1:8787';
  return mp.replace(/^ws/, 'http').replace(/\/$/, '');
}

export function googleClientId() {
  return import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';
}

function loadGis() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('no_window'));
      return;
    }
    if (window.google?.accounts?.id) {
      resolve(window.google.accounts.id);
      return;
    }
    const existing = document.getElementById(SCRIPT_ID);
    const script = existing || document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.id = SCRIPT_ID;
    script.onload = () => {
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else reject(new Error('gis_unavailable'));
    };
    script.onerror = () => reject(new Error('gis_failed_to_load'));
    if (!existing) document.head.appendChild(script);
  });
  return sdkPromise;
}

export async function apiFetch(path, init = {}) {
  const url = `${apiBase()}${path}`;
  // Cookie auth (legacy Google) needs credentials; Supabase auth needs a bearer
  // token. Sending both is harmless and keeps one call site for both modes.
  const token = getSupabaseToken();

  const headers = { 'Content-Type': 'application/json', ...(init.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, {
      credentials: 'include',
      ...init,
      headers,
    });
  } catch (cause) {
    // A bare "Failed to fetch" tells us nothing. The request never reached the
    // Worker, which in practice means one of: an extension or network rule
    // blocking the API host, a CORS rejection, or the device being offline.
    const err = new Error(`network_blocked (${url})`);
    err.cause = cause;
    err.url = url;
    console.error('[whitebox] request never left the browser:', url, cause);
    throw err;
  }

  let data = {};
  try { data = await res.json(); } catch { /* empty body is fine */ }
  if (!res.ok) {
    const err = new Error(data.error || `auth_request_failed:${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function isConfigured() {
  return Boolean(googleClientId());
}

/**
 * Render Google's own branded sign-in button into `element`.
 * Resolves with { profile } on success, { cancelled: true } if dismissed.
 * Uses GIS's built-in One Tap / button UI rather than a custom Google-styled
 * button, which Google's branding guidelines require.
 *
 * Call this once per mount into an empty container. GIS sizes its iframe when
 * the button is created, so re-rendering into a node that already holds a
 * button leaves a zero-sized iframe — which is why the caller deliberately
 * does not re-render on theme changes.
 */
// GIS must be initialized exactly once per page load. Re-initializing (which
// happens naturally when the button re-renders on a theme change) logs
// "initialize() is called multiple times" and drops the earlier callback.
let gisInitialized = false;

export async function renderGoogleButton(element, { onProfile } = {}) {
  if (!isConfigured()) throw new Error('auth_not_configured');
  const id = await loadGis();

  return new Promise((resolve) => {
    if (!gisInitialized) {
      id.initialize({
        client_id: googleClientId(),
        callback: async (response) => {
          if (!response?.credential) {
            resolve({ cancelled: true });
            return;
          }
          try {
            const data = await apiFetch('/auth/google', {
              method: 'POST',
              body: JSON.stringify({ idToken: response.credential }),
            });
            onProfile?.(data.profile);
            resolve({ profile: data.profile });
          } catch (err) {
            resolve({ error: err.message });
          }
        },
        // Popup keeps the player inside the game rather than navigating away.
        ux_mode: 'popup',
        cancel_on_tap_outside: true,
        auto_select: false,
      });
      gisInitialized = true;
    }

    id.renderButton(element, {
      type: 'standard',
      // One theme, always — never swapped with the page theme. Google's
      // `outline` and `filled_black` differ by a 1px border, which changes the
      // button's inner size and moves the logo ~2px on every theme toggle.
      //
      // `filled_black` is the fixed choice because it sits correctly on BOTH
      // page themes: on the black page it is a dark button with white text, and
      // on white it is Google's standard dark button. `outline` was the earlier
      // pick and painted a bright white block on the black page.
      theme: 'filled_black',
      size: 'medium',
      text: 'signin_with',
      shape: 'pill',
      // No `width` on purpose. Passing one makes GIS build an iframe of that
      // width but draw the button at its own natural size — and the leftover
      // strip shows the iframe's white document background as a bright
      // rectangle around the button, most obvious on the dark theme. Letting
      // GIS size both together keeps the button edge-to-edge.
      logo_alignment: 'left',
    });
  });
}

export function getSession() {
  return apiFetch('/auth/session');
}

export function signOut() {
  return apiFetch('/auth/logout', { method: 'POST' });
}