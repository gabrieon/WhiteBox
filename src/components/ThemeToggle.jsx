import { useEffect, useState } from 'react';
import { Theme, getTheme, toggleTheme } from '../sdk/theme.js';

// Small square button that flips between the light and black themes. The icon
// shows what you would switch TO, which is the usual convention.

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme);

  // Another tab changing the theme should be reflected here without a reload.
  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'whitebox:theme' || e.key === null) setTheme(getTheme());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isDark = theme === Theme.DARK;

  return (
    <button
      type="button"
      className="wb-theme-toggle"
      onClick={() => setTheme(toggleTheme())}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}