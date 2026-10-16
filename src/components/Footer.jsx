import { useEffect, useState } from 'react';
import WhiteBoxMark from './WhiteBoxMark.jsx';
import { fetchCreatedGames } from '../sdk/games/api.js';
import { listGames } from '../games/registry.js';

// Site footer.
//
// Three things live here: identity and contact, navigation that is derived from
// the actual library rather than hardcoded, and a live count of what exists.
//
// The category links are built from the real category list on purpose. A
// hand-maintained footer list goes stale the moment a game is added — it is the
// single most common way a footer starts advertising pages that 404.

// Contact is a build-time constant rather than fetched: it changes about never,
// and a wrong address in a fetch is worse than one in the source.
const CONTACT_EMAIL = 'manoj.kumar10121977@gmail.com';

export default function Footer({ onNavigate, categories = [] }) {
  // Public read, so this renders for signed-out visitors too.
  //
  // The column always renders, even before the fetch lands or when it fails.
  // The alternative — mounting the column only on success — shifts the whole
  // footer grid sideways a beat after load, and leaves a two-column footer on
  // a network failure. Placeholders are honest about not knowing yet.
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchCreatedGames()
      .then((created) => {
        if (!alive) return;
        setStats({ builtIn: listGames().length, created: created.length });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const total = stats ? stats.builtIn + stats.created : null;

  return (
    <footer className="wb-footer">
      <div className="wb-footer-rule" aria-hidden="true" />

      <div className="wb-footer-grid">
        <div className="wb-footer-brand">
          <a href="#/" className="wb-footer-logo">
            <WhiteBoxMark size={22} />
            <span>WhiteBox</span>
          </a>
          <p className="wb-footer-tag">
            Small games, built to be played. Pick one, or make your own.
          </p>
          <a className="wb-footer-mail" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </div>

        <nav className="wb-footer-col" aria-label="Games">
          <h4>Games</h4>
          <ul>
            <li><a href="#/">Browse all</a></li>
            {categories.slice(0, 6).map((c) => (
              <li key={c}>
                <button type="button" className="wb-footer-link" onClick={() => onNavigate?.(c)}>
                  {c}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="wb-footer-col" aria-label="Play">
          <h4>Play</h4>
          <ul>
            <li><a href="#/">Library</a></li>
            <li><button type="button" className="wb-footer-link" onClick={() => onNavigate?.('create')}>Create a game</button></li>
            {listGames().map((game) => (
              <li key={game.id}>
                <a href={`#/play/${game.id}`}>{game.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="wb-footer-col" aria-busy={stats ? undefined : true}>
            <h4>Library</h4>
            <p className="wb-footer-stat">
              <strong>{total ?? '–'}</strong> games
            </p>
            <p className="wb-footer-stat">
              <strong>{stats?.builtIn ?? '–'}</strong> built in
            </p>
            <p className="wb-footer-stat">
              <strong>{stats?.created ?? '–'}</strong> made by players
            </p>
          </div>
      </div>

      <div className="wb-footer-base">
        <p>
          Word definitions from{' '}
          <a href="https://en.wiktionary.org" target="_blank" rel="noreferrer noopener">
            Wiktionary
          </a>{' '}
          (CC BY-SA).
        </p>
        <p>© {new Date().getFullYear()} WhiteBox</p>
      </div>
    </footer>
  );
}