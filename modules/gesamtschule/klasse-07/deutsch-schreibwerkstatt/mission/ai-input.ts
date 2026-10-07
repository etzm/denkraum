// User message data for P2, P4 and P5 (SW-23): task, plan, text, rubric, help cards.
// Never anything about the person: no pseudonym, no code, no ids (the platform guard checks it too).

import type { RevisionTask } from "../domain/feedback.ts";
import type { MissionRun } from "../domain/state.ts";
import type { Mission } from "../schemas/content.ts";
import type { PlanTranscript } from "../schemas/planTranscript.ts";
import { checklistItems, reviewHelpCards, rubricFor } from "./content.ts";

export type TaskInput = { thema: string; adressat: string | null; operator: string; aufgabe: string };

export type PlanInput = {
  thema: string;
  standpunkt: string;
  argumente: { behauptung: string; begruendung: string; beispiel: string }[];
  reihenfolge: string;
  schluss: string;
  gegenargument?: { einwand: string; entkraeftung: string };
};

export type PlanReviewInput = { auftrag: TaskInput; plan: PlanInput };

export type TextReviewInput = {
  auftrag: TaskInput;
  plan: PlanInput | null;
  text: { absaetze: string[]; woerter: number };
  selbsteinschaetzung: { checkliste: { punkt: string; abgehakt: boolean }[]; markierungen: { teil: string; zitat: string }[] };
  rubrik: { dimensionen: { name: string; hinweis?: string; sterne: string[] }[]; e_bonus?: string[] };
  hilfskarten: { id: string; titel: string; satzanfaenge: string[] }[];
};

export type RevisionCheckInput = { aufgabe: string; stelle: string; ueberarbeitung: string };

export function taskInput(mission: Mission): TaskInput {
  return { thema: mission.title, adressat: mission.adressat, operator: mission.operator, aufgabe: mission.prompt };
}

export function planInput(plan: PlanTranscript): PlanInput {
  return {
    thema: plan.thema,
    standpunkt: plan.standpunkt,
    argumente: plan.argumente.map((a) => ({ behauptung: a.behauptung, begruendung: a.begruendung, beispiel: a.beispiel })),
    reihenfolge: plan.reihenfolge,
    schluss: plan.schluss,
    ...(plan.gegenargument ? { gegenargument: plan.gegenargument } : {}),
  };
}

export function planReviewInput(mission: Mission, run: MissionRun): PlanReviewInput {
  if (!run.plan.confirmed) throw new Error("no confirmed plan");
  return { auftrag: taskInput(mission), plan: planInput(run.plan.confirmed) };
}

export function textReviewInput(mission: Mission, run: MissionRun): TextReviewInput {
  const paragraphs = run.text.confirmed;
  if (!paragraphs) throw new Error("no confirmed text");
  const checked = new Set(run.selfCheck?.checkedItemIds ?? []);
  const rubric = rubricFor(mission);
  return {
    auftrag: taskInput(mission),
    plan: run.plan.confirmed ? planInput(run.plan.confirmed) : null,
    text: { absaetze: paragraphs, woerter: run.text.wordCount ?? 0 },
    selbsteinschaetzung: {
      checkliste: checklistItems(mission, run.niveauEEnabled).map((i) => ({ punkt: i.text, abgehakt: checked.has(i.id) })),
      markierungen: (run.selfCheck?.marks ?? []).map((m) => ({ teil: m.part, zitat: m.quote })),
    },
    rubrik: {
      dimensionen: rubric.dimensions.map((d) => ({ name: d.label, ...(d.note ? { hinweis: d.note } : {}), sterne: d.levels })),
      ...(run.niveauEEnabled ? { e_bonus: rubric.eBonus } : {}),
    },
    hilfskarten: reviewHelpCards(run.niveauEEnabled).map((c) => ({ id: c.id, titel: c.title, satzanfaenge: c.content.phrases })),
  };
}

export function revisionCheckInput(task: RevisionTask, revised: string): RevisionCheckInput {
  return { aufgabe: task.instruction, stelle: task.targetQuote, ueberarbeitung: revised };
}
