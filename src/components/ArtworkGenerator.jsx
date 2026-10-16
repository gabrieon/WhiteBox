import { useCallback, useEffect, useState } from 'react';
import { fetchArtworkQuota, generateArtwork, suggestPrompt } from '../sdk/games/artwork.js';
import { prepareThumbnail } from '../sdk/games/imagePrep.js';

// AI artwork panel.
//
// The generated image goes through exactly the same canvas pipeline a picked
// photo does, and lands in exactly the same pending-slot. That is deliberate:
// the form already knows how to show a preview, how to undo it, and how to
// upload it on save, so this contributes one Blob and reuses everything else.
//
// Nothing is uploaded the moment generation finishes. It waits for Save, like
// any other replacement, so a generated image can be discarded without ever
// having been stored.

const ERRORS = {
  artwork_not_configured: 'Image generation is not switched on for this site yet.',
  artwork_quota_exhausted: 'You have used all of today\'s generated images. Try again after midnight Pacific.',
  artwork_quota_unavailable: 'Could not check your remaining images. Try again shortly.',
  artwork_prompt_refused: 'That prompt was refused. Try describing the game differently.',
  artwork_prompt_rejected: 'Gemini would not accept that prompt. Try rephrasing it.',
  artwork_timeout: 'That took too long. Try again with a simpler prompt.',
  artwork_unreachable: 'Could not reach the image service. Try again shortly.',
  artwork_failed: 'Image generation failed. Try again.',
  artwork_no_image: 'The image service returned no image. Try a different prompt.',
  artwork_not_an_image: 'That response was not an image.',
  rate_limited: 'Too many requests. Wait a few minutes and try again.',
  network_blocked: 'Could not reach the site. Check your connection.',
  prompt_required: 'Describe the image you want first.',
  prompt_too_long: 'That prompt is too long. Trim it a little.',
  image_encode_failed: 'Could not process that image. Try again.',
};

function describe(err) {
  const reason = err?.message || 'unknown_error';
  return ERRORS[reason] || `Could not generate an image (${reason}).`;
}

export default function ArtworkGenerator({
  game, onReady, disabled,
}) {
  const [quota, setQuota] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The suggestion is seeded by the click that opens the panel rather than by an
  // effect. That is both the natural moment and the only one that is correct: an
  // effect would also fire when the panel is already open and `game` changes,
  // overwriting whatever the person was in the middle of editing.
  const openPanel = useCallback(() => {
    setPrompt(suggestPrompt(game));
    setError('');
    setOpen(true);
  }, [game]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    fetchArtworkQuota()
      .then((q) => { if (alive) setQuota(q); })
      // Absent quota is not fatal here: generation will refuse if it must, and
      // hiding the panel because a counter read failed would be worse.
      .catch(() => { if (alive) setQuota(null); });
    return () => { alive = false; };
  }, [open]);

  const run = useCallback(async () => {
    setError('');
    setBusy(true);
    try {
      const blob = await generateArtwork(game.id, prompt);
      // Same pipeline as a picked file, so a generated image is cropped to the
      // card ratio and compressed exactly like a photo rather than arriving
      // 1K and full weight.
      const prepared = await prepareThumbnail(blob);
      onReady(prepared);
      setOpen(false);
    } catch (err) {
      setError(describe(err));
      // A refused request usually spends nothing, but a quota error definitely
      // did; re-read so the number shown matches reality either way.
      fetchArtworkQuota()
        .then(setQuota)
        .catch(() => {});
    } finally {
      setBusy(false);
    }
  }, [game.id, onReady, prompt]);

  const exhausted = quota !== null && quota.remaining <= 0;

  if (!game) return null;

  if (!open) {
    return (
      <div className="wb-gen">
        <button
          type="button"
          className="wb-upload-clear"
          onClick={openPanel}
          disabled={disabled || busy}
        >
          Generate with AI
        </button>
        {quota && quota.remaining > 0 && (
          <span className="wb-gen-quota">{quota.remaining} left today</span>
        )}
      </div>
    );
  }

  return (
    <div className="wb-gen-panel">
      <label className="wb-field">
        <span className="wb-field-label">Describe the artwork</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          maxLength={620}
          disabled={busy}
          placeholder="A bold flat illustration of…"
        />
        <span className="wb-field-hint">
          Pre-filled from the name and description. Edit it — this is what drives
          the image. {prompt.length}/600
        </span>
      </label>

      {error && <div className="wb-modal-error" role="alert">{error}</div>}

      <div className="wb-gen-actions">
        <button
          type="button"
          className="wb-upload-pick"
          onClick={run}
          disabled={busy || exhausted || !prompt.trim()}
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>
        <button
          type="button"
          className="wb-upload-clear"
          onClick={() => { setOpen(false); setError(''); }}
          disabled={busy}
        >
          Cancel
        </button>
        {quota && (
          <span className="wb-gen-quota">
            {exhausted
              ? `None left today (${quota.limit} per day)`
              : `${quota.remaining} of ${quota.limit} left today`}
          </span>
        )}
      </div>

      <p className="wb-gen-note">
        Generated images carry an invisible SynthID watermark from Google, and
        are sent to Gemini to create.
      </p>
    </div>
  );
}