// Deterministic AI answers for tests and local development (LLM_PROVIDER=mock, docs/module-sdk.md).
// They read the request data, so quotes are exact substrings of the submitted text.
// Marker words trigger the special paths; they only have an effect with the mock provider.

import { splitSentences } from "../domain/feedback.ts";
import { countWords, isFilled } from "../domain/text.ts";
import type { PlanReview } from "../schemas/planReview.ts";
import type { RevisionCheck } from "../schemas/revisionCheck.ts";
import type { TextReview } from "../schemas/textReview.ts";
import type { PlanReviewInput, RevisionCheckInput, TextReviewInput } from "./ai-input.ts";

export const MOCK_MARKERS = {
  /** In the text: P4 sets `inappropriate`, the run is held for an adult. */
  inappropriate: "TESTMARKER-UNGEEIGNET",
  /** Anywhere in the input: the mock answers with invalid JSON, so the call fails (schema_error). */
  noAnswer: "TESTMARKER-KEINE-ANTWORT",
  /** In the text: P4 quotes are changed, so the quote check fails. */
  quoteMismatch: "TESTMARKER-ZITAT",
  /** In a revision: P5 answers `fulfilled: false`. */
  notFulfilled: "TESTMARKER-NICHT-ERFUELLT",
} as const;

type MockRequest = { userText: string };

/** The platform appends a note after a schema error; the data is the JSON before it. */
function parseInput<T>(userText: string): T {
  const cut = userText.indexOf("\n\nDeine vorige Antwort");
  return JSON.parse(cut >= 0 ? userText.slice(0, cut) : userText) as T;
}

function firstWords(text: string, n: number): string {
  const words = text.trim().replace(/[.!?]+$/u, "").split(/\s+/);
  return words.length > n ? `${words.slice(0, n).join(" ")} ...` : words.join(" ");
}

export function mockPlanReview(request: MockRequest): PlanReview | null {
  if (request.userText.includes(MOCK_MARKERS.noAnswer)) return null;
  const { plan } = parseInput<PlanReviewInput>(request.userText);
  const args = plan.argumente.filter((a) => isFilled(a.behauptung));
  const withReason = args.filter((a) => isFilled(a.begruendung));
  const complete = withReason.filter((a) => isFilled(a.beispiel));
  const stance = isFilled(plan.standpunkt);
  const criteria: PlanReview["criteria"] = {
    P1: !stance ? "rot" : countWords(plan.standpunkt) < 4 ? "gelb" : "gruen",
    P2: args.length >= 3 ? "gruen" : args.length === 2 ? "gelb" : "rot",
    P3: withReason.length === 0 ? "rot" : complete.length === args.length ? "gruen" : "gelb",
    P4: isFilled(plan.reihenfolge) ? "gruen" : "rot",
    P5: isFilled(plan.schluss) ? "gruen" : "rot",
  };
  const missing: string[] = [];
  if (!stance) missing.push("Standpunkt");
  plan.argumente.forEach((a, i) => {
    if (isFilled(a.behauptung) && !isFilled(a.begruendung)) missing.push(`Begründung zu Argument ${i + 1}`);
    if (isFilled(a.behauptung) && !isFilled(a.beispiel)) missing.push(`Beispiel zu Argument ${i + 1}`);
  });
  if (args.length < 3) missing.push("drittes Argument");
  if (!isFilled(plan.reihenfolge)) missing.push("Reihenfolge");
  if (!isFilled(plan.schluss)) missing.push("Schlussidee");
  const withoutExample = plan.argumente.findIndex((a) => isFilled(a.behauptung) && !isFilled(a.beispiel));
  const question =
    withoutExample >= 0
      ? `Welches Beispiel passt zu Argument ${withoutExample + 1}?`
      : !isFilled(plan.reihenfolge)
        ? "In welcher Reihenfolge willst du deine Argumente bringen?"
        : "Warum steht dein stärkstes Argument an dieser Stelle?";
  const mirrorStance = stance ? `Dein Standpunkt ist: ${firstWords(plan.standpunkt, 12)}.` : "Einen Standpunkt habe ich nicht gefunden.";
  return {
    mirror: `So habe ich deinen Plan verstanden: ${mirrorStance} Du nennst ${args.length} ${args.length === 1 ? "Argument" : "Argumente"}.`,
    criteria,
    question,
    approved: criteria.P1 !== "rot" && withReason.length >= 2,
    missing: missing.slice(0, 5),
  };
}

const CONNECTORS = /\b(zunächst|außerdem|darüber hinaus|vor allem|schließlich|deshalb|weil|denn|daher)\b/giu;
const EXAMPLE_HINT = /beispiel|gestern|letzte woche|in unserer klasse|etwa/iu;
const STANCE_HINT = /meinung|finde|bin (für|gegen|dafür|dagegen)|standpunkt|sollte/iu;

const star = (n: number): 0 | 1 | 2 | 3 => Math.max(0, Math.min(3, n)) as 0 | 1 | 2 | 3;

export function mockTextReview(request: MockRequest): TextReview | null {
  if (request.userText.includes(MOCK_MARKERS.noAnswer)) return null;
  const input = parseInput<TextReviewInput>(request.userText);
  const paragraphs = input.text.absaetze.filter((p) => p.trim() !== "");
  const full = paragraphs.join("\n\n");
  if (full.includes(MOCK_MARKERS.inappropriate)) {
    return {
      lens: { these: "", argumente: [] },
      scores: { aufbau: 0, argumentation: 0, sprache: 0, richtigkeit: 0 },
      error_density: 0,
      strengths: [],
      next_step: "",
      revision_task: { instruction: "", target_quote: "", help_card_id: "" },
      self_check_note: "",
      flags: { too_short: false, off_topic: false, inappropriate: true },
    };
  }
  const mismatch = full.includes(MOCK_MARKERS.quoteMismatch);
  const quote = (s: string) => (mismatch && s !== "" ? `${s} (verändert)` : s);
  const sentences = (p: string | undefined) => (p === undefined ? [] : splitSentences([p]));

  const intro = sentences(paragraphs[0]);
  const these = intro.find((s) => STANCE_HINT.test(s)) ?? intro.at(-1) ?? "";
  const body = paragraphs.length > 2 ? paragraphs.slice(1, -1) : paragraphs.slice(1);
  const argumente = body.slice(0, 5).map((p) => {
    const s = sentences(p);
    const beispiel = s.slice(1).find((x) => EXAMPLE_HINT.test(x)) ?? s[2] ?? "";
    const begruendung = s[1] !== undefined && s[1] !== beispiel ? s[1] : "";
    return { behauptung: s[0] ?? "", begruendung, beispiel };
  });
  const firstSentence = intro[0] ?? paragraphs[0]!.trim();
  const exampleArg = argumente.find((a) => a.beispiel !== "");
  const lastParagraph = paragraphs.at(-1)!;
  const target = sentences(lastParagraph)[0] ?? lastParagraph.trim();
  const completeArgs = argumente.filter((a) => a.behauptung && a.begruendung && a.beispiel).length;
  const connectors = full.match(CONNECTORS)?.length ?? 0;
  const checklist = input.selbsteinschaetzung.checkliste;
  const ticked = checklist.filter((c) => c.abgehakt).length;

  return {
    lens: {
      these: quote(these),
      argumente: argumente.map((a) => ({ behauptung: quote(a.behauptung), begruendung: quote(a.begruendung), beispiel: quote(a.beispiel) })),
    },
    scores: {
      aufbau: star(paragraphs.length >= 4 ? 3 : paragraphs.length - 1),
      argumentation: star(completeArgs),
      sprache: star(connectors >= 3 ? 3 : connectors >= 1 ? 2 : 1),
      richtigkeit: 2,
    },
    error_density: 2,
    strengths: [
      { text: "Deine These ist klar formuliert.", quote: quote(these || firstSentence) },
      exampleArg
        ? { text: "Dein Beispiel macht dein Argument anschaulich.", quote: quote(exampleArg.beispiel) }
        : { text: "Du beginnst mit einer klaren Behauptung.", quote: quote(argumente[0]?.behauptung || firstSentence) },
    ],
    next_step:
      completeArgs < 3
        ? "Achte darauf, dass jedes Argument Behauptung, Begründung und Beispiel hat."
        : "Verbinde deine Absätze mit Überleitungen.",
    revision_task: {
      instruction: "Nenne in deinem Schluss noch einmal deinen Standpunkt und sprich deinen Adressaten direkt an.",
      target_quote: quote(target),
      help_card_id: "HK-06",
    },
    self_check_note: ticked * 2 < checklist.length ? "Du hast weniger Punkte abgehakt, als dein Text schon zeigt." : "",
    flags: { too_short: false, off_topic: false, inappropriate: false },
  };
}

export function mockRevisionCheck(request: MockRequest): RevisionCheck | null {
  if (request.userText.includes(MOCK_MARKERS.noAnswer)) return null;
  const input = parseInput<RevisionCheckInput>(request.userText);
  const same = (a: string) => a.replace(/\s+/g, " ").trim();
  if (same(input.ueberarbeitung) === same(input.stelle)) {
    return { fulfilled: false, feedback: "Du hast die Stelle noch nicht verändert. Lies die Aufgabe noch einmal." };
  }
  if (input.ueberarbeitung.includes(MOCK_MARKERS.notFulfilled)) {
    return { fulfilled: false, feedback: "Die Aufgabe ist noch nicht ganz erfüllt. Lies sie noch einmal genau." };
  }
  return { fulfilled: true, feedback: "Du hast die Stelle so überarbeitet, wie es die Aufgabe verlangt." };
}

/** Fixtures by prompt name, for `definition.mockFixtures`. */
export const MOCK_FIXTURES = {
  plan_review: mockPlanReview,
  text_review: mockTextReview,
  revision_check: mockRevisionCheck,
};
