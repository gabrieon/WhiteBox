// The icon set for the "How to play" rules list.
//
// Kept apart from the component, and written as plain data rather than JSX, so a
// test can assert that every game's `ruleIcons` names glyphs that actually
// exist. That is the only way a typo in a manifest turns into a silently wrong
// icon instead of a loud failure — RuleIcon falls back rather than throwing.
//
// Inline SVG rather than an icon library: the set is small, fixed, and shipped
// with a screen whose whole job is to get the player into the game fast. A
// dependency here would be many kilobytes for thirteen glyphs.
//
// All glyphs share one 24×24 box, one stroke weight and one line style so they
// read as a family. Stroke-based and deliberately chunky — these render as small
// as 26px on a phone, and a hairline icon at that size disappears.
//
// Each entry is a list of `{ tag, attrs }`. Plain objects rather than elements so
// this file parses in bare Node with no JSX transform.

export const RULE_ICON_PATHS = {
  target: [
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 8 } },
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 3.2 } },
    { tag: 'path', attrs: { d: 'M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3' } },
  ],
  grid: [
    { tag: 'rect', attrs: { x: 3, y: 3, width: 7.5, height: 7.5, rx: 1.4 } },
    { tag: 'rect', attrs: { x: 13.5, y: 3, width: 7.5, height: 7.5, rx: 1.4 } },
    { tag: 'rect', attrs: { x: 3, y: 13.5, width: 7.5, height: 7.5, rx: 1.4 } },
    { tag: 'rect', attrs: { x: 13.5, y: 13.5, width: 7.5, height: 7.5, rx: 1.4 } },
  ],
  check: [
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 8.5 } },
    { tag: 'path', attrs: { d: 'M8.2 12.4l2.6 2.6 5-5.4' } },
  ],
  cross: [
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 8.5 } },
    { tag: 'path', attrs: { d: 'M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6' } },
  ],
  swap: [
    { tag: 'path', attrs: { d: 'M4 8.5h13M13.5 5l3.5 3.5-3.5 3.5' } },
    { tag: 'path', attrs: { d: 'M20 15.5H7M10.5 12L7 15.5 10.5 19' } },
  ],
  keyboard: [
    { tag: 'rect', attrs: { x: 2.5, y: 6, width: 19, height: 12, rx: 2.2 } },
    { tag: 'path', attrs: { d: 'M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M6.5 14h11' } },
  ],
  hand: [
    { tag: 'path', attrs: { d: 'M9 11V5.6a1.8 1.8 0 013.6 0V11' } },
    {
      tag: 'path',
      attrs: {
        d: 'M12.6 11.4V9.8a1.8 1.8 0 013.6 0V15a6 6 0 01-6 6h-.8a5 5 0 01-3.9-1.9'
          + 'l-2.6-3.3a1.8 1.8 0 012.7-2.3L9 16',
      },
    },
  ],
  trophy: [
    { tag: 'path', attrs: { d: 'M7 4h10v5a5 5 0 01-10 0V4z' } },
    { tag: 'path', attrs: { d: 'M7 5.5H4.6a2.4 2.4 0 002.4 4M17 5.5h2.4a2.4 2.4 0 01-2.4 4' } },
    { tag: 'path', attrs: { d: 'M12 14v3.5M8.5 20.5h7' } },
  ],
  clock: [
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 8.5 } },
    { tag: 'path', attrs: { d: 'M12 7v5.4l3.4 2' } },
  ],
  eye: [
    { tag: 'path', attrs: { d: 'M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z' } },
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 2.8 } },
  ],
  refresh: [
    { tag: 'path', attrs: { d: 'M20 12a8 8 0 11-2.6-5.9' } },
    { tag: 'path', attrs: { d: 'M20.5 3.5V8H16' } },
  ],
  question: [
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 8.5 } },
    { tag: 'path', attrs: { d: 'M9.6 9.6a2.5 2.5 0 114.2 1.9c-.9.8-1.8 1.2-1.8 2.4' } },
    { tag: 'path', attrs: { d: 'M12 17.2h.01' } },
  ],
  pair: [
    { tag: 'rect', attrs: { x: 2.5, y: 6, width: 8, height: 11, rx: 1.6 } },
    { tag: 'rect', attrs: { x: 13.5, y: 7, width: 8, height: 11, rx: 1.6 } },
  ],
  sparkle: [
    {
      tag: 'path',
      attrs: { d: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z' },
    },
    {
      tag: 'path',
      attrs: { d: 'M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z' },
    },
  ],
};

/** Every name a game's `ruleIcons` array may use. */
export const RULE_ICON_NAMES = Object.keys(RULE_ICON_PATHS);

// Names outside this set fall back to this glyph rather than rendering nothing.
// A missing icon is a smaller problem than an empty box that shifts the row.
export const RULE_ICON_FALLBACK = 'target';