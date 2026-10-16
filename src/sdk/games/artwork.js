// Client for AI-generated artwork.
//
// The Worker returns raw image bytes, not JSON. That is the whole reason this
// file exists as a separate step: the response becomes a Blob with the right
// type, which is exactly what prepareThumbnail already accepts, so a generated
// thumbnail and a hand-picked photo take the identical path from here on.

import { apiFetch } from '../auth/authClient.js';

const GENERATE_PATH = '/v1/artwork/generate';

/** How many generations this account has left today. */
export async function fetchArtworkQuota() {
  const data = await apiFetch('/v1/artwork/quota');
  return {
    used: Number(data?.used) || 0,
    limit: Number(data?.limit) || 0,
    remaining: Math.max(0, Number(data?.remaining) || 0),
  };
}

/**
 * Generate one image for `gameId`.
 *
 * @returns {Promise<Blob>} the raw image, NOT yet cropped or compressed. The
 * caller must run it through prepareThumbnail before uploading.
 */
export async function generateArtwork(gameId, prompt) {
  const response = await apiFetch(GENERATE_PATH, {
    method: 'POST',
    body: JSON.stringify({ gameId, prompt }),
    // apiFetch throws on a non-2xx with the error code from the body, which is
    // what carries `artwork_quota_exhausted` and friends. But a success here is
    // an image, not JSON, so the JSON parsing in apiFetch would destroy it.
    raw: true,
  });

  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) {
    // A 200 with a non-image body means something upstream answered wrongly.
    // Surfacing it beats uploading a text file as artwork.
    throw new Error('artwork_not_an_image');
  }
  return blob;
}

/**
 * A starting prompt derived from the game itself.
 *
 * Offered as a suggestion rather than applied automatically: generated art
 * directed from a one-line description is generic, and the person who wrote the
 * game knows what they want it to look like.
 *
 * The style clause is part of the suggestion, not a server-side suffix, so a
 * creator who dislikes it can delete it and keep everything else.
 */
export function suggestPrompt(game) {
  const title = (game?.title || '').trim();
  const tags = Array.isArray(game?.categories)
    ? game.categories.filter(Boolean).slice(0, 3)
    : [];
  const blurb = (game?.description || '').trim();

  const subject = title || 'an abstract game';
  const flavour = tags.length ? ` ${tags.join(', ')} game` : ' game';

  const base = `Bold flat vector illustration for a${flavour} called "${subject}".`
    + (blurb ? ` It is about: ${blurb.slice(0, 160)}.` : '')
    + ' Single centred subject, strong silhouette, thick clean shapes,'
    + ' limited palette of two or three bright colours on a plain background,'
    + ' no text, no words, no letters, no logos.';

  return base.slice(0, 600);
}