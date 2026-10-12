import Logo from './Logo.jsx';
import AccountMenu from './AccountMenu.jsx';

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.6" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function Header({ search, onSearch, onNavigate, onExplore, activeView, onOpenCreate }) {
  return (
    <header className="wb-topbar">
      <div className="wb-topbar-inner">
        <button type="button" className="wb-brand" onClick={onNavigate} aria-label="WhiteBox home">
          <Logo />
        </button>

        <nav className="wb-topnav" aria-label="Primary navigation">
          <button
            type="button"
            className={`wb-topnav-link${activeView === 'home' ? ' is-active' : ''}`}
            onClick={onNavigate}
            aria-current={activeView === 'home' ? 'page' : undefined}
          >
            Discover
          </button>
          <button
            type="button"
            className={`wb-topnav-link${activeView === 'explore' ? ' is-active' : ''}`}
            onClick={onExplore}
            aria-current={activeView === 'explore' ? 'page' : undefined}
          >
            Browse
          </button>
        </nav>

        <label className="wb-search">
          <SearchIcon />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search games, genres, or challenges"
            aria-label="Search games"
          />
          {search && (
            <button type="button" className="wb-search-clear" onClick={() => onSearch('')} aria-label="Clear search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </label>

        <div className="wb-header-actions">
          <AccountMenu />
          <button type="button" className="wb-create-button" onClick={onOpenCreate}>
            <PlusIcon />
            <span>Create</span>
          </button>
        </div>
      </div>
    </header>
  );
}
