/**
 * Removes metadata segments from JPEG files: EXIF and XMP (APP1, may contain GPS),
 * IPTC/Photoshop (APP13) and all other APPn segments except JFIF (APP0) and the
 * ICC colour profile, plus comments (COM). Image data stays byte-identical.
 *
 * The client already re-encodes photos via canvas, which drops metadata. This is the
 * server-side safety net for every upload path.
 */

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const COM = 0xfe;
const APP0 = 0xe0;
const APP2 = 0xe2;
const APP15 = 0xef;

export interface JpegSegment {
  marker: number;
  start: number;
  end: number;
}

export class NotAJpegError extends Error {
  constructor(message = "Datei ist kein JPEG.") {
    super(message);
    this.name = "NotAJpegError";
  }
}

function isIccProfile(bytes: Uint8Array, seg: JpegSegment): boolean {
  const id = "ICC_PROFILE\0";
  for (let i = 0; i < id.length; i++) {
    if (bytes[seg.start + 4 + i] !== id.charCodeAt(i)) return false;
  }
  return true;
}

function isMetadata(bytes: Uint8Array, seg: JpegSegment): boolean {
  if (seg.marker === COM) return true;
  if (seg.marker < APP0 || seg.marker > APP15) return false;
  if (seg.marker === APP0) return false;
  if (seg.marker === APP2 && isIccProfile(bytes, seg)) return false;
  return true;
}

/** Header segments up to and including SOS. Everything after SOS is entropy-coded image data. */
export function readHeaderSegments(bytes: Uint8Array): { segments: JpegSegment[]; dataStart: number } {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) throw new NotAJpegError();
  const segments: JpegSegment[] = [];
  let pos = 2;
  while (pos < bytes.length) {
    if (bytes[pos] !== 0xff) throw new NotAJpegError("Ungültige JPEG-Struktur.");
    // Fill bytes: any number of 0xFF before a marker.
    while (bytes[pos + 1] === 0xff) pos++;
    const marker = bytes[pos + 1];
    if (marker === undefined) throw new NotAJpegError("JPEG endet unerwartet.");
    if (marker === EOI) return { segments, dataStart: pos };
    const hi = bytes[pos + 2];
    const lo = bytes[pos + 3];
    if (hi === undefined || lo === undefined) throw new NotAJpegError("JPEG endet unerwartet.");
    const end = pos + 2 + ((hi << 8) | lo);
    if (end > bytes.length) throw new NotAJpegError("Segment länger als Datei.");
    segments.push({ marker, start: pos, end });
    pos = end;
    if (marker === SOS) return { segments, dataStart: end };
  }
  throw new NotAJpegError("Keine Bilddaten gefunden.");
}

export function findMetadataSegments(bytes: Uint8Array): JpegSegment[] {
  return readHeaderSegments(bytes).segments.filter((s) => isMetadata(bytes, s));
}

export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  const { segments, dataStart } = readHeaderSegments(bytes);
  const kept = segments.filter((s) => !isMetadata(bytes, s));
  const headerLength = kept.reduce((sum, s) => sum + (s.end - s.start), 0);
  const out = new Uint8Array(2 + headerLength + (bytes.length - dataStart));
  out[0] = 0xff;
  out[1] = SOI;
  let pos = 2;
  for (const s of kept) {
    out.set(bytes.subarray(s.start, s.end), pos);
    pos += s.end - s.start;
  }
  out.set(bytes.subarray(dataStart), pos);
  return out;
}
