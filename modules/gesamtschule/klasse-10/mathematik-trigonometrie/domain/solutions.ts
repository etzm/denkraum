import type { Niveau } from "@denkraum/core";
import { nearlyEqual, roundTo } from "./compare.ts";
import type { MisconceptionCode } from "./misconceptions.ts";

export type Params = Record<string, number>;
export type Values = Record<string, number>;
/** Replaces intermediate values, e.g. { sin_alpha: 0.6 } to recompute with a rounded sine. */
export type Overrides = Partial<Record<string, number>>;

export interface WrongPath {
  /** Stable identifier, e.g. "rad_mode". */
  id: string;
  /** Misconceptions explaining this path. Some paths fit two codes (umsetzungsplan section 6.2). */
  codes: MisconceptionCode[];
  /** Results of the path, only for the quantities it changes. */
  values: Values;
  /** Variables for the hint templates of the codes, e.g. { fn: "tan" } for F4. */
  hint_vars?: Record<string, string>;
}

export interface ChecklistStep {
  id: string;
  /** Student-facing description of the step. */
  description: string;
  /**
   * The step counts as present if all regular expressions of at least one group match the
   * normalised transcription (see normalizeMath in verify.ts).
   */
  patterns: readonly (readonly string[])[];
}

export interface NumericSolution {
  kind: "numeric";
  /** Sought values and all intermediate values. */
  values: Values;
  /** Unit per value: "°" for angles, "" for ratios. */
  units: Readonly<Record<string, string>>;
  /** Intermediate values students tend to round too early (F5). */
  roundable: readonly string[];
  wrongPaths: WrongPath[];
}

export interface ChecklistSolution {
  kind: "checklist";
  steps: readonly ChecklistStep[];
}

export type Solution = NumericSolution | ChecklistSolution;

// ---------------------------------------------------------------------------
// Calculator model

export type AngleMode = "deg" | "rad" | "grad";
export type TrigFn = "sin" | "cos" | "tan";

const RADIANS_PER_UNIT: Record<AngleMode, number> = { deg: Math.PI / 180, rad: 1, grad: Math.PI / 200 };
const INVERSE: Record<TrigFn, (x: number) => number> = { sin: Math.asin, cos: Math.acos, tan: Math.atan };

/** What a calculator shows for fn(x) in the given angle mode. */
export function trig(fn: TrigFn, x: number, mode: AngleMode = "deg"): number {
  return Math[fn](x * RADIANS_PER_UNIT[mode]);
}

/** What a calculator shows for fn⁻¹(ratio) in the given angle mode. */
export function arc(fn: TrigFn, ratio: number, mode: AngleMode = "deg"): number {
  return INVERSE[fn](ratio) / RADIANS_PER_UNIT[mode];
}

// ---------------------------------------------------------------------------
// Typical wrong paths shared by several tasks

/** F1: calculator in RAD or GRAD (gon) mode instead of DEG. */
function calculatorModePaths(valuesIn: (mode: AngleMode) => Values): WrongPath[] {
  return (["rad", "grad"] as const).map((mode): WrongPath => ({
    id: `${mode}_mode`,
    codes: ["F1"],
    values: valuesIn(mode),
  }));
}

/** F4: fn(x), 1/x or 1/fn(x) instead of fn⁻¹(x). */
function inverseFunctionPaths(fn: TrigFn, ratio: number, toValues: (angle: number) => Values): WrongPath[] {
  const hint_vars = { fn };
  return [
    { id: `${fn}_instead_of_inverse`, codes: ["F4"], values: toValues(trig(fn, ratio)), hint_vars },
    { id: "reciprocal_of_ratio", codes: ["F4"], values: toValues(1 / ratio), hint_vars },
    { id: `reciprocal_of_${fn}`, codes: ["F4"], values: toValues(1 / trig(fn, ratio)), hint_vars },
  ];
}

// ---------------------------------------------------------------------------
// Definitions

interface NumericDef {
  kind: "numeric";
  params: readonly string[];
  units: Readonly<Record<string, string>>;
  roundable: readonly string[];
  valid: (p: Params) => boolean;
  compute: (p: Params, level: Niveau, o: Overrides) => Values;
  wrongPaths: (p: Params, level: Niveau) => WrongPath[];
}

interface ChecklistDef {
  kind: "checklist";
  steps: readonly ChecklistStep[];
}

interface NumericSpec<P extends string> {
  params: readonly P[];
  units: Readonly<Record<string, string>>;
  roundable?: readonly string[];
  /** Task-specific degeneracy check beyond positive parameters. */
  valid?: (p: Record<P, number>) => boolean;
  compute: (p: Record<P, number>, level: Niveau, o: Overrides) => Values;
  wrongPaths: (p: Record<P, number>, level: Niveau) => WrongPath[];
}

function numeric<P extends string>(spec: NumericSpec<P>): NumericDef {
  const pick = (p: Params): Record<P, number> => {
    const out = {} as Record<P, number>;
    for (const key of spec.params) {
      const value = p[key];
      if (value === undefined) throw new Error(`missing parameter "${key}"`);
      out[key] = value;
    }
    return out;
  };
  return {
    kind: "numeric",
    params: spec.params,
    units: spec.units,
    roundable: spec.roundable ?? [],
    valid: (p) => spec.valid?.(pick(p)) ?? true,
    compute: (p, level, o) => spec.compute(pick(p), level, o),
    wrongPaths: (p, level) => spec.wrongPaths(pick(p), level),
  };
}

/** L6-A1: the G variant has no eye height (spec A 4.2). */
const eyeHeightOn = (level: Niveau, eye: number) => (level === "G" ? 0 : eye);

const SOLUTIONS: Readonly<Record<string, NumericDef | ChecklistDef>> = {
  // Similar triangles with stretch factor k.
  "L1-A1": numeric({
    params: ["a1", "b1", "c1", "k"],
    units: { a2: "cm", b2: "cm", c2: "cm", ratio_1: "", ratio_2: "", ratio: "" },
    valid: ({ a1, b1, c1 }) => nearlyEqual(a1 ** 2 + b1 ** 2, c1 ** 2),
    compute: ({ a1, b1, c1, k }) => {
      const [a2, b2, c2] = [k * a1, k * b1, k * c1];
      const ratio_1 = Math.min(a1, b1) / c1;
      const ratio_2 = Math.min(a2, b2) / c2;
      return { a2, b2, c2, ratio_1, ratio_2, ratio: ratio_1 };
    },
    wrongPaths: ({ a1, b1 }) => [
      // Short leg divided by the long leg: a leg taken as the hypotenuse.
      { id: "leg_as_hypotenuse", codes: ["F8"], values: { ratio: Math.min(a1, b1) / Math.max(a1, b1) } },
    ],
  }),

  // Shadow of a stick and of a tree (Strahlensatz).
  "L1-A2": numeric({
    params: ["stick", "stick_shadow", "tree_shadow"],
    units: { ratio: "", h: "m" },
    roundable: ["ratio"],
    compute: ({ stick, stick_shadow, tree_shadow }, _level, o) => {
      const ratio = o.ratio ?? stick / stick_shadow;
      return { ratio, h: ratio * tree_shadow };
    },
    wrongPaths: ({ stick, stick_shadow, tree_shadow }) => [
      // h : 12 = 1.5 : 2, then divided instead of multiplied: h = 12 : 0.75.
      {
        id: "divided_by_ratio",
        codes: ["F6"],
        values: { h: tree_shadow / (stick / stick_shadow) },
        hint_vars: { side: "der Schattenlänge des Baums" },
      },
      // Stick placed in the tree's shadow: the part between stick and tree used instead of the whole shadow.
      {
        id: "partial_segment",
        codes: ["F10"],
        values: { h: (stick / stick_shadow) * (tree_shadow - stick_shadow) },
      },
    ],
  }),

  // Values without a calculator.
  "L3-A1": numeric({
    params: [],
    units: { sin30: "", tan45: "", cos60: "", sin45: "" },
    compute: () => specialValues("deg"),
    wrongPaths: () => calculatorModePaths(specialValues),
  }),

  // Calculator check.
  "L3-A2": numeric({
    params: [],
    units: { sin30: "" },
    compute: () => ({ sin30: trig("sin", 30) }),
    wrongPaths: () => calculatorModePaths((mode) => ({ sin30: trig("sin", 30, mode) })),
  }),

  // gamma = 90°, given c and alpha, sought a and b.
  "L4-A2": numeric({
    params: ["c", "alpha"],
    units: { sin_alpha: "", cos_alpha: "", a: "cm", b: "cm", pythagoras_check: "cm²" },
    roundable: ["sin_alpha", "cos_alpha"],
    compute: ({ c, alpha }, _level, o) => {
      const sin_alpha = o.sin_alpha ?? trig("sin", alpha);
      const cos_alpha = o.cos_alpha ?? trig("cos", alpha);
      const a = c * sin_alpha;
      const b = c * cos_alpha;
      return { sin_alpha, cos_alpha, a, b, pythagoras_check: a ** 2 + b ** 2 };
    },
    wrongPaths: ({ c, alpha }) => {
      const side = { side: "c" };
      return [
        ...calculatorModePaths((mode) => ({ a: c * trig("sin", alpha, mode), b: c * trig("cos", alpha, mode) })),
        { id: "sin_cos_swapped", codes: ["F2", "F3"], values: { a: c * trig("cos", alpha), b: c * trig("sin", alpha) } },
        { id: "tan_instead", codes: ["F3"], values: { a: c * trig("tan", alpha), b: c * trig("tan", alpha) } },
        { id: "ratio_divided_by_c", codes: ["F6"], values: { a: trig("sin", alpha) / c, b: trig("cos", alpha) / c }, hint_vars: side },
        { id: "c_divided_by_ratio", codes: ["F6"], values: { a: c / trig("sin", alpha), b: c / trig("cos", alpha) }, hint_vars: side },
      ];
    },
  }),

  // Faded: gamma = 90°, given c and beta, sought b (opposite of beta).
  "L4-A3": numeric({
    params: ["c", "beta"],
    units: { sin_beta: "", b: "cm" },
    roundable: ["sin_beta"],
    compute: ({ c, beta }, _level, o) => {
      const sin_beta = o.sin_beta ?? trig("sin", beta);
      return { sin_beta, b: c * sin_beta };
    },
    wrongPaths: ({ c, beta }) => {
      const side = { side: "c" };
      return [
        ...calculatorModePaths((mode) => ({ b: c * trig("sin", beta, mode) })),
        { id: "cos_instead_of_sin", codes: ["F2", "F3"], values: { b: c * trig("cos", beta) } },
        { id: "tan_instead_of_sin", codes: ["F3"], values: { b: c * trig("tan", beta) } },
        { id: "ratio_divided_by_c", codes: ["F6"], values: { b: trig("sin", beta) / c }, hint_vars: side },
        { id: "c_divided_by_ratio", codes: ["F6"], values: { b: c / trig("sin", beta) }, hint_vars: side },
      ];
    },
  }),

  // Legs a and b given, sought alpha (opposite a) and beta.
  "L5-A1": numeric({
    params: ["a", "b"],
    units: { tan_alpha: "", alpha: "°", beta: "°" },
    roundable: ["tan_alpha"],
    compute: ({ a, b }, _level, o) => {
      const tan_alpha = o.tan_alpha ?? a / b;
      const alpha = arc("tan", tan_alpha);
      return { tan_alpha, alpha, beta: 90 - alpha };
    },
    wrongPaths: ({ a, b }) => {
      const angles = (alpha: number): Values => ({ alpha, beta: 90 - alpha });
      return [
        ...calculatorModePaths((mode) => angles(arc("tan", a / b, mode))),
        { id: "legs_swapped", codes: ["F2"], values: angles(arc("tan", b / a)) },
        { id: "sin_instead_of_tan", codes: ["F3"], values: angles(arc("sin", a / b)) },
        ...inverseFunctionPaths("tan", a / b, angles),
      ];
    },
  }),

  // Hypotenuse c and opposite a given, sought alpha.
  "L5-A2": numeric({
    params: ["c", "a"],
    units: { sin_alpha: "", alpha: "°" },
    roundable: ["sin_alpha"],
    valid: ({ c, a }) => a < c,
    compute: ({ c, a }, _level, o) => {
      const sin_alpha = o.sin_alpha ?? a / c;
      return { sin_alpha, alpha: arc("sin", sin_alpha) };
    },
    wrongPaths: ({ c, a }) => {
      const angle = (alpha: number): Values => ({ alpha });
      return [
        ...calculatorModePaths((mode) => angle(arc("sin", a / c, mode))),
        { id: "cos_instead_of_sin", codes: ["F2", "F3"], values: angle(arc("cos", a / c)) },
        { id: "tan_instead_of_sin", codes: ["F3"], values: angle(arc("tan", a / c)) },
        ...inverseFunctionPaths("sin", a / c, angle),
      ];
    },
  }),

  // Tower: distance d, angle of elevation alpha, eye height (not on G).
  "L6-A1": numeric({
    params: ["d", "alpha", "eye"],
    units: { tan_alpha: "", x: "m", h: "m" },
    roundable: ["tan_alpha"],
    compute: ({ d, alpha, eye }, level, o) => {
      const tan_alpha = o.tan_alpha ?? trig("tan", alpha);
      const x = d * tan_alpha;
      return { tan_alpha, x, h: x + eyeHeightOn(level, eye) };
    },
    wrongPaths: ({ d, alpha, eye }, level) => {
      const height = (x: number): Values => ({ h: x + eyeHeightOn(level, eye) });
      const side = { side: "dem Abstand zum Turm" };
      return [
        ...calculatorModePaths((mode) => height(d * trig("tan", alpha, mode))),
        // tan alpha = d / x (legs swapped) or x / d = tan alpha rearranged to x = d / tan alpha.
        { id: "distance_divided_by_tan", codes: ["F2", "F6"], values: height(d / trig("tan", alpha)), hint_vars: side },
        { id: "sin_instead_of_tan", codes: ["F3"], values: height(d * trig("sin", alpha)) },
        { id: "cos_instead_of_tan", codes: ["F3"], values: height(d * trig("cos", alpha)) },
        { id: "tan_divided_by_distance", codes: ["F6"], values: height(trig("tan", alpha) / d), hint_vars: side },
      ];
    },
  }),

  // Ladder against a wall: length and distance from the wall, sought alpha and height.
  "L6-A2": numeric({
    params: ["ladder", "distance"],
    units: { cos_alpha: "", alpha: "°", sin_alpha: "", h: "m", h_pythagoras: "m" },
    roundable: ["alpha", "sin_alpha"],
    valid: ({ ladder, distance }) => distance < ladder,
    compute: ({ ladder, distance }, _level, o) => {
      const cos_alpha = o.cos_alpha ?? distance / ladder;
      const alpha = o.alpha ?? arc("cos", cos_alpha);
      const sin_alpha = o.sin_alpha ?? trig("sin", alpha);
      return {
        cos_alpha,
        alpha,
        sin_alpha,
        h: ladder * sin_alpha,
        h_pythagoras: Math.sqrt(ladder ** 2 - distance ** 2),
      };
    },
    wrongPaths: ({ ladder, distance }) => {
      const r = distance / ladder;
      const following = (alpha: number): Values => ({ alpha, h: ladder * trig("sin", alpha) });
      return [
        // In RAD or GRAD mode, cos⁻¹ and sin are consistent, so only alpha is off.
        ...calculatorModePaths((mode) => ({ alpha: arc("cos", r, mode) })),
        { id: "sin_instead_of_cos", codes: ["F2", "F3"], values: following(arc("sin", r)) },
        { id: "tan_instead_of_cos", codes: ["F3"], values: following(arc("tan", r)) },
        ...inverseFunctionPaths("cos", r, (alpha) => ({ alpha })),
        // Pythagoras with the ladder as a leg: sqrt(4² + 1.2²).
        { id: "ladder_as_leg", codes: ["F8"], values: { h: Math.sqrt(ladder ** 2 + distance ** 2) } },
      ];
    },
  }),

  // Road gradient in percent, sought angle. No F3 path: sin⁻¹(0.12) = 6.89° is within 0.5° of 6.84°.
  "L6-A3": numeric({
    params: ["p"],
    units: { tan_alpha: "", alpha: "°" },
    compute: ({ p }) => {
      const tan_alpha = p / 100;
      return { tan_alpha, alpha: arc("tan", tan_alpha) };
    },
    wrongPaths: ({ p }) => {
      const angle = (alpha: number): Values => ({ alpha });
      return [
        { id: "percent_as_degrees", codes: ["F12"], values: angle(p), hint_vars: { percent: String(p).replace(".", ",") } },
        ...calculatorModePaths((mode) => angle(arc("tan", p / 100, mode))),
        { id: "legs_swapped", codes: ["F2"], values: angle(arc("tan", 100 / p)) },
        ...inverseFunctionPaths("tan", p / 100, angle),
      ];
    },
  }),

  // Derivation of sin² + cos² = 1 (spec A 4.2): step checklist, no numbers.
  "L7-A1": {
    kind: "checklist",
    steps: [
      {
        id: "pythagoras",
        description: "Satz des Pythagoras aufschreiben: a² + b² = c²",
        patterns: [["a²\\+b²=c²"], ["b²\\+a²=c²"], ["c²=a²\\+b²"], ["c²=b²\\+a²"]],
      },
      {
        id: "divide_by_c_squared",
        description: "Beide Seiten durch c² teilen",
        patterns: [["a²/c²"], ["b²/c²"], ["durchc²"], ["\\|/c²"]],
      },
      {
        id: "ratios_squared",
        description: "Als Quadrate von Seitenverhältnissen schreiben: (a/c)² + (b/c)² = 1",
        patterns: [["\\(a/c\\)²", "\\(b/c\\)²"]],
      },
      {
        id: "definitions",
        description: "Definitionen einsetzen: sin α = a/c und cos α = b/c, also sin²α + cos²α = 1",
        patterns: [
          ["sin²α\\+cos²α=1"],
          ["cos²α\\+sin²α=1"],
          ["\\(sinα\\)²\\+\\(cosα\\)²=1"],
          ["sinα²\\+cosα²=1"],
        ],
      },
    ],
  },
};

function specialValues(mode: AngleMode): Values {
  return {
    sin30: trig("sin", 30, mode),
    tan45: trig("tan", 45, mode),
    cos60: trig("cos", 60, mode),
    sin45: trig("sin", 45, mode),
  };
}

// ---------------------------------------------------------------------------
// Public API

function definition(fn: string): NumericDef | ChecklistDef {
  const def = SOLUTIONS[fn];
  if (!def) throw new Error(`unknown solution_fn "${fn}"`);
  return def;
}

/** Kind and parameter names of a solution function, or undefined if it does not exist. */
export function solutionInfo(fn: string): { kind: Solution["kind"]; params: readonly string[] } | undefined {
  const def = SOLUTIONS[fn];
  if (!def) return undefined;
  return { kind: def.kind, params: def.kind === "numeric" ? def.params : [] };
}

/** Task-specific validity of the parameters (e.g. ladder longer than its distance to the wall). */
export function paramsValid(fn: string, params: Params): boolean {
  const def = definition(fn);
  return def.kind === "checklist" || def.valid(params);
}

/** Model solution with all intermediate values and the results of the typical wrong paths. */
export function solve(fn: string, params: Params, level: Niveau): Solution {
  const def = definition(fn);
  if (def.kind === "checklist") return { kind: "checklist", steps: def.steps };
  const values = def.compute(params, level, {});
  const wrongPaths = [...def.wrongPaths(params, level), ...earlyRoundingPaths(def, params, level, values)]
    .map((path) => ({ ...path, values: finiteOnly(path.values) }))
    .filter((path) => Object.keys(path.values).length > 0);
  return { kind: "numeric", values, units: def.units, roundable: def.roundable, wrongPaths };
}

/** Recomputes all values with some intermediate values replaced (used to detect F5). */
export function recompute(fn: string, params: Params, level: Niveau, overrides: Overrides): Values {
  const def = definition(fn);
  if (def.kind === "checklist") throw new Error(`${fn} has no numeric solution`);
  return def.compute(params, level, overrides);
}

/**
 * F5 paths: each roundable intermediate value rounded to 1 and 2 decimals.
 * For information only: verify.ts detects F5 through the transcribed intermediate values.
 */
function earlyRoundingPaths(def: NumericDef, params: Params, level: Niveau, values: Values): WrongPath[] {
  const paths: WrongPath[] = [];
  for (const key of def.roundable) {
    const exact = values[key];
    if (exact === undefined) throw new Error(`roundable value "${key}" is not computed`);
    for (const decimals of [1, 2]) {
      const rounded = roundTo(exact, decimals);
      if (nearlyEqual(rounded, exact)) continue;
      const changed = def.compute(params, level, { [key]: rounded });
      const affected = Object.entries(changed).filter(
        ([k, v]) => k !== key && !nearlyEqual(v, values[k] ?? Number.NaN),
      );
      paths.push({ id: `early_rounding_${key}_${decimals}`, codes: ["F5"], values: Object.fromEntries(affected) });
    }
  }
  return paths;
}

function finiteOnly(values: Values): Values {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => Number.isFinite(v)));
}
