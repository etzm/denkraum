// German texts of the mission screens (Du-Form for the child, D-009). No dashes.

import type { StartBlocker } from "../domain/rules.ts";
import type { MissionState, SystemAction } from "../domain/state.ts";
import type { Ampel, Stufe } from "../schemas/common.ts";

export const STAGE_TITLES: Record<string, string> = {
  "1": "Vom Gedanken zum Satz",
  "2": "Vom Satz zum Absatz",
  "3": "Vom Absatz zum Plan",
  "4": "Der ganze Text",
  "5": "Überarbeiten wie ein Profi",
  "6": "Die andere Seite",
  boss: "Klassenarbeit",
};

export function stageLabel(stufe: Stufe): string {
  return stufe === "boss" ? "Boss-Mission" : `Stufe ${stufe}`;
}

export const BLOCKER_TEXT: Record<StartBlocker, string> = {
  not_approved: "Diese Mission ist noch nicht freigegeben.",
  niveau_e_required: "Diese Mission gehört zu Niveau E.",
  stage_locked: "Diese Stufe ist noch verschlossen.",
  station_not_passed: "Schaff zuerst die Übungsstation davor.",
  previous_mission_open: "Schließ zuerst die Mission davor ab.",
};

export const STEP_TITLES: Partial<Record<MissionState, string>> = {
  briefing: "Dein Auftrag",
  planning: "Plane deinen Text",
  plan_feedback: "Rückmeldung zu deinem Plan",
  plan_revise: "Ergänze deinen Plan",
  plan_approved: "Dein Plan ist freigegeben",
  writing: "Schreib deinen Text",
  self_check: "Prüf deinen Text selbst",
  ai_feedback: "Rückmeldung zu deinem Text",
  revision: "Überarbeite eine Stelle",
  completed: "Mission geschafft",
  held_for_adult: "Kurze Pause",
};

export const PENDING_TEXT: Record<SystemAction, string> = {
  transcribe_plan: "Ich lese deinen Plan.",
  review_plan: "Ich lese deinen Plan.",
  transcribe_text: "Ich lese deinen Text.",
  review_text: "Ich lese deinen Text.",
  check_revision: "Ich prüfe deine Überarbeitung.",
  notify_adult: "Ein Erwachsener schaut sich deinen Text an.",
};

export const DIMENSIONS = [
  { key: "aufbau", label: "A Aufbau" },
  { key: "argumentation", label: "B Argumentation" },
  { key: "sprache", label: "C Sprache und Formulierung" },
  { key: "richtigkeit", label: "D Richtigkeit" },
] as const;

export const PLAN_CRITERIA = [
  { key: "P1", label: "Standpunkt" },
  { key: "P2", label: "Anzahl Argumente" },
  { key: "P3", label: "Vollständigkeit" },
  { key: "P4", label: "Reihenfolge" },
  { key: "P5", label: "Schlussidee" },
] as const;

export const AMPEL_TEXT: Record<Ampel, string> = { gruen: "grün", gelb: "gelb", rot: "rot" };

export const ERROR_TEXT: Record<string, string> = {
  ki: "Die Rückmeldung hat gerade nicht geklappt. Deine Arbeit ist gespeichert. Versuch es gleich noch einmal.",
  ungueltig: "Das ging an dieser Stelle nicht. Lade die Seite neu und versuch es noch einmal.",
  zu_lang: "Das ist zu lang. Kürze bitte ein wenig.",
  leer: "Hier fehlt noch etwas. Schreib bitte zuerst etwas hinein.",
  markierung: "Markiere nur Sätze aus deinem eigenen Text.",
};

/** The three questions before writing (spec 2.2). */
export const THREE_QUESTIONS = ["Was meine ich?", "Warum?", "Woran sieht man das?"];

export const AI_LABEL = "Diese Rückmeldung hat eine KI formuliert. Sie hilft dir beim Üben und ist keine Note.";
