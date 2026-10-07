// Synthetic test data. No real student material (docs/datenschutz/README.md, section 7).

import { readFileSync } from "node:fs";
import type { Mission } from "../schemas/content.ts";
import { missionFileSchema } from "../schemas/content.ts";
import type { PlanReview } from "../schemas/planReview.ts";
import type { PlanTranscript } from "../schemas/planTranscript.ts";
import type { RevisionCheck } from "../schemas/revisionCheck.ts";
import type { TextReview } from "../schemas/textReview.ts";
import type { TextTranscript } from "../schemas/textTranscript.ts";

export const MODULE_ROOT = new URL("../", import.meta.url);

export function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, MODULE_ROOT), "utf8"));
}

/** Content missions with `approved` set, so unlock rules can be tested. */
export function approvedMissions(): Mission[] {
  return missionFileSchema.parse(readJson("content/missions.json")).map((m) => ({ ...m, approved: true }));
}

/** A short synthetic text for m-04-01 (97 words, two arguments). */
export const TEXT: string[] = [
  "An unserer Schule wird diskutiert, ob die Mittagspause länger werden soll. Ich bin der Meinung, dass wir eine längere Mittagspause brauchen.",
  "Zunächst können wir in einer längeren Pause in Ruhe essen. Im Moment müssen viele schnell essen, weil die Schlange in der Mensa lang ist. Gestern hatte ich zum Beispiel nur zehn Minuten für mein Essen.",
  "Vor allem aber können wir uns am Nachmittag besser konzentrieren. Wer sich in der Pause bewegt hat, ist danach wacher. In unserer Klasse sind nach einer kurzen Pause viele müde.",
  "Aus diesen Gründen bitte ich die Schulkonferenz, die Mittagspause zu verlängern.",
];

const emptyArgument = { behauptung: "", begruendung: "", beispiel: "" };

export function makePlan(overrides: Partial<PlanTranscript> = {}): PlanTranscript {
  return {
    thema: "Längere Mittagspause",
    standpunkt: "Ich bin für eine längere Mittagspause.",
    argumente: [
      { behauptung: "mehr Zeit zum Essen", begruendung: "Schlange in der Mensa", beispiel: "gestern nur 10 Minuten" },
      { behauptung: "besser konzentrieren", begruendung: "Bewegung macht wach", beispiel: "nach kurzer Pause müde" },
      { behauptung: "Zeit für Freunde", begruendung: "Streit wird geklärt", beispiel: "" },
    ],
    reihenfolge: "3, 1, 2",
    schluss: "Bitte an die Schulkonferenz",
    legibility: 0.9,
    uncertain: [],
    ...overrides,
  };
}

/** A plan that fails the code gate: no stance, only one argument with a reason. */
export function makeWeakPlan(): PlanTranscript {
  return makePlan({
    standpunkt: "",
    argumente: [
      { behauptung: "mehr Zeit zum Essen", begruendung: "Schlange in der Mensa", beispiel: "" },
      { behauptung: "besser", begruendung: "", beispiel: "" },
      emptyArgument,
    ],
  });
}

/** Paragraph template (stage 2): only the first argument is used. */
export function makeParagraphPlan(): PlanTranscript {
  return makePlan({
    thema: "",
    standpunkt: "",
    argumente: [
      { behauptung: "Ein Haustier lehrt Verantwortung", begruendung: "jeden Tag füttern", beispiel: "Fische bei meiner Schwester" },
      emptyArgument,
      emptyArgument,
    ],
    reihenfolge: "",
    schluss: "",
  });
}

export function makePlanReview(overrides: Partial<PlanReview> = {}): PlanReview {
  return {
    mirror: "So habe ich deinen Plan verstanden: Du willst eine längere Mittagspause und nennst drei Gründe.",
    criteria: { P1: "gruen", P2: "gruen", P3: "gelb", P4: "gruen", P5: "gruen" },
    question: "Welches Beispiel passt zu deinem dritten Argument?",
    approved: true,
    missing: [],
    ...overrides,
  };
}

export function makeTextTranscript(paragraphs: string[] = TEXT): TextTranscript {
  return { paragraphs, word_count: 97, legibility: 0.85, uncertain: [] };
}

export function makeTextReview(overrides: Partial<TextReview> = {}): TextReview {
  return {
    lens: {
      these: "Ich bin der Meinung, dass wir eine längere Mittagspause brauchen.",
      argumente: [
        {
          behauptung: "Zunächst können wir in einer längeren Pause in Ruhe essen.",
          begruendung: "Im Moment müssen viele schnell essen, weil die Schlange in der Mensa lang ist.",
          beispiel: "Gestern hatte ich zum Beispiel nur zehn Minuten für mein Essen.",
        },
        {
          behauptung: "Vor allem aber können wir uns am Nachmittag besser konzentrieren.",
          begruendung: "Wer sich in der Pause bewegt hat, ist danach wacher.",
          beispiel: "In unserer Klasse sind nach einer kurzen Pause viele müde.",
        },
      ],
    },
    scores: { aufbau: 2, argumentation: 2, sprache: 2, richtigkeit: 3 },
    error_density: 0,
    strengths: [
      { text: "Deine These ist klar.", quote: "Ich bin der Meinung, dass wir eine längere Mittagspause brauchen." },
      { text: "Dein Beispiel ist konkret.", quote: "Gestern hatte ich zum Beispiel nur zehn Minuten" },
    ],
    next_step: "Ergänze ein drittes Argument mit Beispiel.",
    revision_task: {
      instruction: "Nenne in deinem Schluss noch einmal deinen Standpunkt.",
      target_quote: "Aus diesen Gründen bitte ich die Schulkonferenz, die Mittagspause zu verlängern.",
      help_card_id: "HK-06",
    },
    self_check_note: "",
    flags: { too_short: false, off_topic: false, inappropriate: false },
    ...overrides,
  };
}

export const FULFILLED: RevisionCheck = { fulfilled: true, feedback: "Dein Schluss nennt jetzt deinen Standpunkt." };
export const NOT_FULFILLED: RevisionCheck = { fulfilled: false, feedback: "Dein Standpunkt fehlt im Schluss noch." };
