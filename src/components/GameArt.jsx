// Distinct local artwork per game type. Unknown types fall back to a neutral
// box so a missing thumbnail never breaks the card layout.
//
// Flat black-and-grey only: no rounded corners, no tilts, no candy palette.
// Shapes and positions are unchanged from the original illustrations.

function ReactionArt() {
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" role="presentation">
      <rect width="160" height="120" fill="var(--lime)" />
      <circle cx="80" cy="60" r="44" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.4" />
      <circle cx="80" cy="60" r="30" fill="var(--coral)" stroke="var(--ink)" strokeWidth="2.2" />
      <circle cx="80" cy="60" r="15" fill="var(--ink)" />
      <path d="M80 60 104 34" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 22h18M20 30h12M124 96h16M130 88h10" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M132 20l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.6" />
    </svg>
  );
}

function CountryArt() {
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" role="presentation">
      <rect width="160" height="120" fill="var(--sky)" />
      <g stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M22 40l16-16 22 3 9 15 18 1 7 18-11 9-5 20-18 11-16-11-5-19-17-7Z" fill="var(--mint)" />
        <path d="M98 34l16-11 16 7 4 15-11 11-3 17-11 11-15-11 4-16-11-9Z" fill="var(--paper)" />
        <path d="M118 74l19-11 20 6 6 16-12 18-22 3-14-12Z" fill="var(--coral)" />
      </g>
      <path d="M40 62c22 14 44 16 74 6" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeDasharray="5 5" strokeLinecap="round" />
      <g stroke="var(--ink)" strokeWidth="2">
        <path d="M114 52c0-6 5-10 10-10s10 4 10 10c0 7-10 16-10 16s-10-9-10-16Z" fill="var(--pink)" />
        <circle cx="124" cy="52" r="3.4" fill="var(--white)" />
      </g>
      <circle cx="40" cy="62" r="4" fill="var(--ink)" />
    </svg>
  );
}

function VisualArt() {
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" role="presentation">
      <rect width="160" height="120" fill="var(--lavender)" />
      <g stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round">
        <rect x="26" y="30" width="52" height="60" fill="var(--white)" />
        <rect x="84" y="32" width="52" height="60" fill="var(--pink)" />
      </g>
      <g stroke="var(--ink)" strokeWidth="2" fill="none">
        <circle cx="46" cy="52" r="7" fill="var(--mint)" />
        <path d="M34 78c6-10 12-12 18-6s10 4 16-2" />
      </g>
      <g stroke="var(--ink)" strokeWidth="2" fill="none">
        <path d="M94 50h32M94 60h32M94 70h22" strokeLinecap="round" />
      </g>
      <text x="80" y="72" textAnchor="middle" fontFamily="var(--font-display)" fontSize="34" fill="var(--ink)">?</text>
    </svg>
  );
}

// Generic tile art. Five distinct compositions rather than one shape with a
// different letter in it — 50 catalog games all sharing a single silhouette is
// what made the grid look like wallpaper. Same flat black/grey language
// throughout: no rounding, no tilts, no colour.
function IconArt({ bg = 'var(--paper)', icon = '?', accent = 'var(--lime)', variant = 0 }) {
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" role="presentation">
      <rect width="160" height="120" fill={bg} />

      {variant === 0 && (
        <>
          <path d="M18 24h124M18 94h124" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 8" opacity="0.45" />
          <g stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round">
            <rect x="34" y="24" width="92" height="72" fill="var(--white)" />
            <circle cx="118" cy="32" r="17" fill={accent} />
          </g>
          <text x="80" y="72" textAnchor="middle" fontFamily="var(--font-display)" fontSize="38" fill="var(--ink)">{icon}</text>
          <circle cx="44" cy="84" r="5" fill={accent} stroke="var(--ink)" strokeWidth="2" />
          <circle cx="118" cy="84" r="5" fill="var(--ink)" />
        </>
      )}

      {variant === 1 && (
        <>
          <circle cx="80" cy="60" r="52" fill="none" stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 7" opacity="0.45" />
          <circle cx="80" cy="60" r="38" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.4" />
          <circle cx="80" cy="60" r="26" fill={accent} stroke="var(--ink)" strokeWidth="2" />
          <text x="80" y="70" textAnchor="middle" fontFamily="var(--font-display)" fontSize="26" fill="var(--ink)">{icon}</text>
          <circle cx="22" cy="26" r="5" fill="var(--ink)" />
          <circle cx="138" cy="96" r="5" fill="var(--ink)" />
        </>
      )}

      {variant === 2 && (
        <>
          <rect x="30" y="20" width="100" height="80" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.4" />
          <g stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round">
            <path d="M44 40h58M44 54h72M44 68h44" />
          </g>
          <rect x="94" y="76" width="24" height="16" fill={accent} stroke="var(--ink)" strokeWidth="2" />
          <text x="46" y="90" textAnchor="start" fontFamily="var(--font-display)" fontSize="17" fill="var(--ink)">{icon}</text>
        </>
      )}

      {variant === 3 && (
        <>
          <g stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round">
            <path d="M80 22 118 66 42 66Z" fill="var(--white)" />
            <rect x="30" y="76" width="40" height="26" fill={accent} />
            <rect x="78" y="76" width="52" height="26" fill="var(--white)" />
          </g>
          <text x="80" y="62" textAnchor="middle" fontFamily="var(--font-display)" fontSize="23" fill="var(--ink)">{icon}</text>
        </>
      )}

      {variant === 4 && (
        <>
          <g stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round">
            <rect x="30" y="24" width="44" height="32" fill="var(--white)" />
            <rect x="82" y="24" width="48" height="32" fill={accent} />
            <rect x="30" y="64" width="44" height="32" fill="var(--white)" />
            <rect x="82" y="64" width="48" height="32" fill="var(--white)" />
          </g>
          <text x="106" y="48" textAnchor="middle" fontFamily="var(--font-display)" fontSize="22" fill="var(--ink)">{icon}</text>
        </>
      )}
    </svg>
  );
}

// 3D arena (single-player Orb Arena): orb over a perspective grid floor.
// Charcoal + grey so the thumbnail matches the flat black/grey site.
function ArenaArt() {
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" role="presentation">
      <rect width="160" height="120" fill="#141414" />
      <g stroke="#3d3d3d" strokeWidth="1" opacity="0.75">
        <path d="M0 88h160M0 100h160M0 112h160" />
        <path d="M80 80 14 120M80 80 46 120M80 80 80 120M80 80 114 120M80 80 146 120" />
      </g>
      <circle cx="80" cy="46" r="21" fill="#e0e0e0" opacity="0.18" />
      <circle cx="80" cy="46" r="14" fill="#262626" stroke="#dcdcdc" strokeWidth="2.2" />
      <circle cx="74" cy="40" r="4" fill="#ffffff" opacity="0.85" />
      <rect x="34" y="66" width="13" height="24" fill="#c9c9c9" stroke="#141414" strokeWidth="1.8" />
      <path d="M40.5 78 40.5 68" stroke="#141414" strokeWidth="1.4" />
      <circle cx="126" cy="30" r="2.4" fill="#9a9a9a" opacity="0.7" />
      <circle cx="140" cy="52" r="1.8" fill="#9a9a9a" opacity="0.5" />
      <circle cx="22" cy="34" r="1.8" fill="#c9c9c9" opacity="0.5" />
    </svg>
  );
}

// Multiplayer arena: two avatars linked by a signal, competing for orbs.
function ArenaOnlineArt() {
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" role="presentation">
      <rect width="160" height="120" fill="#141414" />
      <g stroke="#3d3d3d" strokeWidth="1" opacity="0.6">
        <path d="M0 96h160M0 108h160" />
        <path d="M40 92 20 120M80 92 80 120M120 92 140 120" />
      </g>
      <path d="M52 62c14-16 42-16 56 0" fill="none" stroke="#dcdcdc" strokeWidth="1.8" strokeDasharray="4 4" opacity="0.85" />
      <circle cx="80" cy="50" r="3" fill="#dcdcdc" />
      <circle cx="80" cy="50" r="7" fill="none" stroke="#dcdcdc" strokeWidth="1.2" opacity="0.5" />
      <rect x="40" y="62" width="14" height="26" fill="#c9c9c9" stroke="#141414" strokeWidth="1.8" />
      <rect x="106" y="62" width="14" height="26" fill="#dcdcdc" stroke="#141414" strokeWidth="1.8" />
      <circle cx="47" cy="56" r="4.5" fill="#262626" stroke="#dcdcdc" strokeWidth="1.6" />
      <circle cx="113" cy="56" r="4.5" fill="#262626" stroke="#dcdcdc" strokeWidth="1.6" />
      <circle cx="80" cy="86" r="6" fill="#262626" stroke="#dcdcdc" strokeWidth="1.8" />
      <circle cx="80" cy="86" r="9" fill="#e0e0e0" opacity="0.14" />
    </svg>
  );
}

// 2D arcade (Phaser): flat platforms, a runner and collectible orbs.
function TwoDArt() {
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" role="presentation">
      <rect width="160" height="120" fill="#141414" />
      <rect x="0" y="92" width="160" height="28" fill="#242424" />
      <rect x="0" y="92" width="160" height="4" fill="#3d3d3d" />
      <rect x="26" y="66" width="42" height="10" fill="#242424" stroke="#3d3d3d" strokeWidth="1.4" />
      <rect x="96" y="52" width="42" height="10" fill="#242424" stroke="#3d3d3d" strokeWidth="1.4" />
      <rect x="40" y="76" width="16" height="16" fill="#c9c9c9" stroke="#141414" strokeWidth="1.6" />
      <circle cx="46" cy="82" r="1.8" fill="#141414" />
      <circle cx="52" cy="82" r="1.8" fill="#141414" />
      <circle cx="112" cy="40" r="6" fill="#262626" stroke="#dcdcdc" strokeWidth="2" />
      <circle cx="112" cy="40" r="9.5" fill="#e0e0e0" opacity="0.16" />
      <circle cx="60" cy="56" r="4.5" fill="#262626" stroke="#9a9a9a" strokeWidth="1.8" />
      <circle cx="140" cy="80" r="4" fill="#262626" stroke="#6b6b6b" strokeWidth="1.6" />
    </svg>
  );
}

function FallbackArt() {
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" role="presentation">
      <rect width="160" height="120" fill="var(--paper)" />
      <g stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round">
        <path d="M80 34 116 52 80 70 44 52Z" fill="var(--lime)" />
        <path d="M44 52v34l36 18V70Z" fill="var(--white)" />
        <path d="M116 52v34l-36 18V70Z" fill="var(--paper)" />
      </g>
      <text x="80" y="60" textAnchor="middle" fontFamily="var(--font-display)" fontSize="20" fill="var(--ink)">?</text>
    </svg>
  );
}

// `variant` picks one of five compositions so neighbouring tiles in the grid
// rarely repeat the same silhouette.
const artByType = {
  reaction: ReactionArt,
  country: CountryArt,
  visual: VisualArt,
  test: () => <IconArt bg="var(--pink)" icon="✓" accent="var(--lime)" variant={1} />,
  puzzle: () => <IconArt bg="var(--lavender)" icon="#" accent="var(--sky)" variant={4} />,
  language: () => <IconArt bg="var(--mint)" icon="あ" accent="var(--pink)" variant={2} />,
  audio: () => <IconArt bg="var(--sky)" icon="♫" accent="var(--lime)" variant={0} />,
  ai: () => <IconArt bg="var(--lavender)" icon="AI" accent="var(--coral)" variant={3} />,
  map: () => <IconArt bg="var(--sky)" icon="⌖" accent="var(--lime)" variant={1} />,
  strategy: () => <IconArt bg="var(--paper)" icon="♞" accent="var(--lavender)" variant={4} />,
  brand: () => <IconArt bg="var(--coral)" icon="B" accent="var(--white)" variant={2} />,
  drawing: () => <IconArt bg="var(--pink)" icon="✎" accent="var(--mint)" variant={0} />,
  flag: () => <IconArt bg="var(--mint)" icon="⚑" accent="var(--coral)" variant={3} />,
  typing: () => <IconArt bg="var(--paper)" icon="W" accent="var(--lime)" variant={2} />,
  memory: () => <IconArt bg="var(--lavender)" icon="▦" accent="var(--pink)" variant={4} />,
  versus: () => <IconArt bg="var(--lime)" icon="VS" accent="var(--white)" variant={1} />,
  word: () => <IconArt bg="var(--mint)" icon="R" accent="var(--sky)" variant={3} />,
  arena: ArenaArt,
  'arena-online': ArenaOnlineArt,
  '2d': TwoDArt,
};

export default function GameArt({ type, thumb }) {
  const Art = artByType[type] || FallbackArt;
  return (
    <div className={`wb-game-art wb-game-art-${type || 'unknown'}`}>
      <Art />
      {thumb && (
        <img
          className="wb-game-photo"
          src={thumb}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
      )}
    </div>
  );
}
