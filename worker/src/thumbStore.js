// Thumbnail storage on Supabase Storage.
//
// Interface matches what the Worker needs — put, get, delete — so swapping this
// backends is a change to this file only.
//
// Why Supabase Storage rather than R2 or D1:
//   * the project already exists and is already paid for, so there is no second
//     cloud vendor and no payment method to add for one feature
//   * R2 was never switched on for this account, and waiting on a dashboard
//     toggle blocked the feature entirely
//   * images stay out of the database, which is what a KV-ish store is for
//
// The bucket is public for READS and RLS-restricted for WRITES. That is the
// shape that lets the Worker upload with the player's own Supabase session
// token: no service-role secret exists anywhere in this infrastructure, so there
// is no privileged credential to leak or rotate.

const BUCKET = 'game-thumbs';

// Object keys carry no file extension on purpose. A served object with a .html
// key can be coaxed into executing in some browsers; "games/<id>/thumb" cannot
// be, and the response Content-Type comes from the bucket's metadata anyway.

function thumbKey(gameId) {
  return `games/${gameId}/thumb`;
}

/** Public URL for an object. No signature needed — the bucket is public. */
export function publicUrl(env, key) {
  if (!env.SUPABASE_URL || !env.THUMBS_BUCKET) return null;
  return `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${env.THUMBS_BUCKET}/${key}`;
}

/**
 * Upload bytes as the given Supabase user.
 *
 * `userToken` is the caller's verified session token. Supabase Storage checks it
 * like any other request, so our RLS policies decide what is allowed — the
 * Worker gets no special authority of its own.
 *
 * Content-Type is taken from the caller's sniffed magic bytes, never from the
 * request header, so a client cannot upload something mislabelled.
 */
export async function putThumb(env, key, buffer, contentType, userToken) {
  if (!env.SUPABASE_URL) throw new Error('storage_not_configured');

  const bucket = env.THUMBS_BUCKET || BUCKET;
  const res = await fetch(
    `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${bucket}/${key}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': contentType,
        'x-upsert': 'true', // replace an existing object rather than 409 on it
      },
      body: buffer,
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`upload_failed:${res.status}${detail ? `:${detail.slice(0, 120)}` : ''}`);
  }
  return { key, url: publicUrl(env, key) };
}

/**
 * Remove an object, as the given Supabase user.
 *
 * Deletes go through the caller's token for the same reason uploads do: no
 * service-role secret exists in this codebase. Game-level authorisation has
 * already happened in the route handler before this is reached.
 */
export async function deleteThumb(env, key, userToken) {
  if (!env.SUPABASE_URL) return;
  const bucket = env.THUMBS_BUCKET || BUCKET;

  const res = await fetch(
    `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${bucket}/${key}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${userToken}` } },
  );

  // A missing object is a success for our purposes: the goal was for it not to
  // exist.
  if (!res.ok && res.status !== 404) {
    throw new Error(`delete_failed:${res.status}`);
  }
}

export { BUCKET, thumbKey };