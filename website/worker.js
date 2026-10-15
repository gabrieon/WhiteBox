// WhiteBox website Worker — static hosting only.
//
// Requests are served from the [assets] directory (the Vite build output).
// Unknown paths fall back to index.html (configured as
// single-page-application in wrangler.toml) so in-app views and #links work.
//
// Two things this layer has to get right beyond simply proxying to the asset
// binding:
//
//   1. Cache headers. Vite emits content-hashed filenames under /assets/, so
//      those can be cached forever and revalidated never. Everything else
//      (index.html, favicon, thumbnails) has a stable name, so it must revalidate
//      or a replaced file would be pinned in someone's browser indefinitely.
//
//   2. Honest 404s. The SPA fallback answers *every* unmatched path with
//      index.html, including requests for JavaScript chunks that no longer exist
//      after a deploy. The browser then receives HTML where it demanded a
//      module, and refuses it with a MIME-type error that says nothing about the
//      real cause. A stale cached bundle used to brick the whole site with an
//      error nobody could act on. File-shaped requests that fall through to the
//      fallback are turned back into a real 404 so the failure is legible.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Force HTTPS. Without this the site happily serves itself over plain
    // http://, and Google's OAuth compares the exact JavaScript origin — so a
    // player on http://rarelyknown.in is a different origin from
    // https://rarelyknown.in and sign-in fails with `origin_mismatch`.
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    const res = await env.ASSETS.fetch(request);
    const contentType = res.headers.get('Content-Type') || '';

    // Anything with a file extension wanted a file, not the SPA shell.
    if (/\.[a-z0-9]{2,5}$/i.test(url.pathname) && contentType.includes('text/html')) {
      return new Response('Not found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          // Never cache a miss: the very next deploy may add the chunk back.
          'Cache-Control': 'no-store',
        },
      });
    }

    const headers = new Headers(res.headers);

    if (/^\/assets\/.+-[A-Za-z0-9_-]{6,}\.[a-z0-9]+$/i.test(url.pathname)) {
      // Content-addressed filename: if it is cached forever and still valid
      // today, it is still valid tomorrow.
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // index.html and the stable-name files. `no-cache` still permits a stored
      // copy, it just forces revalidation before reuse, which is what keeps a
      // deploy from leaving someone on a deleted bundle.
      headers.set('Cache-Control', 'no-cache');
    }

    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
