import { useCallback, useEffect, useState } from 'react';
import {
  fetchCreators, grantCreator, revokeCreator,
} from '../sdk/games/api.js';

// Creator access panel.
//
// Creating is a grant, not a side effect of having an account. This panel is
// the only place that grant changes: an admin adds or removes accounts here,
// and the Create screen reads the result through /v1/me.
//
// It renders nothing for a non-admin, because the actions it offers would only
// fail — and a panel that is always visible but never works is worse than no
// panel at all.

function relativeTime(ts, now) {
  const mins = Math.round(Math.max(0, now - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function CreatorAccess({ now }) {
  // Captured once per mount so `relativeTime` stays a pure render: calling
  // Date.now() inside the map would make it depend on render timing.
  const [mountedAt] = useState(() => Date.now());
  const reference = now || mountedAt;

  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [userId, setUserId] = useState('');

  const load = useCallback(() => {
    fetchCreators()
      .then(setCreators)
      .catch((err) => {
        setCreators([]);
        setError(err?.message || 'Could not load creators.');
      })
      .finally(() => setLoading(false));
  }, []);

  // Initial fetch on mount. `loading` starts true and is cleared by the
  // completion handler, so no synchronous setState is needed here.
  useEffect(() => {
    load();
  }, [load]);

  async function handleGrant(event) {
    event.preventDefault();
    const id = userId.trim();
    if (!id) return;
    setError('');
    setNotice('');
    setBusyId(id);
    try {
      await grantCreator(id, null);
      setUserId('');
      setNotice(`${id} can now create games.`);
      load();
    } catch (err) {
      setError(err?.message || 'Could not grant access.');
    } finally {
      setBusyId('');
    }
  }

  async function handleRevoke(creator) {
    setError('');
    setNotice('');
    setBusyId(creator.userId);
    try {
      await revokeCreator(creator.userId);
      setNotice(`${creator.userId} can no longer create games.`);
      load();
    } catch (err) {
      setError(err?.message || 'Could not revoke access.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="wb-create-mine" aria-label="Creator access">
      <h3>Who can create</h3>
      <p className="wb-create-lede">
        Only accounts listed here can publish a game. Everyone else can sign in,
        browse, and play.
      </p>

      <form className="wb-creator-form" onSubmit={handleGrant}>
        <label className="wb-field">
          <span className="wb-field-label">Add an account</span>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Supabase user id"
            autoComplete="off"
            spellCheck="false"
          />
          <span className="wb-field-hint">
            The id from <code>?debug=session</code> on the Create screen, or from
            the creator&apos;s own browser console.
          </span>
        </label>
        <button type="submit" className="wb-mine-action" disabled={busyId === userId.trim()}>
          Grant access
        </button>
      </form>

      {error && <div className="wb-modal-error" role="alert">{error}</div>}
      {notice && <p className="wb-mine-notice" role="status">{notice}</p>}

      {loading ? (
        <p className="wb-row-empty">Loading…</p>
      ) : creators.length === 0 ? (
        <p className="wb-row-empty">Nobody can create games yet.</p>
      ) : (
        <ul className="wb-mine-list">
          {creators.map((creator) => (
            <li key={creator.userId} className="wb-mine-item">
              <div className="wb-mine-body">
                <strong>{creator.userName || 'Unnamed account'}</strong>
                <span className="wb-mine-meta">{creator.userId}</span>
                <span className="wb-mine-meta">
                  {creator.gameCount} {creator.gameCount === 1 ? 'game' : 'games'} ·
                  {' '}granted {relativeTime(creator.grantedAt, reference)}
                </span>
              </div>
              <div className="wb-mine-actions">
                <button
                  type="button"
                  className="wb-mine-delete"
                  disabled={busyId === creator.userId}
                  onClick={() => handleRevoke(creator)}
                >
                  Revoke
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}