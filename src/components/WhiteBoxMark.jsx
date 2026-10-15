// WhiteBox logo — an open cube seen from slightly above.
//
// Deliberately monochrome and stroke-only: the rest of the site is flat black on
// white (or inverted), so a logo that introduces colour would be the one thing
// fighting the design. Stroke width is tuned so the mark still reads at 16px,
// which matters because it doubles as the favicon.
//
// Written as a component rather than an <img> so `currentColor` makes the same
// markup correct on both themes with no second asset.

export default function WhiteBoxMark({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="WhiteBox"
    >
      {/* Top face — the open lid, drawn as a parallelogram. */}
      <path d="M16 3 L29 10 L16 17 L3 10 Z" />
      {/* Left and right walls dropping from the lid. */}
      <path d="M3 10 L3 22 L16 29 L16 17" />
      <path d="M29 10 L29 22 L16 29" />
    </svg>
  );
}