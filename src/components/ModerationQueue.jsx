import GameArt from './GameArt.jsx';
import { thumbUrl } from '../sdk/games/api.js';

// Human moderation queue.
//
// This panel exists because publishing is a human decision here: new games wait
// in `pending` until an admin explicitly approves or rejects them. There is no
// automatic scoring, keyword scan, or model judgement anywhere in the path, so
// what this list shows is exactly what still needs a person.
const STATUSES = [
  { id: 'pending', label: 'Needs review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const EMPTY_BY_STATUS = {
  pending: 'Nothing is waiting. New submissions land here.',
  approved: 'No player games are live yet.',
  rejected: 'Nothing has been turned away.',
};

function submittedAt(createdAt) {
  if (!Number.isFinite(createdAt)) return null;
  try {
    return new Date(createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

export default function ModerationQueue({
  games = [],
  status = 'pending',
  onStatusChange,
  actionId = null,
  onReview,
  onDelete,
  loading = false,
  error = '',
}) {
  return (
    <section className="wb-create-mine" aria-label="Game moderation">
      <h3>Review submissions</h3>
      <p className="wb-create-lede">
        You are the reviewer. Approving publishes a game to everyone; rejecting
        keeps it hidden. Neither happens without this button press.
      </p>

      <div className="wb-chip-row" role="group" aria-label="Review status">
        {STATUSES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`wb-chip${status === entry.id ? ' is-on' : ''}`}
            onClick={() => onStatusChange?.(entry.id)}
            aria-pressed={status === entry.id}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {error && <div className="wb-modal-error" role="alert">{error}</div>}

      {loading ? (
        <p className="wb-row-empty">Loading submissions…</p>
      ) : games.length === 0 ? (
        <p className="wb-row-empty">{EMPTY_BY_STATUS[status] || 'Nothing here.'}</p>
      ) : (
        <ul className="wb-mine-list">
          {games.map((game) => {
            const busy = actionId === game.id;
            const date = submittedAt(game.createdAt);
            return (
              <li key={game.id} className="wb-mine-item">
                <div className="wb-mine-art">
                  <GameArt type={game.type} thumb={game.thumbKey ? thumbUrl(game) : null} />
                </div>
                <div className="wb-mine-body">
                  <strong>{game.title}</strong>
                  <span>{game.description}</span>
                  <span className="wb-mine-meta">
                    {[game.creatorName || 'Unknown creator', game.mode, date].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className="wb-mine-actions">
                  <button
                    type="button"
                    className="wb-mine-action"
                    disabled={busy || game.status === 'approved'}
                    onClick={() => onReview?.(game, 'approved')}
                  >
                    {busy ? 'Saving…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    className="wb-mine-action"
                    disabled={busy || game.status === 'rejected'}
                    onClick={() => onReview?.(game, 'rejected')}
                  >
                    {busy ? 'Saving…' : 'Reject'}
                  </button>
                  <button
                    type="button"
                    className="wb-mine-delete"
                    disabled={busy}
                    onClick={() => onDelete?.(game)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
