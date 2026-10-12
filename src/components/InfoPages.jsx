function CreatorBox() {
  return (
    <svg className="wb-create-art" viewBox="0 0 220 180" role="img" aria-label="An abstract game room illustration">
      <rect x="20" y="22" width="180" height="136" rx="20" fill="#2b2b2b" stroke="var(--line)" strokeWidth="2" />
      <rect x="39" y="43" width="142" height="20" rx="7" fill="var(--surface-raised)" />
      <circle cx="53" cy="53" r="4" fill="var(--coral)" />
      <circle cx="66" cy="53" r="4" fill="var(--lime)" />
      <rect x="39" y="76" width="68" height="62" rx="11" fill="var(--lavender)" opacity="0.92" />
      <rect x="118" y="76" width="63" height="27" rx="9" fill="var(--sky)" opacity="0.92" />
      <rect x="118" y="112" width="63" height="26" rx="9" fill="var(--mint)" opacity="0.92" />
      <path d="M56 120 76 98l13 13 12-11" fill="none" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M133 89h33M133 125h30" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />
      <circle cx="186" cy="31" r="12" fill="var(--lime)" />
      <path d="M182 31h8M186 27v8" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const plannedSteps = [
  { title: 'Describe your idea', body: 'Start with a game loop, a challenge, or a room you want people to share.' },
  { title: 'Build and test', body: 'Use the studio workflow to prototype it in the browser.' },
  { title: 'Publish a room', body: 'When it is ready, share it with the WhiteBox community.' },
];

export function CreatePage({ onBack }) {
  return (
    <section className="wb-page wb-page-create">
      <div className="wb-page-copy">
        <p className="wb-page-eyebrow">WHITEBOX STUDIO · IN DEVELOPMENT</p>
        <h1 className="wb-page-title">Make the next game people keep coming back to.</h1>
        <p className="wb-page-lede">
          WhiteBox Studio is the planned creation layer for browser-first games: design a concept, test it quickly, and publish a room for players.
        </p>

        <div className="wb-create-status" role="status">
          <span className="wb-live-dot" aria-hidden="true" />
          <div>
            <strong>Studio is being built</strong>
            <p>The creator is not available yet. This page is a preview of the workflow, not a live publishing tool.</p>
          </div>
        </div>

        <ol className="wb-create-steps">
          {plannedSteps.map((step, index) => (
            <li className="wb-create-step" key={step.title}>
              <span className="wb-create-step-num" aria-hidden="true">0{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <button type="button" className="wb-btn wb-btn-primary" onClick={onBack}>Explore games</button>
      </div>

      <aside className="wb-studio-preview" aria-label="Studio preview">
        <CreatorBox />
        <div className="wb-studio-preview-copy">
          <span className="wb-studio-preview-label">CONCEPT CARD</span>
          <strong>Map Pin Duel</strong>
          <span>1v1 · Geography · Fast rounds</span>
        </div>
      </aside>
    </section>
  );
}

export function AboutPage({ onBack }) {
  return (
    <section className="wb-page wb-page-about">
      <div className="wb-page-copy">
        <p className="wb-page-eyebrow">ABOUT WHITEBOX</p>
        <h1 className="wb-page-title">A game library built for instant play.</h1>
        <p className="wb-page-lede">
          WhiteBox is a browser-first home for quick challenges, competitive rooms, and creator-made games. Open a tab, choose a game, and get playing.
        </p>
        <p className="wb-page-lede">
          The platform is still growing. Today, you can explore the first playable games and the catalog of rooms in development.
        </p>
        <div className="wb-about-values">
          <span>NO DOWNLOADS</span>
          <span>QUICK TO PLAY</span>
          <span>BUILT TO SHARE</span>
        </div>
        <button type="button" className="wb-btn wb-btn-primary" onClick={onBack}>Explore games</button>
      </div>
    </section>
  );
}
