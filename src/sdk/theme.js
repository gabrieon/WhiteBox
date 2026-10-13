// WhiteBox theme — light/dark with persistence.
//
// The active theme is a `data-theme` attribute on <html>. A tiny inline script
// in index.html applies it before first paint (see that file), so there is no
// flash of the wrong theme; this module is the single place React talks to.

const KEY = 'whitebox:theme';

export const Theme = {
  LIGHT: 'light',
  DARK: 'dark',
};

// Default is dark. An explicit stored choice always wins; a missing or bogus
// value falls back to the default rather than leaving the page unthemed.
export function getTheme() {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === Theme.LIGHT || stored === Theme.DARK) return stored;
  } catch {
    // Private mode / storage blocked — fall through to the default.
  }
  return Theme.DARK;
}

export function applyTheme(theme) {
  const next = theme === Theme.LIGHT ? Theme.LIGHT : Theme.DARK;
  document.documentElement.dataset.theme = next;

  // Keep the browser chrome (address bar on mobile) in step with the page.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', next === Theme.DARK ? '#0b0b0b' : '#ffffff');

  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // Storage blocked: the theme applies for this visit only.
  }
  return next;
}

export function toggleTheme() {
  return applyTheme(document.documentElement.dataset.theme === Theme.DARK
    ? Theme.LIGHT
    : Theme.DARK);
}