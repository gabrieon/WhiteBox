import GameArt from './GameArt.jsx';

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m8 5 12 7-12 7Z" />
    </svg>
  );
}

export default function Hero({ onExplore, onCreate }) {
  return (
    <section className="wb-hero">
      <div className="wb-hero-copy">
        <p className="wb-hero-eyebrow">
          <span className="wb-live-dot" aria-hidden="true" />
          PLAY IN YOUR BROWSER
        </p>
        <h1 className="wb-hero-title">
          Find your next<br />
          <span>favorite game.</span>
        </h1>
        <p className="wb-hero-note">
          Jump into quick challenges, competitive rooms, and creator-made games with no download required.
        </p>
        <div className="wb-hero-actions">
          <button type="button" className="wb-btn wb-btn-primary" onClick={onExplore}>
            <PlayIcon />
            Explore games
          </button>
          <button type="button" className="wb-btn wb-btn-secondary" onClick={onCreate}>
            Create with WhiteBox
          </button>
        </div>
      </div>

      <div className="wb-hero-showcase" aria-label="Featured game: Orb Arena Online">
        <div className="wb-hero-showcase-art">
          <GameArt type="arena-online" />
        </div>
        <div className="wb-hero-showcase-shade" aria-hidden="true" />
        <div className="wb-showcase-top">
          <span className="wb-showcase-live"><span className="wb-live-dot" aria-hidden="true" /> Live now</span>
        </div>
        <div className="wb-showcase-content">
          <p>FEATURED ROOM</p>
          <h2>Orb Arena Online</h2>
          <span>Race, collect, and top the board.</span>
          <button type="button" className="wb-showcase-play" onClick={onExplore}>
            <PlayIcon />
            View game
          </button>
        </div>
      </div>
    </section>
  );
}
