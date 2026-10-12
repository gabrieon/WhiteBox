// WhiteBox website Worker — static hosting only.
//
// Every request is served from the [assets] directory (the Vite build
// output). Unknown paths fall back to index.html (configured as
// single-page-application in wrangler.toml) so in-app views and #links work.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
