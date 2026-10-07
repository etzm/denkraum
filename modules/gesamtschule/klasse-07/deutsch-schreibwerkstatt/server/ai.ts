// Calls of P2, P4 and P5 (spec 7.3). Prompt files are system prompts; the task, plan, text,
// rubric and help cards go in the user message as JSON (SW-23). The inputs are built from the
// run and the content only, so no pseudonym, code or id can reach the model; the platform
// checks that again (`assertIdentityFree`).

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateStructured, loadPrompt, type Deps as LlmDeps, type LoadedPrompt, type StructuredResult } from "@denkraum/llm";
import type { KnownIdentifiers } from "@denkraum/privacy";
import type { z } from "zod";
import { isFullTextStage } from "../domain/rules.ts";
import type { MissionRun } from "../domain/state.ts";
import { promptFlags } from "../domain/state.ts";
import type { Mission } from "../schemas/content.ts";
import type { PlanReview } from "../schemas/planReview.ts";
import { planReviewSchema } from "../schemas/planReview.ts";
import type { PlanTranscript } from "../schemas/planTranscript.ts";
import type { RevisionCheck } from "../schemas/revisionCheck.ts";
import { revisionCheckSchema } from "../schemas/revisionCheck.ts";
import type { TextReview } from "../schemas/textReview.ts";
import { textReviewSchema } from "../schemas/textReview.ts";
import type { Content } from "./content.ts";
import { MODULE_ID } from "./types.ts";

const PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "prompts");
const prompts = new Map<string, LoadedPrompt>();

/** The newest version of a prompt; the version is stored with every result (spec 0). */
export function prompt(name: string): LoadedPrompt {
  let loaded = prompts.get(name);
  if (!loaded) {
    loaded = loadPrompt(PROMPTS_DIR, name);
    prompts.set(name, loaded);
  }
  return loaded;
}

export type AiContext = {
  llm: LlmDeps;
  run: MissionRun;
  mission: Mission;
  content: Content;
  identity: KnownIdentifiers;
};

/** The task as the model sees it: topic, task text, addressee, operator, form. */
export function missionBrief(mission: Mission) {
  return {
    thema: mission.title,
    aufgabe: mission.prompt,
    adressat: mission.adressat,
    operator: mission.operator,
    form: mission.form,
  };
}

function planForPrompt(plan: PlanTranscript) {
  const { legibility: _legibility, uncertain: _uncertain, ...boxes } = plan;
  return boxes;
}

const REDACTED = "[entfernt]";
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A child may write their own pseudonym, code or an e-mail address into a text. Those parts
 * are replaced before the call, so the model never sees them and the mission goes on; the
 * platform guard (`assertIdentityFree`) still checks the final prompt.
 */
export function redactIdentity<T>(value: T, identity: KnownIdentifiers): T {
  const patterns = [
    ...(identity.pseudonym ? [identity.pseudonym] : []),
    ...(identity.accessCodes ?? []).flatMap((c) => [c, c.replace("-", "")]),
    ...(identity.ids ?? []).filter((id) => id.length >= 8),
  ].map((p) => new RegExp(escape(p), "gi"));
  const clean = (text: string) => patterns.reduce((t, p) => t.replace(p, REDACTED), text.replace(EMAIL, REDACTED));
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return clean(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, inner]) => [k, walk(inner)]));
    return v;
  };
  return walk(value) as T;
}

function call<T>(ctx: AiContext, name: string, input: unknown, schema: z.ZodType<T>) {
  return generateStructured<T>(
    {
      moduleId: MODULE_ID,
      prompt: prompt(name),
      variables: promptFlags(ctx.run),
      input: redactIdentity(input, ctx.identity),
      schema,
      identity: ctx.identity,
    },
    ctx.llm,
  );
}

export function reviewPlan(ctx: AiContext): Promise<StructuredResult<PlanReview>> {
  const plan = ctx.run.plan.confirmed;
  if (!plan) throw new Error("reviewPlan without a confirmed plan");
  return call(ctx, "plan_review", { auftrag: missionBrief(ctx.mission), plan: planForPrompt(plan) }, planReviewSchema);
}

/** Input of P4: task, plan, text, self check, rubric and the help cards to choose from. */
export function textReviewInput(ctx: Omit<AiContext, "llm" | "identity">) {
  const { run, mission, content } = ctx;
  const checklist = content.checklists.find((c) => c.id === mission.checklistId);
  const items = (checklist?.items ?? []).filter((i) => !i.niveauE || run.niveauEEnabled);
  const checked = new Set(run.selfCheck?.checkedItemIds ?? []);
  const variant = isFullTextStage(run.stufe) ? content.rubric.variants.text : content.rubric.variants.satz_absatz;
  return {
    auftrag: missionBrief(mission),
    plan: run.plan.confirmed ? planForPrompt(run.plan.confirmed) : null,
    text: { absaetze: run.text.confirmed ?? [], woerter: run.text.wordCount ?? 0 },
    selbsteinschaetzung: {
      checkliste: items.map((i) => ({ punkt: i.text, abgehakt: checked.has(i.id) })),
      markierungen: (run.selfCheck?.marks ?? []).map((m) => ({ teil: m.part, stelle: m.quote })),
    },
    rubrik: {
      titel: variant.title,
      dimensionen: {
        A_aufbau: variant.dimensions.aufbau,
        B_argumentation: variant.dimensions.argumentation,
        C_sprache: variant.dimensions.sprache,
        D_richtigkeit: variant.dimensions.richtigkeit,
      },
      ...(run.niveauEEnabled ? { e_bonus: content.rubric.eBonus } : {}),
    },
    // The model picks one; the child sees it only when the card is available (SW-14).
    hilfskarten: content.helpCards
      .filter((h) => h.niveau === "M" || run.niveauEEnabled)
      .map((h) => ({ id: h.id, titel: h.title, inhalt: h.content.intro })),
  };
}

export function reviewText(ctx: AiContext): Promise<StructuredResult<TextReview>> {
  return call(ctx, "text_review", textReviewInput(ctx), textReviewSchema);
}

export function checkRevision(ctx: AiContext): Promise<StructuredResult<RevisionCheck>> {
  const task = ctx.run.feedback.review?.revision_task;
  const text = ctx.run.revision.texts.at(-1);
  if (!task || text === undefined) throw new Error("checkRevision without task or revision");
  return call(
    ctx,
    "revision_check",
    { aufgabe: task.instruction, stelle: task.target_quote, ueberarbeitung: text },
    revisionCheckSchema,
  );
}
