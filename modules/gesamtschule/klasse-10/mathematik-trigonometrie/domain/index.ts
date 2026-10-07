export {
  BILDUNGSPLAN_CODES,
  BILDUNGSPLAN_LEVELS,
  SIN_TAN_ONLY_ON_G,
  TASK_TYPES,
  bildungsplanFor,
  levelsOf,
  taskFileSchema,
  taskSchema,
  transcribedTaskSchema,
  type BildungsplanCode,
  type Level,
  type ParameterRange,
  type Task,
  type TaskType,
  type Tolerance,
  type TranscribedTask,
} from "./schema.ts";
export {
  MISCONCEPTIONS,
  MISCONCEPTION_CODES,
  hintVariables,
  renderHint,
  type Detection,
  type Misconception,
  type MisconceptionCode,
} from "./misconceptions.ts";
export {
  arc,
  paramsValid,
  recompute,
  solutionInfo,
  solve,
  trig,
  type AngleMode,
  type ChecklistSolution,
  type ChecklistStep,
  type NumericSolution,
  type Overrides,
  type Params,
  type Solution,
  type TrigFn,
  type Values,
  type WrongPath,
} from "./solutions.ts";
export {
  VERIFICATION_STATUSES,
  detectableCodes,
  normalizeMath,
  normalizeQuantity,
  verify,
  type Evidence,
  type VerificationResult,
  type VerificationStatus,
} from "./verify.ts";
export { MAX_DRAWS, drawParameters, isAmbiguous, isDegenerate, writtenForms } from "./generator.ts";
export { createRng, drawOnGrid, fnv1a, mulberry32, type Rng } from "./random.ts";
export { acceptsValue, decimalPlaces, isRoundingOf, roundTo, truncateTo } from "./compare.ts";
export { fillTemplate, placeholders } from "./template.ts";
export { TASKS, TASK_FILES, checkTask, getTask, loadTasks } from "./tasks.ts";
// Lesson flow (A1): display format, unlock and pass rules, model inputs and outputs.
export * from "./format.ts";
export * from "./lesson.ts";
export * from "./ai.ts";
