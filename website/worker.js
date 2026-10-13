// WhiteBox website Worker — static hosting only.
//
// Every request is served from the [assets] directory (the Vite build
// output). Unknown paths fall back to index.html (configured as
// single-page-application in wrangler.toml) so in-app views and #links work.

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

    return env.ASSETS.fetch(request);
  },
};