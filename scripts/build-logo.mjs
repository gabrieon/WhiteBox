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
  sharp = (await import('sharp')).default;
} catch {
  console.log('sharp not installed — wrote the SVGs only.');
  process.exit(0);
}

await sharp(Buffer.from(LOGO)).resize(256, 256).png().toFile('public/logo.png');

await sharp(Buffer.from(LOGO))
  .resize(256, 256)
  .png()
  .toFile('public/apple-touch-icon.png');

// A 512 icon for "add to home screen" on mobile, where a 32px favicon is
// unusably small.
await sharp(Buffer.from(LOGO)).resize(512, 512).png().toFile('public/icon-512.png');

console.log('wrote public/logo.svg, logo.png, apple-touch-icon.png, icon-512.png, favicon.svg');