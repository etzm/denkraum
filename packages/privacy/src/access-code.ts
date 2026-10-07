import { randomInt } from "node:crypto";

// No 0/O, 1/I/L: codes are read aloud and typed by children.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Generates a code like "K7QM-X2PA". */
export function generateAccessCode(length = 8, random: (max: number) => number = randomInt): string {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[random(ALPHABET.length)];
  return length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Normalizes user input: case, spaces and hyphens do not matter. Returns null for impossible codes. */
export function normalizeAccessCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, "");
  if (raw.length !== 8 || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
