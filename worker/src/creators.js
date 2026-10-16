// Creator access.
//
// Creation is opt-in per account and granted by an admin. A signed-in player
// who has not been granted access can browse and play but cannot publish.
//
// Why a table and not a boolean on the profile: "may create" is a grant with an
// audit trail (who granted it, when), and the next version of this will want to
// record *who requested* it. Keeping it in its own table means adding those
// columns later is an additive migration rather than a rewrite of `games`.
//
// Reads fail CLOSED: with no grant table to consult, nobody is a creator.
//
// The alternative — treating an unreachable table as "everyone may create" —
// would open the gate on a production binding outage, which is exactly when a
// flood is most likely. The gate is also not the only thing between a caller and
// a write: createGame needs the same binding, so a missing database refuses the
// write either way.

export async function isCreator(env, userId) {
  if (!env.GAMES || !userId) return false;
  const row = await env.GAMES.prepare(
    'SELECT 1 AS ok FROM creators WHERE user_id = ?',
  ).bind(userId).first();
  return Boolean(row);
}

export async function grantCreator(env, userId, userName, grantedBy) {
  if (!env.GAMES) throw new Error('storage_not_configured');
  await env.GAMES.prepare(
    `INSERT INTO creators (user_id, user_name, granted_at, granted_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET user_name = excluded.user_name`,
  ).bind(userId, userName || null, Date.now(), grantedBy || null).run();
  return true;
}

export async function revokeCreator(env, userId) {
  if (!env.GAMES) return false;
  const result = await env.GAMES.prepare(
    'DELETE FROM creators WHERE user_id = ?',
  ).bind(userId).run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function listCreators(env) {
  if (!env.GAMES) return [];
  const result = await env.GAMES.prepare(
    'SELECT user_id, user_name, granted_at FROM creators ORDER BY granted_at DESC',
  ).all();
  return (result.results || []).map((row) => ({
    userId: row.user_id,
    userName: row.user_name || null,
    grantedAt: row.granted_at,
  }));
}

/** How many games this account has published, for the admin list. */
export async function countGamesBy(env, userId) {
  if (!env.GAMES) return 0;
  const row = await env.GAMES.prepare(
    'SELECT COUNT(*) AS n FROM games WHERE creator_id = ?',
  ).bind(userId).first();
  return row?.n ?? 0;
}