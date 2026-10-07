import { decimalPlaces, roundTo } from "./compare.ts";
import type { ParameterRange } from "./schema.ts";

export type Rng = () => number;

/** FNV-1a, 32 bit, over the UTF-16 code units of the string. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast PRNG with 32 bit state. Returns floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic PRNG from a string seed. */
export function createRng(seed: string): Rng {
  return mulberry32(fnv1a(seed));
}

/** Draws a value from the grid min, min + step, ..., max (uniformly). */
export function drawOnGrid(range: ParameterRange, rng: Rng): number {
  const count = Math.round((range.max - range.min) / range.step) + 1;
  const index = Math.min(Math.floor(rng() * count), count - 1);
  // Round to the step's precision so 0.1 steps do not drift (0.30000000000000004).
  return roundTo(range.min + index * range.step, Math.max(decimalPlaces(range.step), decimalPlaces(range.min)));
}
