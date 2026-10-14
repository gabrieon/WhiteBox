// WhiteBox Game SDK — Supabase Auth client.
//
// Supabase owns the session and hands the browser a JWT. That token has to ride
// along on every API call, which is different from the original Google + HttpOnly
// cookie flow. Rather than thread a token through every call site, the provider
// publishes the current token here and `apiFetch` picks it up — so progress sync
// and everything else stays unchanged regardless of which auth mode is live.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

// Absent keys must not throw at import time — main.jsx reads `supabaseEnabled()`
// and falls back to the legacy Google flow when they are missing.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // handles the OAuth redirect back on load
    },
  })
  : null;

export function supabaseEnabled() {
  return Boolean(supabase);
}

let currentToken = null;

export function setSupabaseToken(token) {
  currentToken = token || null;
}

export function getSupabaseToken() {
  return currentToken;
}

// Google / Apple / GitHub all go through Supabase's OAuth broker, which handles
// the code exchange and PKCE for us. The browser never sees a client secret.
export async function signInWithProvider(provider) {
  if (!supabase) throw new Error('auth_not_configured');
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signInWithEmail(email) {
  if (!supabase) throw new Error('auth_not_configured');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOutSupabase() {
  if (!supabase) return;
  await supabase.auth.signOut();
  setSupabaseToken(null);
}
