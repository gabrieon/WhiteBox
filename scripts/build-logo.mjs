// Generate the WhiteBox logo assets from one source of truth.
//
// Run: node scripts/build-logo.mjs
//
// The SVG is written out by hand here rather than rasterised from the React
// component, because src/components/WhiteBoxMark.jsx renders in currentColor to
// work on both themes while a .png is baked to a single colour. Both are kept in
// step manually; the shapes are identical.
//
// Outputs:
//   public/logo.svg       scalable, used at large sizes
//   public/logo.png       256px, for anything that needs a bitmap
//   public/favicon.svg    replaced — the old default Vite mark

import fs from 'node:fs';

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 32 32" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M16 3 L29 10 L16 17 L3 10 Z"/>
  <path d="M3 10 L3 22 L16 29 L16 17"/>
  <path d="M29 10 L29 22 L16 29"/>
</svg>
`;

fs.writeFileSync('public/logo.svg', LOGO);

// Favicon: same mark, but stroke-width is nudged up so the diagonals survive at
// 16px. At the default weight the lid renders as a grey smear in a tab.
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#111111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <rect width="32" height="32" fill="#ffffff"/>
  <path d="M16 4 L28 10.5 L16 17 L4 10.5 Z"/>
  <path d="M4 10.5 L4 22 L16 28.5 L16 17"/>
  <path d="M28 10.5 L28 22 L16 28.5"/>
</svg>
`;

fs.writeFileSync('public/favicon.svg', FAVICON);

let sharp = null;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('sharp is required to rasterise logos. Run `npm install` first.');
  process.exit(1);
}

await sharp(Buffer.from(LOGO)).resize(256, 256).png().toFile('public/logo.png');

// iOS ignores the manifest icon and uses this file at exactly 180px.
await sharp(Buffer.from(LOGO)).resize(180, 180).png().toFile('public/apple-touch-icon.png');

// Installability needs both raster sizes. Transparent icons are correct for
// `purpose: any`; adaptive launchers use the separate maskable asset below.
await sharp(Buffer.from(LOGO)).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(Buffer.from(LOGO)).resize(512, 512).png().toFile('public/icon-512.png');

// Maskable icons are cropped by the launcher, so the mark must sit well inside
// the safe zone on an opaque field. Transparency here would become an arbitrary
// launcher background — or worse, a black mark on a black launcher theme.
const maskableLogo = await sharp(Buffer.from(LOGO)).resize(320, 320).png().toBuffer();
await sharp({
  create: {
    width: 512, height: 512, channels: 4, background: '#0b0b0b',
  },
}).composite([{ input: maskableLogo, left: 96, top: 96 }]).png().toFile('public/icon-maskable-512.png');

// Social/unfurl card. Crawlers do not run CSS or SVG layout reliably, so bake
// the composition once: light mark and text on the same black as the game.
const SOCIAL_MARK = LOGO.replaceAll('stroke="#111111"', 'stroke="#ffffff"');
const socialLogo = await sharp(Buffer.from(SOCIAL_MARK)).resize(300, 300).png().toBuffer();
const socialText = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <text x="480" y="300" font-family="Arial, Helvetica, DejaVu Sans, sans-serif" font-size="132" font-weight="800" fill="#ffffff" letter-spacing="-2">WhiteBox</text>
  <text x="484" y="370" font-family="Arial, Helvetica, DejaVu Sans, sans-serif" font-size="44" fill="#bdbdbd">Small games, built to be played.</text>
</svg>`);
await sharp({
  create: {
    width: 1200, height: 630, channels: 4, background: '#0b0b0b',
  },
})
  .composite([
    { input: socialLogo, left: 120, top: 165 },
    { input: socialText, left: 0, top: 0 },
  ])
  .png()
  .toFile('public/og-image.png');

console.log('wrote public/logo.svg, logo.png, apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png, og-image.png, favicon.svg');