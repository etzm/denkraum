// Seed content, validated once at load (spec 10). Approval is checked where missions are shown (D-022).

import checklistsJson from "../content/checklists.json" with { type: "json" };
import helpCardsJson from "../content/help_cards.json" with { type: "json" };
import missionsJson from "../content/missions.json" with { type: "json" };
import rubricsJson from "../content/rubrics.json" with { type: "json" };
import type { Checklist, HelpCard, Mission, Rubric } from "../schemas/content.ts";
import { checklistFileSchema, helpCardFileSchema, missionFileSchema, rubricFileSchema } from "../schemas/content.ts";

export const MISSIONS: readonly Mission[] = missionFileSchema.parse(missionsJson);
export const CHECKLISTS: readonly Checklist[] = checklistFileSchema.parse(checklistsJson);
export const HELP_CARDS: readonly HelpCard[] = helpCardFileSchema.parse(helpCardsJson);
export const RUBRICS: readonly Rubric[] = rubricFileSchema.parse(rubricsJson);

/** Missions playable in phase B1: plan and text typed (spec 11, phase 1). */
export const B1_MISSION_IDS: readonly string[] = ["m-04-01"];

/** Operator switch for content review and tests (D-022): DENKRAUM_SHOW_UNAPPROVED=true shows unapproved missions. */
export function showUnapprovedContent(env: Record<string, string | undefined> = process.env): boolean {
  return env.DENKRAUM_SHOW_UNAPPROVED === "true";
}

export function findMission(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export function checklistFor(mission: Mission): Checklist {
  const checklist = CHECKLISTS.find((c) => c.id === mission.checklistId);
  if (!checklist) throw new Error(`checklist ${mission.checklistId} missing`);
  return checklist;
}

/** Items the student sees; E items only with Niveau E. */
export function checklistItems(mission: Mission, niveauEEnabled: boolean): Checklist["items"] {
  return checklistFor(mission).items.filter((i) => !i.niveauE || niveauEEnabled);
}

export function rubricFor(mission: Mission): Rubric {
  const rubric = RUBRICS.find((r) => r.schreibform === mission.schreibform && r.niveau === "M");
  if (!rubric) throw new Error(`rubric for ${mission.schreibform} missing`);
  return rubric;
}

export function findHelpCard(id: string): HelpCard | undefined {
  return HELP_CARDS.find((c) => c.id === id);
}

/** Help cards P4 may name for the revision task: all cards of Niveau M, and HK-07 only with E. */
export function reviewHelpCards(niveauEEnabled: boolean): HelpCard[] {
  return HELP_CARDS.filter((c) => c.niveau === "M" || niveauEEnabled);
}
