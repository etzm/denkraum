import type { Tolerance } from "./schema.ts";

/** Unit of angles in degrees. Angles use the absolute tolerance, everything else the relative one. */
export const ANGLE_UNIT = "°";

export function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Number of decimal places a value is written with, e.g. 4.6 -> 1, 12 -> 0. */
export function decimalPlaces(x: number): number {
  for (let d = 0; d < 12; d++) {
    const scaled = x * 10 ** d;
    if (Math.abs(scaled - Math.round(scaled)) <= 1e-9 * Math.max(1, Math.abs(scaled))) return d;
  }
  return 12;
}

/** Rounds half away from zero, robust against binary artefacts such as 1.005 * 100 = 100.49999. */
export function roundTo(x: number, decimals: number): number {
  const factor = 10 ** decimals;
  const scaled = x * factor;
  const nudged = scaled + Math.sign(scaled) * 1e-9 * Math.max(1, Math.abs(scaled));
  return Math.sign(nudged) * Math.round(Math.abs(nudged)) / factor;
}

export function truncateTo(x: number, decimals: number): number {
  const factor = 10 ** decimals;
  const scaled = x * factor;
  return Math.trunc(scaled + Math.sign(scaled) * 1e-9 * Math.max(1, Math.abs(scaled))) / factor;
}

/** True if `value` is `exact` rounded or truncated to the decimals `value` is written with. */
export function isRoundingOf(value: number, exact: number): boolean {
  const d = decimalPlaces(value);
  return nearlyEqual(roundTo(exact, d), value) || nearlyEqual(truncateTo(exact, d), value);
}

/**
 * Accepts `value` as a match for `target`: within the tolerance (absolute degrees for angles,
 * relative otherwise), or a correct rounding of `target` to at least one decimal place
 * (0.7 for sin 45° = 0.7071 deviates by 1.005 % and is still accepted).
 */
export function acceptsValue(value: number, target: number, unit: string, tolerance: Tolerance): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(target)) return false;
  const limit = unit === ANGLE_UNIT ? tolerance.absolute_angle_deg : tolerance.relative * Math.abs(target);
  if (Math.abs(value - target) <= limit * (1 + 1e-9)) return true;
  const d = decimalPlaces(value);
  return d >= 1 && nearlyEqual(roundTo(target, d), value);
}
