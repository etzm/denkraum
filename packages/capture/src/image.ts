/** Target size so the longer side is at most `max` pixels; never enlarges. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Size after rotating by a multiple of 90 degrees. */
export function rotatedSize(width: number, height: number, quarterTurns: number): { width: number; height: number } {
  return quarterTurns % 2 === 0 ? { width, height } : { width: height, height: width };
}

/**
 * Re-encodes a photo in the browser: applies the camera orientation, scales the longer side to
 * `maxSide`, rotates by quarter turns, and writes a fresh JPEG. Canvas output carries no EXIF
 * data, so GPS and camera details never leave the device (docs/datenschutz/README.md section 4).
 */
export async function reencode(source: Blob, maxSide: number, quarterTurns = 0, quality = 0.8): Promise<Blob> {
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const fitted = fitWithin(img.naturalWidth, img.naturalHeight, maxSide);
    const out = rotatedSize(fitted.width, fitted.height, quarterTurns);
    const canvas = document.createElement("canvas");
    canvas.width = out.width;
    canvas.height = out.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas nicht verfügbar.");
    ctx.translate(out.width / 2, out.height / 2);
    ctx.rotate((quarterTurns % 4) * (Math.PI / 2));
    ctx.drawImage(img, -fitted.width / 2, -fitted.height / 2, fitted.width, fitted.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Bild konnte nicht erstellt werden."))), "image/jpeg", quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
