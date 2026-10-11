export default function Logo({ size = 30, showWordmark = true }) {
  return (
    <span className="wb-logo">
      <svg className="wb-logo-mark" width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
        {/* isometric box: lime top, white front, paper side */}
        <path d="M17 3.5 30 10 17 16.5 4 10Z" fill="var(--lime)" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M4 10v13.5L17 30V16.5Z" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M30 10v13.5L17 30V16.5Z" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M11 6.8 24 13.3" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="27.5" cy="6" r="2.4" fill="var(--coral)" stroke="var(--ink)" strokeWidth="1.2" />
      </svg>
      {showWordmark && <span className="wb-logo-word">WhiteBox</span>}
    </span>
  );
}
