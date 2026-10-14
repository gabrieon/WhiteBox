// Supabase token verification for the WhiteBox Worker.
//
// A token arriving in the Authorization header is untrusted input, so it is
// checked before any claim from it is used. Rather than reimplement Supabase's
// HS256 verification (which needs the project's JWT secret and constant-time
// HMAC comparison), we ask Supabase's own /auth/v1/user endpoint to validate it.
// That endpoint is the authority on its own tokens: it returns the user only for
// a valid, unexpired token, and 401 for anything else.
//
// Cost: one extra round-trip per authenticated request. Worth it — the Worker
// still never holds the signing secret, and a bad token cannot slip through on
// a home-grown crypto bug.
//
// Configure with SUPABASE_URL and SUPABASE_ANON_KEY.

export async function verifySupabaseToken(token, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error('auth_not_configured');
  }

  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });

  if (!res.ok) throw new Error('unauthorized');

  const user = await res.json();
  if (!user || typeof user.id !== 'string' || !user.id) {
    throw new Error('invalid_user');
  }

  return { userId: user.id };
}

/** Pull the bearer token out of an Authorization header. */
export function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
