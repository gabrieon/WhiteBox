import { ArrowScribble, Sparkle, Star, Smiley, InkSplat, Scribble } from './Doodles.jsx';

function BoxBurst() {
  return (
    <svg className="wb-hero-art" viewBox="0 0 320 260" role="img" aria-label="An open box with games bursting out">
      {/* burst rays */}
      <g stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.85">
        <path d="M160 96 150 40M186 100l26-44M132 102 96 62M206 116l44-24M112 118 66 96" />
      </g>
      {/* floating game shapes */}
      <g stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M96 44c10-6 24-6 32 0 6 5 6 14 0 19-9 6-23 6-32 0-6-5-6-14 0-19Z" fill="var(--coral)" />
        <circle cx="104" cy="53" r="2.6" fill="var(--ink)" stroke="none" />
        <circle cx="120" cy="53" r="2.6" fill="var(--ink)" stroke="none" />
        <circle cx="232" cy="66" r="20" fill="var(--mint)" />
        <path d="M210 70c14 8 32 8 44-2" fill="none" strokeWidth="2.4" />
        <path d="M62 96c8-4 18-2 22 5 4 7 0 15-8 17-9 2-18-2-20-9-2-6 1-11 6-13Z" fill="var(--lavender)" />
        <circle cx="70" cy="104" r="2" fill="var(--ink)" stroke="none" />
        <circle cx="78" cy="105" r="2" fill="var(--ink)" stroke="none" />
        <rect x="246" y="104" width="34" height="24" rx="4" fill="var(--sky)" transform="rotate(8 263 116)" />
        <path d="M160 30l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z" fill="var(--lime)" />
      </g>
      {/* open box */}
      <g stroke="var(--ink)" strokeWidth="2.6" strokeLinejoin="round">
        <path d="M96 150 60 128l38-16 34 20Z" fill="var(--paper)" />
        <path d="M224 150l36-22-38-16-34 20Z" fill="var(--paper)" />
        <path d="M96 150h128v74l-64 22-64-22Z" fill="var(--white)" />
        <path d="M96 150 60 128v64l36 22Z" fill="var(--lime)" />
        <path d="M224 150l36-22v64l-36 22Z" fill="var(--paper)" />
        <path d="M96 150l64 22 64-22" fill="none" />
        <path d="M160 172v74" fill="none" />
      </g>
      {/* box face sticker */}
      <g transform="rotate(-6 132 196)">
        <rect x="108" y="184" width="52" height="24" rx="4" fill="var(--pink)" stroke="var(--ink)" strokeWidth="2" />
        <text x="134" y="200" textAnchor="middle" fontFamily="var(--font-hand)" fontSize="12" fill="var(--ink)">weird!</text>
      </g>
      {/* ink splat + smiley */}
      <g fill="var(--ink)"><path d="M250 176c6-1 10 3 10 8 0 5-4 8-9 8-6 0-10-3-10-8 0-4 4-7 9-8Z" /><circle cx="266" cy="172" r="2.4" /><circle cx="240" cy="192" r="2" /></g>
      <g stroke="var(--ink)" strokeWidth="2" fill="none">
        <circle cx="52" cy="180" r="13" fill="var(--white)" />
        <path d="M47 177v3M57 177v3M47 184c3 3 7 3 10 0" />
      </g>
    </svg>
  );
}

export default function Hero({ onExplore, onCreate }) {
  return (
    <section className="wb-hero">
      <Star className="wb-hero-doodle wb-hero-star" size={30} />
      <Sparkle className="wb-hero-doodle wb-hero-sparkle" size={24} />
      <Scribble className="wb-hero-doodle wb-hero-scribble" />
      <InkSplat className="wb-hero-doodle wb-hero-splat" size={30} />
      <Smiley className="wb-hero-doodle wb-hero-smiley" size={34} />

      <div className="wb-hero-copy">
        <p className="wb-hero-kicker">
          <span className="wb-sticker wb-sticker-lime">a browser arcade</span>
          <span className="wb-sticker">est. whenever</span>
        </p>
        <h1 className="wb-hero-title">
          OPEN THE<br />
          <span className="wb-hero-highlight">BOX.</span>
        </h1>
        <p className="wb-hero-tagline">PLAY. CREATE. GET WEIRD.</p>
        <p className="wb-hero-note">
          Unusual games, curious challenges and friendly competition — all running
          right here in your browser. No downloads, no nonsense.
        </p>
        <div className="wb-hero-actions">
          <button type="button" className="wb-btn wb-btn-primary" onClick={onExplore}>
            Explore Games
          </button>
          <button type="button" className="wb-btn wb-btn-secondary" onClick={onCreate}>
            Make Something
          </button>
        </div>
        <p className="wb-hero-hand wb-hero-hand-left">
          <ArrowScribble width={62} height={40} />
          free to play, forever
        </p>
      </div>

      <div className="wb-hero-visual">
        <BoxBurst />
        <span className="wb-hero-hand wb-hero-hand-right">certified weird ✓</span>
        <span className="wb-tape wb-tape-one" aria-hidden="true" />
        <span className="wb-tape wb-tape-two" aria-hidden="true" />
      </div>
    </section>
  );
}
