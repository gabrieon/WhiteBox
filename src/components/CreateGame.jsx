import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../sdk/auth/authContext.js';
import { fetchCreatedGames, createGame, deleteGame } from '../sdk/games/api.js';
import GameArt from './GameArt.jsx';

// The Create screen.
//
// A created game is a catalogue entry today: title, description, tags and an
// artwork choice, stored in the database and visible to everyone. It is NOT
// playable yet — there is no engine attached — so the library renders it with a
// "Soon" badge rather than a Play button. That honesty matters more than making
// the button look finished.
//
// Everything the server enforces is enforced here too, so the player gets an
// instant, specific message instead of a round-trip that fails on a length
// rule. The server still re-checks all of it; this is convenience, not security.

// Must match ART_TYPES in worker/src/games.js and artByType in GameArt.jsx.
const ART_CHOICES = [
  { id: 'reaction', label: 'Reaction' },
  { id: 'puzzle', label: 'Puzzle' },
  { id: 'memory', label: 'Memory' },
  { id: 'versus', label: 'Head to head' },
  { id: 'word', label: 'Word game' },
  { id: 'map', label: 'Map' },
  { id: 'country', label: 'Geography' },
  { id: 'flag', label: 'Flags' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'typing', label: 'Typing' },
  { id: 'drawing', label: 'Drawing' },
  { id: 'audio', label: 'Audio' },
  { id: 'language', label: 'Language' },
  { id: 'visual', label: 'Visual' },
  { id: 'brand', label: 'Brands' },
  { id: 'test', label: 'Quiz' },
  { id: 'ai', label: 'AI / tech' },
  { id: 'arena', label: '3D arena' },
  { id: 'arena-online', label: 'Multiplayer arena' },
  { id: '2d', label: '2D arcade' },
];

const MODES = ['Solo', '1v1', 'Party', 'Ranked'];

const MAX_TITLE = 60;
const MAX_DESCRIPTION = 280;
const MAX_TAGS = 4;
const MAX_TAG_LEN = 24;

// Mirrors cleanText/cleanCategories in worker/src/games.js. Control characters
// are stripped here too, so the character count the player sees is the count the
// server will measure.
function cleanText(value) {
  let out = '';
  for (const ch of String(value || '')) {
    const code = ch.codePointAt(0);
    if (code < 32 || code === 127) continue;
    out += ch;
  }
  return out.trim();
}

function parseTags(raw) {
  const seen = new Set();
  const out = [];
  for (const part of String(raw || '').split(',')) {
    const tag = cleanText(part);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

// Server reasons -> messages the player can act on.
const ERRORS = {
  title_required: 'Give your game a name.',
  title_invalid: 'Give your game a name.',
  title_too_long: `Keep the name under ${MAX_TITLE} characters.`,
  description_required: 'Add a short description so players know what it is.',
  description_too_long: `Keep the description under ${MAX_DESCRIPTION} characters.`,
  category_too_long: `Each tag must be under ${MAX_TAG_LEN} characters.`,
  too_many_categories: `Use at most ${MAX_TAGS} tags.`,
  type_invalid: 'Pick an artwork style.',
  mode_invalid: 'Pick a play mode.',
  game_limit_reached: 'You have reached the limit of games you can publish.',
  storage_not_configured: 'Game publishing is not available right now.',
  unauthorized: 'Your session expired. Sign in again and retry.',
  origin_not_allowed: 'This site is not allowed to publish games.',
};

function describeError(err) {
  const reason = err?.message || err?.error || 'unknown_error';
  return ERRORS[reason] || `Could not save the game (${reason}).`;
}

// Stable empty array so the derived `mine` keeps its identity across renders
// while nothing is loaded.
const NO_GAMES = [];

export default function CreateGame({ onCreated, onDeleted, onBack }) {
  const { isSignedIn, profile } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [type, setType] = useState('puzzle');
  const [mode, setMode] = useState('Solo');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Games this player has published. Held with the id they were fetched for so
  // a sign-out or an account switch can't show the previous player's list —
  // deriving from that id is cheaper and safer than clearing it in an effect.
  const [fetched, setFetched] = useState(null);

  const tags = useMemo(() => parseTags(tagsRaw), [tagsRaw]);

  const profileId = profile?.id || null;

  useEffect(() => {
    if (!isSignedIn || !profileId) return undefined;
    let alive = true;
    fetchCreatedGames()
      .then((all) => {
        if (!alive) return;
        setFetched({ userId: profileId, games: all.filter((g) => g.creatorId === profileId) });
      })
      .catch(() => {
        if (!alive) return;
        setFetched({ userId: profileId, games: [] });
      });
    return () => { alive = false; };
  }, [isSignedIn, profileId]);

  const mine = (fetched && fetched.userId === profileId) ? fetched.games : NO_GAMES;
  const loadingMine = isSignedIn && Boolean(profileId) && (!fetched || fetched.userId !== profileId);

  // Optimistic insert so a published game shows up without a second round-trip.
  function remember(game) {
    setFetched((prev) => {
      const base = prev && prev.userId === profileId ? prev.games : NO_GAMES;
      return { userId: profileId, games: [game, ...base.filter((g) => g.id !== game.id)] };
    });
  }

  // Client-side gate before touching the network.
  function validate() {
    const t = cleanText(title);
    const d = cleanText(description);
    if (!t) return ERRORS.title_required;
    if (t.length > MAX_TITLE) return ERRORS.title_too_long;
    if (!d) return ERRORS.description_required;
    if (d.length > MAX_DESCRIPTION) return ERRORS.description_too_long;
    if (tags.length > MAX_TAGS) return ERRORS.too_many_categories;
    if (tags.some((tag) => tag.length > MAX_TAG_LEN)) return ERRORS.category_too_long;
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError('');
    setBusy(true);
    try {
      const game = await createGame({
        title: cleanText(title),
        description: cleanText(description),
        categories: tags,
        type,
        mode,
      });
      setTitle('');
      setDescription('');
      setTagsRaw('');
      remember(game);
      onCreated?.(game);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(game) {
    const confirmed = window.confirm(`Delete “${game.title}”? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await deleteGame(game.id);
      setFetched((prev) => {
        if (!prev || prev.userId !== profileId) return prev;
        return { userId: prev.userId, games: prev.games.filter((g) => g.id !== game.id) };
      });
      onDeleted?.(game);
    } catch (err) {
      setError(describeError(err));
    }
  }

  if (!isSignedIn) {
    return (
      <div className="wb-create">
        <button type="button" className="wb-create-back" onClick={onBack}>
          &larr; Back to games
        </button>
        <div className="wb-create-gate">
          <h2>Sign in to create a game</h2>
          <p>
            Publishing needs an account so every game has a real creator behind it
            and you can remove it later. Use the <strong>Sign in</strong> button in
            the header — it takes a few seconds with Google or an email link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wb-create">
      <button type="button" className="wb-create-back" onClick={onBack}>
        &larr; Back to games
      </button>

      <div className="wb-create-grid">
        <form className="wb-create-form" onSubmit={handleSubmit} noValidate>
          <h2>Create a game</h2>
          <p className="wb-create-lede">
            Describe it, pick how it should look, and publish it to the library.
            You can delete it whenever you like.
          </p>

          {error && <div className="wb-modal-error" role="alert">{error}</div>}

          <label className="wb-field">
            <span className="wb-field-label">Name</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sky Sprint"
              maxLength={MAX_TITLE + 10}
              required
            />
            <span className="wb-field-hint">{title.length}/{MAX_TITLE}</span>
          </label>

          <label className="wb-field">
            <span className="wb-field-label">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One line that tells a player what they are about to do."
              rows={3}
              maxLength={MAX_DESCRIPTION + 20}
              required
            />
            <span className="wb-field-hint">{description.length}/{MAX_DESCRIPTION}</span>
          </label>

          <label className="wb-field">
            <span className="wb-field-label">Artwork</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {ART_CHOICES.map((choice) => (
                <option key={choice.id} value={choice.id}>{choice.label}</option>
              ))}
            </select>
          </label>

          <label className="wb-field">
            <span className="wb-field-label">Play mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>

          <label className="wb-field">
            <span className="wb-field-label">Tags</span>
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="Puzzle, Party"
            />
            <span className="wb-field-hint">
              Separate with commas, up to {MAX_TAGS}.
            </span>
          </label>

          {tags.length > 0 && (
            <div className="wb-tag-row">
              {tags.map((tag) => (
                <span key={tag} className="wb-chip is-on">{tag}</span>
              ))}
            </div>
          )}

          <button type="submit" className="wb-signin-btn" disabled={busy}>
            {busy ? 'Publishing…' : 'Publish game'}
          </button>
        </form>

        <aside className="wb-create-preview">
          <span className="wb-field-label">Preview</span>
          <div className="wb-card is-playable">
            <div className="wb-card-media-preview">
              <GameArt type={type} />
            </div>
            <div className="wb-card-foot">
              <h3 className="wb-card-title">{cleanText(title) || 'Your game'}</h3>
            </div>
            <p className="wb-card-meta">
              {[...tags.slice(0, 2), mode].filter(Boolean).join(' · ') || 'No tags yet'}
            </p>
          </div>
          <p className="wb-create-note">
            Published games appear in the library for everyone. They carry a
            &ldquo;Soon&rdquo; badge until the playable build exists.
          </p>
        </aside>
      </div>

      <section className="wb-create-mine">
        <h3>
          Your games
          {mine.length > 0 && <span className="wb-row-count">{mine.length}</span>}
        </h3>
        {loadingMine ? (
          <p className="wb-row-empty">Loading…</p>
        ) : mine.length === 0 ? (
          <p className="wb-row-empty">You have not published anything yet.</p>
        ) : (
          <ul className="wb-mine-list">
            {mine.map((game) => (
              <li key={game.id} className="wb-mine-item">
                <div className="wb-mine-art"><GameArt type={game.type} /></div>
                <div className="wb-mine-body">
                  <strong>{game.title}</strong>
                  <span>{game.description}</span>
                </div>
                <button
                  type="button"
                  className="wb-mine-delete"
                  onClick={() => handleDelete(game)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
