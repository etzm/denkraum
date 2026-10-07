// Server actions behind the mission forms. Each one reads the form, turns it into one state
// machine event and lets the engine apply it. The UI never sets a state.

import type { ActionResult, ModuleAction, ModuleContext } from "@denkraum/sdk";
import { revisionTaskFor, splitSentences } from "../domain/feedback.ts";
import { isMissionShown } from "../domain/rules.ts";
import { createRun } from "../domain/state.ts";
import { countWords, paragraphsToText } from "../domain/text.ts";
import type { Mission } from "../schemas/content.ts";
import type { PlanTranscript } from "../schemas/planTranscript.ts";
import type { SelfCheck } from "../schemas/selfCheck.ts";
import { selfCheckSchema } from "../schemas/selfCheck.ts";
import { B1_MISSION_IDS, checklistItems, findMission, showUnapprovedContent } from "./content.ts";
import { commit, commitSubmission, runSystemActions } from "./engine.ts";
import type { RunRow } from "./store.ts";
import { findRun, insertRun } from "./store.ts";

/** Field limits match the schemas (planTranscript boxes, textTranscript paragraphs). */
const BOX_MAX = 1000;
const PARAGRAPH_MAX = 4000;
const PARAGRAPHS_MAX = 30;
const ANSWER_MAX = 500;
const REVISION_MAX = 2000;
const MARK_MAX = 2000;

const field = (form: FormData, name: string, max: number): string => {
  const value = form.get(name);
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim().slice(0, max) : "";
};

export function runPath(ctx: Pick<ModuleContext, "basePath">, runId: string): string {
  return `${ctx.basePath}/lauf/${runId}`;
}

/** The typed plan form has the same boxes as the planning sheet (spec 6.2, P1). */
export function planFromForm(form: FormData): PlanTranscript {
  const argument = (n: number) => ({
    behauptung: field(form, `a${n}_behauptung`, BOX_MAX),
    begruendung: field(form, `a${n}_begruendung`, BOX_MAX),
    beispiel: field(form, `a${n}_beispiel`, BOX_MAX),
  });
  return {
    thema: field(form, "thema", BOX_MAX),
    standpunkt: field(form, "standpunkt", BOX_MAX),
    argumente: [argument(1), argument(2), argument(3)],
    reihenfolge: field(form, "reihenfolge", BOX_MAX),
    schluss: field(form, "schluss", BOX_MAX),
    // Typed input has no reading uncertainty.
    legibility: 1,
    uncertain: [],
  };
}

/** Each line is a paragraph; empty lines are dropped. */
export function paragraphsFromForm(form: FormData): string[] {
  const raw = field(form, "text", PARAGRAPH_MAX * PARAGRAPHS_MAX);
  return raw
    .split(/\n+/)
    .map((p) => p.trim().slice(0, PARAGRAPH_MAX))
    .filter((p) => p !== "")
    .slice(0, PARAGRAPHS_MAX);
}

/** Ticked checklist items and the optional marks, rebuilt from sentence numbers so every mark is an exact quote. */
export function selfCheckFromForm(form: FormData, paragraphs: readonly string[], allowedItemIds: readonly string[]): SelfCheck {
  // Marks longer than the schema allows are skipped; marking is optional.
  const sentences = splitSentences(paragraphs).map((s) => (s.length <= MARK_MAX ? s : undefined));
  const pick = (value: FormDataEntryValue) => sentences[Number(value)];
  const marks: SelfCheck["marks"] = [];
  const these = form.get("these");
  if (typeof these === "string" && pick(these)) marks.push({ part: "these", quote: pick(these)! });
  for (const value of form.getAll("beispiel")) {
    const quote = pick(value);
    if (quote && !marks.some((m) => m.part === "beispiel" && m.quote === quote)) marks.push({ part: "beispiel", quote });
  }
  const checked = form.getAll("punkt").filter((v): v is string => typeof v === "string" && allowedItemIds.includes(v));
  return selfCheckSchema.parse({ checkedItemIds: [...new Set(checked)], marks: marks.slice(0, 20) });
}

type Loaded = { row: RunRow; mission: Mission };

/** The learner's own run of a mission that is playable and shown (D-022). */
async function loadRun(ctx: ModuleContext, form: FormData): Promise<Loaded | null> {
  const runId = form.get("lauf");
  if (typeof runId !== "string") return null;
  const row = await findRun(ctx.db, ctx.learner.id, runId);
  const mission = row ? findMission(row.missionId) : undefined;
  if (!row || !mission || !isMissionShown(mission, showUnapprovedContent())) return null;
  return { row, mission };
}

/** Wraps an action on an existing run: unknown runs go back to the start page, everything else to the run page. */
function onRun(fn: (ctx: ModuleContext, loaded: Loaded, form: FormData) => Promise<void>): ModuleAction {
  return async (ctx, form): Promise<ActionResult> => {
    const loaded = await loadRun(ctx, form);
    if (!loaded) return { redirect: ctx.basePath };
    await fn(ctx, loaded, form);
    return { redirect: runPath(ctx, loaded.row.id) };
  };
}

export const ACTIONS: Record<string, ModuleAction> = {
  async starten(ctx, form) {
    const missionId = form.get("mission");
    const mission = typeof missionId === "string" ? findMission(missionId) : undefined;
    if (!mission || !B1_MISSION_IDS.includes(mission.id) || !isMissionShown(mission, showUnapprovedContent())) {
      return { redirect: ctx.basePath };
    }
    const run = createRun({ missionId: mission.id, stufe: mission.stufe, niveauEEnabled: ctx.learner.niveauEEnabled });
    const row = await insertRun(ctx.db, { learnerId: ctx.learner.id, run, now: ctx.now });
    return { redirect: runPath(ctx, row.id) };
  },

  auftrag: onRun(async (ctx, { row }) => {
    await commit(ctx, row, { type: "BRIEFING_ACK" });
  }),

  plan: onRun(async (ctx, { row, mission }, form) => {
    const plan = planFromForm(form);
    const saved = await commitSubmission(ctx, row, { type: "PLAN_TYPED", plan }, {
      kind: "plan",
      round: (next) => next.plan.round,
      content: () => plan,
    });
    if (saved) await runSystemActions(ctx, saved, mission);
  }),

  planWeiter: onRun(async (ctx, { row }, form) => {
    const answer = field(form, "antwort", ANSWER_MAX);
    await commit(ctx, row, { type: "PLAN_FEEDBACK_DONE", ...(answer ? { answer } : {}) });
  }),

  schreiben: onRun(async (ctx, { row }) => {
    await commit(ctx, row, { type: "START_WRITING" });
  }),

  text: onRun(async (ctx, { row }, form) => {
    const paragraphs = paragraphsFromForm(form);
    if (paragraphs.length === 0) return;
    await commitSubmission(ctx, row, { type: "TEXT_TYPED", paragraphs }, {
      kind: "text",
      round: (next) => next.text.round,
      content: () => ({ paragraphs, word_count: countWords(paragraphsToText(paragraphs)), legibility: 1, uncertain: [] }),
    });
  }),

  selbstkontrolle: onRun(async (ctx, { row, mission }, form) => {
    const paragraphs = row.data.text.confirmed ?? [];
    const allowed = checklistItems(mission, row.data.niveauEEnabled).map((i) => i.id);
    const saved = await commit(ctx, row, { type: "SELF_CHECK_SUBMITTED", selfCheck: selfCheckFromForm(form, paragraphs, allowed) });
    if (saved) await runSystemActions(ctx, saved, mission);
  }),

  ueberarbeiten: onRun(async (ctx, { row }) => {
    await commit(ctx, row, { type: "START_REVISION" });
  }),

  ueberarbeitung: onRun(async (ctx, { row, mission }, form) => {
    const text = field(form, "ueberarbeitung", REVISION_MAX);
    const task = revisionTaskFor(row.data);
    if (text === "" || !task) return;
    const saved = await commitSubmission(ctx, row, { type: "REVISION_SUBMITTED", text }, {
      kind: "revision",
      round: (next) => next.revision.texts.length,
      content: () => ({ text, task }),
    });
    if (saved) await runSystemActions(ctx, saved, mission);
  }),

  /** "Rückmeldung holen": resumes a system action that was interrupted (spec 4: every state resumable). */
  weiter: onRun(async (ctx, { row, mission }) => {
    await runSystemActions(ctx, row, mission);
  }),
};
