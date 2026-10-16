import { createElement } from 'react';
import { RULE_ICON_FALLBACK, RULE_ICON_PATHS } from './ruleIcons.js';

// Renders one glyph from the shared icon set. The set itself lives in
// ruleIcons.js as plain data so a test can check every game's declarations
// against it without importing a component.

/**
 * @param {{name?: string, size?: number, className?: string}} props
 *   `name` is a key of the icon set. Unknown names render the fallback glyph.
 */
export default function RuleIcon({ name, size = 26, className = '' }) {
  const glyph = RULE_ICON_PATHS[name] || RULE_ICON_PATHS[RULE_ICON_FALLBACK];
  return (
    <svg
      className={`wb-rule-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      // The rule text is the content. The glyph only gives it a shape to be
      // recognised by, and announcing it would read a meaningless name.
      aria-hidden="true"
      focusable="false"
    >
      {glyph.map(({ tag, attrs }, i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}