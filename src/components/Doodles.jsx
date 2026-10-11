// Hand-drawn decorative primitives for the Sticker Bomb identity.
// All use currentColor so placement/color is controlled by CSS.

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function Star({ className, size = 26 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path {...stroke} strokeWidth="1.7" d="M12 2.6 14.4 8.7 21 9.3 16 13.6 17.7 20.4 12 16.8 6.4 20.6 7.9 13.7 2.9 9.4 9.5 8.6 Z" />
    </svg>
  );
}

export function Sparkle({ className, size = 20 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path {...stroke} strokeWidth="1.8" d="M12 2.5c.7 4.4 1.6 6.4 3.2 7.6 1.4 1 3.4 1.5 6.3 1.9-4.3.6-6.2 1.4-7.4 3-1 1.4-1.6 3.4-2.1 6.5-.6-4.4-1.4-6.3-3-7.5-1.4-1-3.4-1.6-6.5-2 4.4-.6 6.3-1.4 7.5-3 1-1.4 1.5-3.4 2-6.5Z" />
    </svg>
  );
}

export function ArrowScribble({ className, width = 74, height = 46 }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 74 46" aria-hidden="true">
      <path {...stroke} strokeWidth="2" d="M4 6c10 12 22 20 38 24 8 2 16 2 26 0" />
      <path {...stroke} strokeWidth="2" d="M60 22l9 8-11 5" />
    </svg>
  );
}

export function Scribble({ className, width = 64, height = 22 }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 64 22" aria-hidden="true">
      <path {...stroke} strokeWidth="1.8" d="M3 14c6-8 10-8 12-2s5 7 9 1 7-8 10-2 5 7 9 1 7-7 10-1 4 5 8 3" />
    </svg>
  );
}

export function Smiley({ className, size = 30 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path {...stroke} strokeWidth="1.7" d="M16 3.4c7.4-.3 12.8 5.2 12.6 12.4C28.4 23 23 28.7 15.8 28.6 8.7 28.5 3.2 22.9 3.4 15.7 3.6 8.8 9 3.7 16 3.4Z" />
      <path {...stroke} strokeWidth="1.8" d="M11.4 13.2c.1.9.1 1.6 0 2.5M20.4 13c.1.9.1 1.7 0 2.6" />
      <path {...stroke} strokeWidth="1.8" d="M10.6 19.6c3.4 3.4 7.6 3.5 11 .2" />
    </svg>
  );
}

export function InkSplat({ className, size = 34 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <path fill="currentColor" d="M17 6c3.6-.4 6.2 1.6 7.4 4.2 1.1 2.4 3.6 2.6 4.4 5 .8 2.5-.8 4.6-2.6 6-1.9 1.5-2 4.3-4.4 5.4-2.5 1.1-4.8-.4-7.2-.2-2.6.2-5 1.4-7-.4-2-1.7-1.3-4.4-2.4-6.6-1.1-2.3-2.6-4.6-1.4-7 1.2-2.4 4-2.3 5.8-4C11.5 6.7 14 6.3 17 6Z" />
      <circle fill="currentColor" cx="29" cy="8" r="1.6" />
      <circle fill="currentColor" cx="5" cy="26" r="1.3" />
      <circle fill="currentColor" cx="27" cy="27" r="1.1" />
    </svg>
  );
}

export function Squiggle({ className, width = 90, height = 12 }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 90 12" aria-hidden="true">
      <path {...stroke} strokeWidth="2.4" d="M2 8c8-6 14-6 20 0s12 6 18 0 12-6 18 0 12 6 20 0" />
    </svg>
  );
}

export function CrossHatch({ className, size = 22 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <path {...stroke} strokeWidth="1.5" d="M3 5l16 14M5 3l14 16M9 2l11 11M2 9l11 11" />
    </svg>
  );
}
