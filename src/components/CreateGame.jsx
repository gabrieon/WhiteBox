import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../sdk/auth/authContext.js';
import {
  fetchMyGames,
  fetchReviewGames,
  createGame,
  updateGame,
  deleteGame,
  uploadThumb,
  deleteThumb,
  thumbUrl,
  reviewGame,
  fetchMe,
} from '../sdk/games/api.js';
import { prepareThumbnail, revokePreview } from '../sdk/games/imagePrep.js';
import GameArt from './GameArt.jsx';
import ModerationQueue from './ModerationQueue.jsx';
import BuiltinArtwork from './BuiltinArtwork.jsx';

// The Create screen.
//
// A created game is a catalogue entry today: title, description, tags and an
// artwork choice, stored in the database and visible after human approval. It is
// NOT playable yet — there is no engine attached — so the library renders an
// approved entry with a "Soon" badge rather than a Play button. That honesty
// matters more than making the button look finished.
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
  not_allowed: 'Only an admin can take that action.',
  scope_invalid: 'That game list is not available.',
  status_invalid: 'That review list is not available.',
  decision_invalid: 'Choose Approve or Reject.',
  rate_limited: 'Too many requests. Wait a minute and try again.',
  image_not_an_image: 'That file is not an image the browser can read.',
  image_too_large: 'That image is too large. Try a smaller one.',
  image_empty: 'That file was empty.',
  image_encode_failed: 'Could not process that image. Try another.',
  thumb_not_configured: 'Image uploads are not available right now.',
};

function describeError(err) {
  const reason = err?.message || err?.error || 'unknown_error';
  return ERRORS[reason] || `Could not save the game (${reason}).`;
}

// Stable empty array so the derived `mine` keeps its identity across renders
// while nothing is loaded.
const NO_GAMES = [];

export default function CreateGame({ onCreated, onDeleted, onUpdated, onBack }) {
  const { isSignedIn, profile } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [type, setType] = useState('puzzle');
  const [mode, setMode] = useState('Solo');

  // The game currently open for editing, or null when publishing a new one.
  // Editing reuses this same form rather than living on a second screen: the
  // fields are identical, so a separate view would be duplicated validation and
  // a duplicated submit path for no gain.
  const [editing, setEditing] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Admin review state. Ownership is checked through /v1/me rather than
  // inferred from the signed-in profile: the client must not guess who the
  // owner is, and the queue must never render for anyone else.
  const [isAdmin, setIsAdmin] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('pending');
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [actionId, setActionId] = useState(null);

  // Pending thumbnail: compressed in the browser and held here, because a game
  // only gets an id once it exists. It uploads immediately after the POST.
  const [pendingThumb, setPendingThumb] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef(null);

  // Games this player has published. Held with the id they were fetched for so
  // a sign-out or an account switch can't show the previous player's list —
  // deriving from that id is cheaper and safer than clearing it in an effect.
  const [fetched, setFetched] = useState(null);

  const tags = useMemo(() => parseTags(tagsRaw), [tagsRaw]);

  const profileId = profile?.id || null;

  useEffect(() => {
    if (!isSignedIn || !profileId) return undefined;
    let alive = true;
    // The public catalogue hides pending and rejected entries, so creators
    // read their own scope here. Without it, a fresh submission would vanish
    // from this screen the moment it was saved.
    fetchMyGames()
      .then((mine) => {
        if (!alive) return;
        setFetched({ userId: profileId, games: mine });
      })
      .catch(() => {
        if (!alive) return;
        setFetched({ userId: profileId, games: [] });
      });
    fetchMe()
      .then((me) => {
        if (!alive) return;
        setIsAdmin(Boolean(me?.isAdmin));
      })
      .catch(() => {
        if (!alive) return;
        setIsAdmin(false);
      });
    return () => { alive = false; };
  }, [isSignedIn, profileId]);

  useEffect(() => {
    if (!isSignedIn || !isAdmin) return undefined;
    let alive = true;
    // Queue refresh on filter or admin change. This resets transient request
    // state only when its inputs change; completion handlers guard `alive`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueueLoading(true);
    setQueueError('');
    fetchReviewGames({ status: reviewStatus })
      .then((games) => {
        if (!alive) return;
        setQueue(games);
        setQueueLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setQueue([]);
        setQueueLoading(false);
        setQueueError(describeError(err));
      });
    return () => { alive = false; };
  }, [isSignedIn, isAdmin, reviewStatus]);

  const mine = (fetched && fetched.userId === profileId) ? fetched.games : NO_GAMES;
  const loadingMine = isSignedIn && Boolean(profileId) && (!fetched || fetched.userId !== profileId);
  const canDelete = isAdmin;

  const STATUS_LABELS = {
    pending: 'Waiting for review',
    approved: 'Live',
    rejected: 'Not approved',
  };

  // Optimistic insert so a published game shows up without a second round-trip.
  function remember(game) {
    setFetched((prev) => {
      const base = prev && prev.userId === profileId ? prev.games : NO_GAMES;
      return { userId: profileId, games: [game, ...base.filter((g) => g.id !== game.id)] };
    });
  }

  // Keep the admin queue truthful after a decision or deletion. A game that no
  // longer belongs to the selected status leaves the list; one that still does
  // is replaced in place. Leaving a rejected game in the pending list would
  // invite reviewing it twice.
  function syncQueue(game) {
    setQueue((prev) => {
      if (game.status === reviewStatus) {
        return prev.map((entry) => (entry.id === game.id ? game : entry));
      }
      return prev.filter((entry) => entry.id !== game.id);
    });
  }

  function removeFromLists(id) {
    setFetched((prev) => {
      if (!prev || prev.userId !== profileId) return prev;
      return { userId: prev.userId, games: prev.games.filter((g) => g.id !== id) };
    });
    setQueue((prev) => prev.filter((entry) => entry.id !== id));
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

  async function handlePickImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setPreparing(true);
    try {
      // Crop, scale and re-encode before anything leaves the browser — a phone
      // photo is megabytes, and the Worker caps uploads at 512 KB.
      const prepared = await prepareThumbnail(file);
      // Replacing a selection must release the previous preview, or every pick
      // leaks an object URL for the life of the page.
      setPendingThumb((prev) => {
        if (prev) revokePreview(prev.preview);
        return prepared;
      });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPreparing(false);
      // Let the same file be picked again after a failure.
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function clearPendingImage() {
    setPendingThumb((prev) => {
      if (prev) revokePreview(prev.preview);
      return null;
    });
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError('');
    setNotice('');
    setBusy(true);
    try {
      const draft = {
        title: cleanText(title),
        description: cleanText(description),
        categories: tags,
        type,
        mode,
      };

      const isEdit = Boolean(editing);
      const saved = isEdit ? await updateGame(editing.id, draft) : await createGame(draft);
      if (!saved) throw new Error('not_found');

      // The image rides along after an edit too, since the upload path needs the
      // game id and an edit doesn't change it. A failed photo is reported but
      // never rolls back the metadata change the player just made.
      let published = saved;
      if (pendingThumb) {
        try {
          const stored = await uploadThumb(saved.id, pendingThumb.blob);
          // Carry the stored URL through, not just the key: the local object URL
          // from the preview points at a blob that dies with this page, so using
          // it would render a broken image the moment the form re-renders.
          published = { ...saved, thumbKey: stored.key || 'uploaded', thumbUrl: stored.url };
        } catch (err) {
          setError(`Saved, but the photo failed: ${describeError(err)}`);
        }
        clearPendingImage();
      }

      remember(published);
      syncQueue(published);
      setEditing(null);
      setTitle('');
      setDescription('');
      setTagsRaw('');
      if (published.status === 'pending') {
        setNotice(
          isEdit
            ? 'Saved and sent back for review. It stays hidden until it is approved again.'
            : 'Sent for review. It stays hidden until it is approved.',
        );
      } else {
        setNotice(isEdit ? 'Saved.' : 'Published to the library.');
      }
      if (isEdit) onUpdated?.(published);
      else onCreated?.(published);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  // Prefill the form from an existing game. The photo is deliberately NOT put
  // into `pendingThumb` — that holds an unsaved local file, and copying an
  // already-uploaded URL into it would re-upload the image on save.
  function startEdit(game) {
    setEditing(game);
    setTitle(game.title);
    setDescription(game.description);
    setTagsRaw((game.categories || []).join(', '));
    setType(game.type);
    setMode(game.mode);
    setError('');
    clearPendingImage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditing(null);
    setTitle('');
    setDescription('');
    setTagsRaw('');
    setError('');
    clearPendingImage();
  }

  async function handleStripPhoto(game) {
    const ok = window.confirm(
      `Remove the photo from "${game.title}"? It falls back to the generated artwork.`,
    );
    if (!ok) return;
    try {
      await deleteThumb(game.id);
      const cleared = { ...game, thumbKey: null, thumbUrl: null };
      remember(cleared);
      // The form's "Current photo" tile reads from `editing`, so clearing only
      // the list entry would leave the removed image still on screen.
      setEditing((prev) => (prev && prev.id === game.id ? cleared : prev));
    } catch (err) {
      setError(describeError(err));
    }
  }

  async function handleReview(game, decision) {
    setQueueError('');
    setNotice('');
    setActionId(game.id);
    try {
      const decided = await reviewGame(game.id, decision);
      // A reviewed game can belong to another creator. Only merge it into
      // "Your games" when the admin is also its creator; otherwise reviewing
      // someone else's submission would falsely claim authorship.
      if (decided.creatorId === profileId) remember(decided);
      syncQueue(decided);
      setNotice(
        decided.status === 'approved'
          ? `"${decided.title}" is now live for everyone.`
          : `"${decided.title}" stays hidden.`,
      );
    } catch (err) {
      setQueueError(describeError(err));
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(game) {
    const confirmed = window.confirm(`Delete “${game.title}”? This cannot be undone.`);
    if (!confirmed) return;
    setError('');
    try {
      await deleteGame(game.id);
      removeFromLists(game.id);
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
          <h2>{editing ? 'Edit game' : 'Create a game'}</h2>
          <p className="wb-create-lede">
            {editing
              ? `Editing “${editing.title}”. Your own approved game returns to review when you save it.`
              : 'Describe it, pick how it should look, and send it for review. New games appear after approval.'}
          </p>

          {error && <div className="wb-modal-error" role="alert">{error}</div>}
          {notice && <p className="wb-mine-notice" role="status">{notice}</p>}

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
            <span className="wb-field-label">Thumbnail</span>
            <div className="wb-upload">
              {pendingThumb ? (
                <div className="wb-upload-done">
                  <img src={pendingThumb.preview} alt="" className="wb-upload-preview" />
                  <div className="wb-upload-meta">
                    <span>
                      {pendingThumb.blob.size < 1024
                        ? `${pendingThumb.blob.size} B`
                        : `${Math.round(pendingThumb.blob.size / 1024)} KB`}
                      {' · '}
                      {pendingThumb.width}×{pendingThumb.height}
                      {' · '}
                      replaces current
                    </span>
                    <button type="button" className="wb-upload-clear" onClick={clearPendingImage}>
                      Undo
                    </button>
                  </div>
                </div>
              ) : editing?.thumbUrl ? (
                /* No replacement picked yet, but the game already has a photo.
                   Showing it is what makes "edit the thumbnail" possible at all —
                   otherwise the form looks identical to creating a new game and
                   there is nothing to replace. */
                <div className="wb-upload-done">
                  <img src={editing.thumbUrl} alt="" className="wb-upload-preview" />
                  <div className="wb-upload-meta">
                    <span>Current photo</span>
                    <div className="wb-upload-actions">
                      <button
                        type="button"
                        className="wb-upload-clear"
                        onClick={() => fileRef.current?.click()}
                        disabled={preparing}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        className="wb-upload-clear is-danger"
                        onClick={() => handleStripPhoto(editing)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="wb-upload-pick"
                  onClick={() => fileRef.current?.click()}
                  disabled={preparing}
                >
                  {preparing ? 'Processing…' : 'Choose an image'}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="wb-upload-input"
                onChange={handlePickImage}
              />
            </div>
            <span className="wb-field-hint">
              {editing
                ? 'Replaces the current thumbnail when you save.'
                : 'Optional. Cropped and compressed in your browser.'}
            </span>
          </label>

          <label className="wb-field">
            <span className="wb-field-label">Artwork</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {ART_CHOICES.map((choice) => (
                <option key={choice.id} value={choice.id}>{choice.label}</option>
              ))}
            </select>
            <span className="wb-field-hint">
              Used as the fallback whenever there is no photo.
            </span>
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

          <div className="wb-form-actions">
            <button type="submit" className="wb-signin-btn" disabled={busy}>
              {busy ? 'Saving…' : (editing ? 'Save changes' : 'Publish game')}
            </button>
            {editing && (
              <button
                type="button"
                className="wb-form-cancel"
                onClick={cancelEdit}
                disabled={busy}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>

        <aside className="wb-create-preview">
          <span className="wb-field-label">Preview</span>
          <div className="wb-card is-playable">
            <div className="wb-card-media-preview">
              <GameArt type={type} thumb={pendingThumb?.preview || null} />
            </div>
            <div className="wb-card-foot">
              <h3 className="wb-card-title">{cleanText(title) || 'Your game'}</h3>
            </div>
            <p className="wb-card-meta">
              {[...tags.slice(0, 2), mode].filter(Boolean).join(' · ') || 'No tags yet'}
            </p>
          </div>
          <p className="wb-create-note">
            New games stay hidden until they are reviewed. Approved games carry
            a &ldquo;Soon&rdquo; badge until the playable build exists.
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
                <div className="wb-mine-art">
                  <GameArt
                    type={game.type}
                    thumb={game.thumbKey ? thumbUrl(game) : null}
                  />
                </div>
                <div className="wb-mine-body">
                  <strong>{game.title}</strong>
                  <span>{game.description}</span>
                  <span className={`wb-mine-status is-${game.status || 'pending'}`}>
                    {STATUS_LABELS[game.status] || 'Waiting for review'}
                  </span>
                </div>
                <div className="wb-mine-actions">
                  {game.thumbKey && (
                    <button
                      type="button"
                      className="wb-mine-action"
                      onClick={() => handleStripPhoto(game)}
                    >
                      Remove photo
                    </button>
                  )}
                  <button
                    type="button"
                    className="wb-mine-action"
                    onClick={() => startEdit(game)}
                  >
                    Edit
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      className="wb-mine-delete"
                      onClick={() => handleDelete(game)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin && (
        <ModerationQueue
          games={queue}
          status={reviewStatus}
          onStatusChange={setReviewStatus}
          actionId={actionId}
          onReview={handleReview}
          onDelete={handleDelete}
          loading={queueLoading}
          error={queueError}
        />
      )}

      <BuiltinArtwork />
    </div>
  );
}
