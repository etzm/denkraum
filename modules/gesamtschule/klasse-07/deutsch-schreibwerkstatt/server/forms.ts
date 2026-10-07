// Form fields of the mission screens turned into events. Everything is validated here; the
// state machine then checks the content again (for example: marks must be exact quotes).

import type { PlanTemplate } from "../domain/rules.ts";
import type { MissionEvent, MissionRun } from "../domain/state.ts";
import { stageMedia } from "../domain/state.ts";
import { planTranscriptSchema } from "../schemas/planTranscript.ts";
import { selfCheckSchema } from "../schemas/selfCheck.ts";

/** What a form gives us; satisfied by the browser's FormData. */
export type FormFields = { get(name: string): unknown; getAll(name: string): unknown[] };

export type FormResult = { ok: true; event: MissionEvent } | { ok: false; error: "invalid" | "empty" | "too_long" };

/** Upper bound for one typed text, far above a 45 minute class test (spec 3.5). */
export const MAX_TEXT_CHARS = 12_000;
const MAX_PARAGRAPHS = 30;

function field(form: FormFields, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}

/** Field names of the typed planning sheet, identical to the boxes on paper (spec 6.2). */
export const PLAN_FIELDS = {
  thema: "thema",
  standpunkt: "standpunkt",
  argument: (i: number, part: "behauptung" | "begruendung" | "beispiel") => `a${i + 1}_${part}`,
  reihenfolge: "reihenfolge",
  schluss: "schluss",
  einwand: "einwand",
  entkraeftung: "entkraeftung",
} as const;

export function planFromForm(form: FormFields, template: PlanTemplate, withCounterArgument: boolean): FormResult {
  const argument = (i: number) =>
    template === "paragraph_template" && i > 0
      ? { behauptung: "", begruendung: "", beispiel: "" }
      : {
          behauptung: field(form, PLAN_FIELDS.argument(i, "behauptung")),
          begruendung: field(form, PLAN_FIELDS.argument(i, "begruendung")),
          beispiel: field(form, PLAN_FIELDS.argument(i, "beispiel")),
        };
  const sheet = template === "planning_sheet";
  const parsed = planTranscriptSchema.safeParse({
    thema: sheet ? field(form, PLAN_FIELDS.thema) : "",
    standpunkt: sheet ? field(form, PLAN_FIELDS.standpunkt) : "",
    argumente: [argument(0), argument(1), argument(2)],
    reihenfolge: sheet ? field(form, PLAN_FIELDS.reihenfolge) : "",
    schluss: sheet ? field(form, PLAN_FIELDS.schluss) : "",
    ...(sheet && withCounterArgument
      ? { gegenargument: { einwand: field(form, PLAN_FIELDS.einwand), entkraeftung: field(form, PLAN_FIELDS.entkraeftung) } }
      : {}),
    // Typed by the child: nothing to read, nothing uncertain.
    legibility: 1,
    uncertain: [],
  });
  if (!parsed.success) return { ok: false, error: "too_long" };
  return { ok: true, event: { type: "PLAN_TYPED", plan: parsed.data } };
}

/** Paragraphs are separated by an empty line, as on paper. */
export function paragraphsFromText(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/[ \t]*\n[ \t]*/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter((p) => p !== "");
}

export function textFromForm(form: FormFields): FormResult {
  const text = field(form, "text");
  if (text.length > MAX_TEXT_CHARS) return { ok: false, error: "too_long" };
  const paragraphs = paragraphsFromText(text);
  if (paragraphs.length > MAX_PARAGRAPHS) return { ok: false, error: "too_long" };
  // An empty text is passed on: the state machine sends it back to writing (too short).
  return { ok: true, event: { type: "TEXT_TYPED", paragraphs: paragraphs.length > 0 ? paragraphs : [""] } };
}

export function selfCheckFromForm(form: FormFields): FormResult {
  const strings = (name: string) => form.getAll(name).filter((v): v is string => typeof v === "string");
  const parsed = selfCheckSchema.safeParse({
    checkedItemIds: strings("check"),
    marks: [
      ...strings("these").map((quote) => ({ part: "these" as const, quote })),
      ...strings("beispiel").map((quote) => ({ part: "beispiel" as const, quote })),
    ],
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  return { ok: true, event: { type: "SELF_CHECK_SUBMITTED", selfCheck: parsed.data } };
}

export function planFeedbackFromForm(form: FormFields): FormResult {
  const answer = field(form, "antwort");
  if (answer.length > 1000) return { ok: false, error: "too_long" };
  return { ok: true, event: { type: "PLAN_FEEDBACK_DONE", ...(answer ? { answer } : {}) } };
}

export function revisionFromForm(form: FormFields): FormResult {
  const text = field(form, "text");
  if (text === "") return { ok: false, error: "empty" };
  if (text.length > 4000) return { ok: false, error: "too_long" };
  return { ok: true, event: { type: "REVISION_SUBMITTED", text } };
}

/** The forms of the mission screens, one per student step. */
export const STEP_KINDS = [
  "briefing",
  "plan",
  "plan_feedback",
  "start_writing",
  "text",
  "self_check",
  "start_revision",
  "revision",
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export function isStepKind(value: string): value is StepKind {
  return (STEP_KINDS as readonly string[]).includes(value);
}

/** The event for a submitted screen. Which plan form applies follows from the stage (spec 4). */
export function eventFromForm(kind: StepKind, form: FormFields, run: Pick<MissionRun, "stufe" | "niveauEEnabled">): FormResult {
  switch (kind) {
    case "briefing":
      return { ok: true, event: { type: "BRIEFING_ACK" } };
    case "plan": {
      const template = stageMedia(run.stufe).plan;
      if (template === "none") return { ok: false, error: "invalid" };
      // The planning sheet has the counter argument boxes on Niveau E (spec 6.2).
      return planFromForm(form, template, template === "planning_sheet" && run.niveauEEnabled);
    }
    case "plan_feedback":
      return planFeedbackFromForm(form);
    case "start_writing":
      return { ok: true, event: { type: "START_WRITING" } };
    case "text":
      return textFromForm(form);
    case "self_check":
      return selfCheckFromForm(form);
    case "start_revision":
      return { ok: true, event: { type: "START_REVISION" } };
    case "revision":
      return revisionFromForm(form);
  }
}
