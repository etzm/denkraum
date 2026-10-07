import { describe, expect, it } from "vitest";
import {
  assertIdentityFree,
  declineAdjective,
  deletionDueAt,
  findIdentityLeaks,
  findMetadataSegments,
  generateAccessCode,
  generatePseudonym,
  IdentityLeakError,
  isDue,
  normalizeAccessCode,
  NotAJpegError,
  stripJpegMetadata,
} from "./index.ts";

const DAY = 24 * 60 * 60 * 1000;

function segment(marker: number, payload: number[]): number[] {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...payload];
}
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Minimal synthetic JPEG with JFIF, EXIF (with "GPS"), ICC, IPTC, a comment and fake scan data. */
function syntheticJpeg(): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    ...segment(0xe0, ascii("JFIF\0\x01\x01\0\0\x01\0\x01\0\0")),
    ...segment(0xe1, ascii("Exif\0\0GPSLatitude 47.99N")),
    ...segment(0xe2, ascii("ICC_PROFILE\0\x01\x01data")),
    ...segment(0xed, ascii("Photoshop 3.0\0IPTC")),
    ...segment(0xfe, ascii("Klasse 10b, Anna")),
    ...segment(0xdb, [0, ...new Array(64).fill(1)]),
    0xff, 0xff, // fill byte before a marker
    ...segment(0xda, [1, 1, 0, 0, 63, 0]),
    0x12, 0x34, 0xff, 0x00, 0x56, // entropy-coded data with stuffed 0xFF00
    0xff, 0xd9,
  ]);
}

describe("pseudonyms", () => {
  it("declines adjectives by gender", () => {
    expect(declineAdjective("blau", "m")).toBe("blauer");
    expect(declineAdjective("blau", "f")).toBe("blaue");
    expect(declineAdjective("blau", "n")).toBe("blaues");
    expect(declineAdjective("leise", "m")).toBe("leiser");
    expect(declineAdjective("leise", "f")).toBe("leise");
  });

  it("generates 'Adjektiv Tier Zahl'", () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePseudonym()).toMatch(/^[A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+ [1-9][0-9]$/);
    }
  });
});

describe("access codes", () => {
  it("generates readable codes and normalizes input", () => {
    const code = generateAccessCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(normalizeAccessCode(code.toLowerCase().replace("-", " "))).toBe(code);
  });

  it("rejects ambiguous characters and wrong lengths", () => {
    expect(normalizeAccessCode("O0I1-ABCD")).toBeNull();
    expect(normalizeAccessCode("ABC")).toBeNull();
  });
});

describe("retention", () => {
  const createdAt = new Date("2026-10-01T10:00:00Z");
  const groupEndsAt = new Date("2027-07-31T00:00:00Z");

  it("deletes photos after 14 days", () => {
    expect(deletionDueAt("photos", { createdAt, groupEndsAt })).toEqual(new Date(createdAt.getTime() + 14 * DAY));
    expect(isDue("photos", { createdAt, groupEndsAt }, new Date(createdAt.getTime() + 13 * DAY))).toBe(false);
    expect(isDue("photos", { createdAt, groupEndsAt }, new Date(createdAt.getTime() + 14 * DAY))).toBe(true);
  });

  it("keeps content until the group ends, never longer", () => {
    expect(deletionDueAt("content", { createdAt, groupEndsAt })).toEqual(groupEndsAt);
    const shortGroup = new Date("2026-10-05T00:00:00Z");
    expect(deletionDueAt("photos", { createdAt, groupEndsAt: shortGroup })).toEqual(shortGroup);
  });

  it("applies module overrides", () => {
    const due = deletionDueAt("photos", { createdAt, groupEndsAt }, [
      { category: "photos", days: 30, reason: "Mehrseitige Texte brauchen länger für die Korrektur." },
    ]);
    expect(due).toEqual(new Date(createdAt.getTime() + 30 * DAY));
  });
});

describe("JPEG metadata", () => {
  it("finds EXIF, IPTC and comments but keeps JFIF and ICC", () => {
    const markers = findMetadataSegments(syntheticJpeg()).map((s) => s.marker);
    expect(markers).toEqual([0xe1, 0xed, 0xfe]);
  });

  it("strips metadata and keeps image data byte-identical", () => {
    const input = syntheticJpeg();
    const out = stripJpegMetadata(input);
    expect(findMetadataSegments(out)).toEqual([]);
    const text = new TextDecoder("latin1").decode(out);
    expect(text).not.toContain("GPS");
    expect(text).not.toContain("Anna");
    expect(text).toContain("JFIF");
    expect(text).toContain("ICC_PROFILE");
    const tail = [0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9];
    expect([...out.slice(-tail.length)]).toEqual(tail);
    expect(stripJpegMetadata(out)).toEqual(out);
  });

  it("rejects non-JPEG data", () => {
    expect(() => stripJpegMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow(NotAJpegError);
  });
});

describe("prompt guard", () => {
  const known = { pseudonym: "Blauer Falke 42", accessCodes: ["K7QM-X2PA"], ids: ["learner_8f3a2c1d"] };

  it("passes identity-free prompts", () => {
    expect(findIdentityLeaks("Berechne a = 8 · sin 35°.", known)).toEqual([]);
  });

  it("detects pseudonym, code (with or without hyphen), ids and e-mails", () => {
    expect(findIdentityLeaks("Text von blauer falke 42", known)).toEqual(["pseudonym"]);
    expect(findIdentityLeaks("Code K7QMX2PA", known)).toEqual(["access_code"]);
    expect(findIdentityLeaks("run learner_8f3a2c1d", known)).toEqual(["id"]);
    expect(findIdentityLeaks("schreib an kind@example.org", known)).toEqual(["email"]);
    expect(() => assertIdentityFree("Code K7QM-X2PA", known)).toThrow(IdentityLeakError);
  });
});
