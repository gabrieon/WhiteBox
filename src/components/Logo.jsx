export default function Logo({ size = 30, showWordmark = true }) {
  return (
    <span className="wb-logo">
      <svg className="wb-logo-mark" width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
        <path d="M17 3.5 30 10 17 16.5 4 10Z" fill="var(--lime)" stroke="#0c0c0c" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M4 10v13.5L17 30V16.5Z" fill="var(--white)" stroke="#0c0c0c" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M30 10v13.5L17 30V16.5Z" fill="#2e2e2e" stroke="#0c0c0c" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M11 6.8 24 13.3" stroke="#0c0c0c" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="27.5" cy="6" r="2.4" fill="var(--coral)" stroke="#0c0c0c" strokeWidth="1.2" />
      </svg>
      {showWordmark && <span className="wb-logo-word">WhiteBox</span>}
    </span>
  );
}
