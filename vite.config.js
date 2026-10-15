import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Pin the CSS target instead of letting esbuild's default decide.
    //
    // By default the minifier was emitting only `-webkit-backdrop-filter` and
    // dropping the unprefixed `backdrop-filter`, which is backwards for the
    // browsers this site actually targets — `backdrop-filter` has been Baseline
    // since September 2024. Naming modern targets keeps the standard property
    // and the prefix, so the frosted bar degrades to a solid fill rather than to
    // no effect at all.
    cssTarget: ['chrome111', 'safari16', 'firefox128'],
  },
})