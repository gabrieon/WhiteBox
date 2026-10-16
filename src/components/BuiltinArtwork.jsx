import { useCallback, useEffect, useRef, useState } from 'react';
import { listGames } from '../games/registry.js';
import {
  fetchMe, fetchBuiltinThumbs, uploadBuiltinThumb, deleteBuiltinThumb,
  BUILTIN_THUMBS_CHANGED,
} from '../sdk/games/api.js';
import { prepareThumbnail } from '../sdk/games/imagePrep.js';
import GameArt from './GameArt.jsx';

// Built-in artwork manager.
//
// A built-in game ships a checked-in thumbnail in public/thumbs/, so changing it
// normally means editing the repo and redeploying. This replaces it at runtime
// against storage instead.
//
// The game list is read once at mount on purpose: these are the games that ship
// inside the bundle, and one added by a later deploy should appear here with no
// extra wiring. The tradeoff is that the panel goes stale if a game ships while
// the tab is open, which resolves on the next visit.

export default function BuiltinArtwork() {
  const builtins = listGames();

  const [overrides, setOverrides] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // One hidden <input type="file"> per row. Each row needs its own because the
  // `change` event carries no row context, and a single shared input would make
  // "which game am I replacing?" implicit.
  const inputs = useRef(new Map());

  // The library draws artwork from its own copy of this map, so a local update
  // is invisible to it. Publishing the next map is what makes the new thumbnail
  // appear on the home screen immediately instead of after a reload.
  const publish = useCallback((next) => {
    setOverrides(next);
    window.dispatchEvent(new CustomEvent(BUILTIN_THUMBS_CHANGED, { detail: next }));
  }, []);

  useEffect(() => {
    let alive = true;

    // Artwork overrides are public — every visitor's cards need them.
    fetchBuiltinThumbs()
      .then((map) => { if (alive) setOverrides(map); })
      .catch(() => {});

    // Ownership is not. Only the owner gets the editing controls at all; the
    // Worker would reject anyone else, so rendering the panel for them would
    // just be a button that always fails.
    //
    // The failure is surfaced rather than swallowed: a rejected /v1/me is what a
    // misconfigured ADMIN_USER_IDS list looks like, and hiding it behind a
    // silently absent panel is exactly the confusing part of the original bug.
    fetchMe()
      .then((me) => {
        if (!alive) return;
        setIsAdmin(Boolean(me && me.isAdmin));
        if (!me || !me.isAdmin) {
          setError(
            `Signed in as ${me?.id || 'an unidentified account'}, which is not in ADMIN_USER_IDS. Add that id to the Worker's ADMIN_USER_IDS var to enable built-in artwork editing.`,
          );
        }
      })
      .catch(() => {
        if (!alive) return;
        setIsAdmin(false);
        setError('Could not verify admin access. Sign in again and retry.');
      })
      .finally(() => { if (alive) setChecked(true); });

    return () => { alive = false; };
  }, []);

  async function handlePick(game, event) {
    const file = event.target.files?.[0];
    // Reset so choosing the same file twice in a row still fires `change`.
    event.target.value = '';
    if (!file) return;

    setError('');
    setNotice('');
    setBusyId(game.id);
    try {
      const prepared = await prepareThumbnail(file);
      await uploadBuiltinThumb(game.id, prepared.blob);
      // The object key never changes, so the URL does either — and the browser
      // would happily serve the previous image from its HTTP cache forever. The
      // `v` stamp is appended for exactly that reason: same bytes at a new URL.
      publish((prev) => ({ ...prev, [game.id]: `${prepared.preview}?v=${Date.now()}` }));
      setNotice(`Updated ${game.title}.`);
    } catch (err) {
      setError(err?.message || 'Upload failed.');
    } finally {
      setBusyId('');
    }
  }

  async function handleReset(game) {
    setError('');
    setNotice('');
    setBusyId(game.id);
    try {
      await deleteBuiltinThumb(game.id);
      publish((prev) => {
        const next = { ...prev };
        delete next[game.id];
        return next;
      });
      setNotice(`${game.title} is back to its original artwork.`);
    } catch (err) {
      setError(err?.message || 'Could not restore.');
    } finally {
      setBusyId('');
    }
  }

  // Nothing renders until the ownership check settles, so the panel never flashes
  // into view for a signed-out visitor and then disappears. A signed-in
  // non-admin still gets the explanatory message rather than a silent nothing.
  if (builtins.length === 0 || !checked || (!isAdmin && !error)) return null;

  return (
    <section className="wb-create-mine">
      <h3>Games that ship with WhiteBox</h3>
      <p className="wb-create-lede">
        Built-in games. Replace their cover art without waiting for a redeploy.
      </p>

      {error && <div className="wb-modal-error" role="alert">{error}</div>}
      {notice && <p className="wb-mine-notice" role="status">{notice}</p>}

      <ul className="wb-mine-list">
        {builtins.map((game) => {
          const override = overrides[game.id];
          const busy = busyId === game.id;
          return (
            <li key={game.id} className="wb-mine-item">
              <div className="wb-mine-art">
                <GameArt type={game.type} thumb={override || game.thumbnail || null} />
              </div>
              <div className="wb-mine-body">
                <strong>{game.title}</strong>
                <span>{override ? 'Custom artwork' : 'Original artwork'}</span>
              </div>
              <div className="wb-mine-actions">
                <input
                  type="file"
                  accept="image/*"
                  className="wb-upload-input"
                  ref={(el) => {
                    if (el) inputs.current.set(game.id, el);
                    else inputs.current.delete(game.id);
                  }}
                  onChange={(e) => handlePick(game, e)}
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="wb-mine-action"
                  disabled={busy}
                  onClick={() => inputs.current.get(game.id)?.click()}
                >
                  {busy ? 'Uploading…' : 'Replace'}
                </button>
                {override && (
                  <button
                    type="button"
                    className="wb-mine-action"
                    disabled={busy}
                    onClick={() => handleReset(game)}
                  >
                    Restore
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="wb-create-note">
        Images are cropped and compressed in your browser before anything is
        uploaded. Restoring puts back the artwork that ships in the repository.
      </p>
    </section>
  );
}