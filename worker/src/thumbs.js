// Uploaded thumbnails, stored as objects in the R2 bucket `whitebox-thumbs`.
//
// The browser sends a file to the Worker; the Worker validates it and streams it
// to R2. Nothing is written without passing every check below first.
//
// Why the Worker sits in the middle rather than taking a presigned URL: the
// checks are the point. A presigned PUT would let anyone with the token stuff
// arbitrary bytes into the bucket, and there'd be no place to enforce a size
// cap, sniff the real content type, or confirm the caller owns the game.
//
// Images are compressed in the browser before upload, so this path handles small
// JPEGs, not phone camera rolls. MAX_BYTES is a hard ceiling regardless.

const MAX_BYTES = 512 * 1024; // 512 KB — generous for a compressed thumbnail
const CONTENT_TYPE = 'image/jpeg'; // the client always re-encodes to JPEG

// Images are served from a key with no extension. Stripping it means a key can
// never be coaxed into executing as script by a browser that sniffs types, and
// it keeps the served Content-Type unambiguous.

// Magic-number prefixes. The declared Content-Type is whatever the client felt
// like sending, so the bytes themselves are what decide whether this is an image.
const SIGNATURES = [
  { bytes: [0xff, 0xd8, 0xff], type: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], type: 'image/png' },
  { bytes: [0x47, 0x49, 0x46, 0x38], type: 'image/gif' },
];

function sniff(bytes) {
  for (const sig of SIGNATURES) {
    if (sig.bytes.every((b, i) => bytes[i] === b)) return sig.type;
  }
  // WebP: "RIFF" .... "WEBP"
  if (bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  return null;
}

/**
 * Read and validate an uploaded image.
 * @throws {Error} with a short machine-readable reason.
 */
export async function readUpload(request) {
  // Check the declared size before reading, so an oversized body is refused
  // rather than buffered. Content-Length is absent on chunked requests, so the
  // hard check below still applies after reading.
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BYTES) throw new Error('image_too_large');

  const buffer = await request.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length === 0) throw new Error('image_empty');
  if (bytes.length > MAX_BYTES) throw new Error('image_too_large');

  const sniffed = sniff(bytes);
  if (!sniffed) throw new Error('image_not_an_image');

  return { bytes: buffer, contentType: sniffed };
}

/** Deterministic key so re-uploading a thumbnail replaces it cleanly. */
export function thumbKey(gameId) {
  return `games/${gameId}/thumb`;
}

/**
 * Store bytes under a key. Objects are served publicly by key, so caching is
 * aggressive and immutable is safe: the key changes whenever the bytes change
 * would be ideal, but a game keeps one thumbnail slot, so the Worker sets a
 * short max-age and relies on the URL being version-free.
 */
export async function putThumb(env, key, buffer, contentType) {
  if (!env.THUMBS) throw new Error('storage_not_configured');
  await env.THUMBS.put(key, buffer, {
    httpMetadata: { contentType, cacheControl: 'public, max-age=604800' },
  });
}

export async function getThumb(env, key) {
  if (!env.THUMBS) return null;
  const object = await env.THUMBS.get(key);
  return object || null;
}

export async function deleteThumb(env, key) {
  if (!env.THUMBS) return;
  await env.THUMBS.delete(key);
}

export { MAX_BYTES, CONTENT_TYPE };
