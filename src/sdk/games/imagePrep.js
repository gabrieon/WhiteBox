// Client-side image preparation for game thumbnails.
//
// The Worker accepts at most 512 KB, and a modern phone photo is several
// megabytes — so nothing is sent raw. Every image goes through a canvas first:
// cropped to the card's 3:2 ratio, scaled to 640px wide, re-encoded as JPEG at
// 82% quality. That lands almost every image in the 30-90 KB range, which keeps
// uploads fast, R2 usage tiny, and the Worker's size cap meaningful.
//
// Downside worth stating: this runs on the main thread and a large photo can
// take a moment. It is one decode plus one encode, which is well under the
// threshold where it would be worth a Web Worker.

const TARGET_WIDTH = 640;
const TARGET_RATIO = 3 / 2;
const JPEG_QUALITY = 0.82;
// Below this the encode result is usually larger than the original, so keep the
// original bytes instead of paying to re-encode something already tiny.
const MIN_BYTES = 12 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Revoke immediately after decode: the bitmap is already in memory, and a
      // leaked object URL pins the whole file for the life of the page.
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_not_an_image'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('image_encode_failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/**
 * Turn a picked file into a compressed thumbnail blob.
 * @returns {Promise<{blob: Blob, width: number, height: number, preview: string}>}
 */
export async function prepareThumbnail(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('image_not_an_image');
  }

  const img = await loadImage(file);

  const sourceRatio = img.width / img.height;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (sourceRatio > TARGET_RATIO) {
    // Too wide: crop the sides.
    sw = img.height * TARGET_RATIO;
    sx = (img.width - sw) / 2;
  } else if (sourceRatio < TARGET_RATIO) {
    // Too tall: crop top and bottom, biased slightly above centre so a face in
    // the upper third of a photo usually survives the crop.
    sh = img.width / TARGET_RATIO;
    sy = (img.height - sh) * 0.4;
  }

  const width = TARGET_WIDTH;
  const height = Math.round(TARGET_WIDTH / TARGET_RATIO);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  // JPEG has no alpha; without this, transparent areas come out black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

  const blob = await canvasToBlob(canvas);

  const finalBlob = blob.size < MIN_BYTES && file.size < blob.size ? file : blob;
  const preview = URL.createObjectURL(finalBlob);

  return { blob: finalBlob, width, height, preview };
}

export function revokePreview(url) {
  if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
}
