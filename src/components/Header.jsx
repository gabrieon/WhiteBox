import Logo from './Logo.jsx';
import { Sparkle } from './Doodles.jsx';

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.6" />
      <path d="m16 16 5 5" />
    </svg>
  );
}

export default function Header({ search, onSearch, onNavigate, onOpenCreate }) {
  return (
    <header className="wb-topbar">
      <button type="button" className="wb-brand" onClick={onNavigate} aria-label="WhiteBox home">
        <Logo />
      </button>

      <div className="wb-search">
        <SearchIcon />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search games…"
          aria-label="Search games"
        />
        {search && (
          <button type="button" className="wb-search-clear" onClick={() => onSearch('')} aria-label="Clear search">
            ×
          </button>
        )}
      </div>

      <nav className="wb-topnav" aria-label="Primary">
        <button type="button" className="wb-topnav-link" onClick={onNavigate}>
          Discover
        </button>
        <button type="button" className="wb-topnav-link wb-topnav-create" onClick={onOpenCreate}>
          <Sparkle size={14} /> Create
        </button>
      </nav>

      <div className="wb-account" aria-label="Account actions">
        <button className="wb-account-button" type="button" disabled title="Sign in is not available yet">
          Sign in
        </button>
        <button className="wb-account-button wb-account-primary" type="button" disabled title="Player accounts are not available yet">
          Sign up
        </button>
      </div>
    </header>
  );
}
