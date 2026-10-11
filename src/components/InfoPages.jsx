import { Star, Sparkle, ArrowScribble } from './Doodles.jsx';

function CreatorBox() {
  return (
    <svg className="wb-create-art" viewBox="0 0 200 160" role="img" aria-label="A closed box waiting to be opened">
      <g stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round">
        <path d="M100 26 152 50 100 74 48 50Z" fill="var(--lime)" />
        <path d="M48 50v58l52 24V74Z" fill="var(--white)" />
        <path d="M152 50v58l-52 24V74Z" fill="var(--paper)" />
        <path d="M100 74v58" fill="none" />
      </g>
      <g transform="rotate(-8 78 96)">
        <rect x="58" y="86" width="44" height="20" rx="4" fill="var(--pink)" stroke="var(--ink)" strokeWidth="2" />
        <text x="80" y="100" textAnchor="middle" fontFamily="var(--font-hand)" fontSize="11" fill="var(--ink)">soon…</text>
      </g>
      <g stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M100 12v-6M70 20l-5-5M130 20l5-5" />
      </g>
      <path d="M160 96l4 8 9 1-6 6 1 9-8-4-8 4 1-9-6-6 9-1Z" fill="var(--coral)" stroke="var(--ink)" strokeWidth="1.6" />
    </svg>
  );
}

const plannedSteps = [
  { title: 'Describe it', body: 'Tell the creator what your game is in plain words.' },
  { title: 'An AI agent builds it', body: 'A coding agent turns the description into a real, playable module.' },
  { title: 'Preview & test', body: 'Play it in the browser and iterate until it feels right.' },
  { title: 'Publish', body: 'Ship it to the WhiteBox library for everyone to play.' },
];

export function CreatePage({ onBack }) {
  return (
    <section className="wb-page wb-page-create">
      <Star className="wb-page-doodle wb-page-doodle-one" size={26} />
      <Sparkle className="wb-page-doodle wb-page-doodle-two" size={22} />

      <div className="wb-page-copy">
        <p className="wb-section-kicker">whitebox studio</p>
        <h1 className="wb-page-title">
          Create Something <span className="wb-hero-highlight">Weird.</span>
        </h1>
        <p className="wb-page-lede">
          WhiteBox is building a visual game creator where you describe a game and an
          AI coding agent builds it for you — then you preview, test and publish it,
          all in the browser.
        </p>

        <div className="wb-create-status" role="status">
          <span className="wb-sticker wb-sticker-lime">in development</span>
          <p>
            The creator is not available yet. Nothing below is live — there is no prompt
            box, no generation and no publishing until the real workflow ships.
          </p>
        </div>

        <ol className="wb-create-steps">
          {plannedSteps.map((step, index) => (
            <li className="wb-create-step" key={step.title}>
              <span className="wb-create-step-num" aria-hidden="true">{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
              <span className="wb-create-step-tag">planned</span>
            </li>
          ))}
        </ol>

        <p className="wb-page-hand">
          <ArrowScribble width={56} height={36} />
          meanwhile, go play something
        </p>
        <button type="button" className="wb-btn wb-btn-primary" onClick={onBack}>
          Back to games
        </button>
      </div>

      <div className="wb-page-visual">
        <CreatorBox />
      </div>
    </section>
  );
}

export function AboutPage({ onBack }) {
  return (
    <section className="wb-page wb-page-about">
      <div className="wb-page-copy">
        <p className="wb-section-kicker">about whitebox</p>
        <h1 className="wb-page-title">
          A little room <span className="wb-hero-highlight">to play.</span>
        </h1>
        <p className="wb-page-lede">
          WhiteBox is a browser-based home for quick games, curious challenges and
          friendly competition. No installs, no accounts required — just open the box
          and see what falls out.
        </p>
        <p className="wb-page-lede">
          Every game keeps its own look and feel. The stickers and doodles belong to the
          platform; the games inside are free to be whatever they want to be.
        </p>
        <button type="button" className="wb-btn wb-btn-primary" onClick={onBack}>
          Explore games
        </button>
      </div>
    </section>
  );
}
