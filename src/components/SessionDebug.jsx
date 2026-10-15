import { useState } from 'react';
import { sessionDiagnostics } from '../sdk/auth/sessionDiagnostics.js';

// Session diagnostics panel.
//
// Mounted only when the URL carries `?debug=session`, so it never appears for a
// normal visitor. Its whole job is to answer one question that has resisted
// three rounds of guessing: after a browser restart, is the session still on
// disk, and what did Supabase do when it read it?
//
// Everything here is read-only apart from two manual buttons.

function Row({ label, value, tone }) {
  return (
    <div className="wb-dbg-row">
      <span className="wb-dbg-label">{label}</span>
      <span className={`wb-dbg-value${tone ? ` is-${tone}` : ''}`}>{String(value)}</span>
    </div>
  );
}

export default function SessionDebug() {
  const d = sessionDiagnostics();

  // Captured once per mount rather than read during render — Date.now() is an
  // impure read and the lint rule is right to reject it in render. A lazy
  // initialiser is the sanctioned place for it.
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  if (!d.enabled) return null;

  const expiresIn = d.stored.expiresAt ? d.stored.expiresAt - now : null;

  return (
    <div className="wb-dbg">
      <h3>Session debug</h3>

      <section>
        <h4>Storage</h4>
        <Row label="localStorage writable" value={d.storageWritable ? 'yes' : 'NO — blocked'} tone={d.storageWritable ? 'ok' : 'bad'} />
        <Row label="Session key present" value={d.stored.present ? 'yes' : 'NO'} tone={d.stored.present ? 'ok' : 'bad'} />
        {d.stored.note && <Row label="Note" value={d.stored.note} />}
        {d.stored.present && (
          <>
            <Row label="Provider" value={d.stored.provider || '—'} />
            <Row label="Email" value={d.stored.email || '—'} />
            <Row label="Has refresh token" value={d.stored.hasRefreshToken ? 'yes' : 'NO'} tone={d.stored.hasRefreshToken ? 'ok' : 'bad'} />
            <Row
              label="Access token expires"
              value={expiresIn === null ? 'unknown' : (expiresIn > 0 ? `in ${expiresIn}s` : `${-expiresIn}s AGO (expired)`)}
              tone={expiresIn === null ? undefined : (expiresIn > 0 ? 'ok' : 'warn')}
            />
          </>
        )}
      </section>

      <section>
        <h4>Auth events this page load</h4>
        {d.events.length === 0 ? (
          <p className="wb-dbg-empty">None recorded yet.</p>
        ) : (
          <ul className="wb-dbg-events">
            {d.events.map((e, i) => (
              <li key={i} className={`wb-dbg-event${e.event === 'SIGNED_OUT' ? ' is-bad' : ''}`}>
                <code>{e.at}</code> <strong>{e.event}</strong>{' '}
                {e.hasSession ? <span className="ok">session</span> : <span className="bad">no session</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4>Errors</h4>
        {d.errors.length === 0 ? (
          <p className="wb-dbg-empty">None.</p>
        ) : (
          <ul className="wb-dbg-events">
            {d.errors.map((e, i) => (
              <li key={i} className="wb-dbg-event is-bad">
                <code>{e.at}</code> <strong>{e.where}</strong> {e.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4>What to do next</h4>
        <p className="wb-dbg-hint">
          Close the browser fully, reopen, come back to this same URL, and press
          reload. Then read two things:
        </p>
        <ul className="wb-dbg-hint-list">
          <li>
            <strong>Session key present?</strong> If <em>NO</em>, the browser
            removed it and nothing in the app can prevent that.
          </li>
          <li>
            <strong>First event.</strong> If it is <code>SIGNED_OUT</code> rather
            than <code>INITIAL_SESSION</code> or <code>TOKEN_REFRESHED</code>,
            Supabase actively rejected the stored session — copy these events
            across and that will show exactly why.
          </li>
        </ul>
      </section>
    </div>
  );
}