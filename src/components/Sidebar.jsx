import { Star } from './Doodles.jsx';

const icons = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-7h6v7" /></>,
  explore: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5M9 13l2-4 4-2-2 4-4 2Z" /></>,
  heart: <path d="M20.8 8.7c0 4.1-8.8 10-8.8 10s-8.8-5.9-8.8-10A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
};

function SideIcon({ name }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

export default function Sidebar({ section, selectedCategory, categories, onNavigate, onCategory, onOpenCreate, onOpenAbout }) {
  const primary = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'explore', label: 'Explore', icon: 'explore' },
  ];
  const library = [
    { id: 'favorites', label: 'Favorites', icon: 'heart' },
    { id: 'recent', label: 'Recently Played', icon: 'clock' },
  ];

  return (
    <aside className="wb-sidebar" aria-label="Game navigation">
      <div className="wb-side-group">
        {primary.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            className={`wb-side-link${section === id ? ' is-active' : ''}`}
            onClick={() => onNavigate(id)}
            aria-current={section === id ? 'page' : undefined}
          >
            <SideIcon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <p className="wb-side-label">Categories</p>
      <div className="wb-side-group">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={`wb-side-link wb-side-category${section === 'categories' && selectedCategory === category ? ' is-active' : ''}`}
            onClick={() => onCategory(category)}
            aria-current={section === 'categories' && selectedCategory === category ? 'page' : undefined}
          >
            <span className="wb-side-dot" aria-hidden="true" />
            <span>{category}</span>
          </button>
        ))}
      </div>

      <p className="wb-side-label">Your library</p>
      <div className="wb-side-group">
        {library.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            className={`wb-side-link${section === id ? ' is-active' : ''}`}
            onClick={() => onNavigate(id)}
            aria-current={section === id ? 'page' : undefined}
          >
            <SideIcon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="wb-side-group wb-side-footer">
        <button type="button" className="wb-side-link wb-side-create" onClick={onOpenCreate}>
          <SideIcon name="plus" />
          <span>Create Games</span>
        </button>
        <button type="button" className="wb-side-link" onClick={onOpenAbout}>
          <span className="wb-side-info" aria-hidden="true">i</span>
          <span>About</span>
        </button>
      </div>

      <div className="wb-side-note">
        <Star size={16} />
        <p>your next favourite game is in the box somewhere…</p>
      </div>
    </aside>
  );
}
