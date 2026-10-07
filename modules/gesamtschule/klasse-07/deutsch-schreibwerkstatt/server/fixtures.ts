// Mock answers for LLM_PROVIDER=mock (development, CI, end-to-end tests). Synthetic and
// deterministic: they read the user message the module built and answer with valid
// schema objects whose quotes are real sentences of the child's text, so the quote check
// and the whole mission flow behave as with a real model.

import type { MockFixture, ProviderRequest } from "@denkraum/llm";
import { splitSentences } from "../domain/text.ts";
import type { PlanReview } from "../schemas/planReview.ts";
import type { PlanTranscript } from "../schemas/planTranscript.ts";
import type { RevisionCheck } from "../schemas/revisionCheck.ts";
import type { TextReview } from "../schemas/textReview.ts";
import type { TextTranscript } from "../schemas/textTranscript.ts";

/** The JSON input, without a retry note the platform may have appended after a schema error. */
function input(request: ProviderRequest): Record<string, unknown> {
  const json = request.userText.split("\n\nDeine vorige Antwort")[0]!;
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const filled = (value: unknown) => typeof value === "string" && /\p{L}/u.test(value);

function planReview(request: ProviderRequest): PlanReview {
  const plan = (input(request).plan ?? {}) as Partial<PlanTranscript>;
  const args = plan.argumente ?? [];
  const withReason = args.filter((a) => filled(a.behauptung) && filled(a.begruendung)).length;
  const template = request.system.includes("Absatz-Schablone");
  const stance = filled(plan.standpunkt);
  const approved = template ? withReason >= 1 : stance && withReason >= 2;
  const missing = [...(!template && !stance ? ["Standpunkt"] : []), ...(withReason < (template ? 1 : 2) ? ["Begründungen"] : [])];
  return {
    mirror: `So habe ich deinen Plan verstanden: Du nennst ${withReason === 1 ? "ein Argument" : `${withReason} Argumente`} mit Begründung.`,
    criteria: {
      P1: stance || template ? "gruen" : "rot",
      P2: withReason >= 3 ? "gruen" : withReason === 2 || template ? "gelb" : "rot",
      P3: args.every((a) => !filled(a.behauptung) || filled(a.beispiel)) ? "gruen" : "gelb",
      // The order is often only numbers ("2, 1, 3").
      P4: template || (plan.reihenfolge ?? "").trim() !== "" ? "gruen" : "rot",
      P5: template || filled(plan.schluss) ? "gruen" : "rot",
    },
    question: "Welches Argument ist dein stärkstes, und steht es am Ende?",
    approved,
    missing,
  };
}

function textReview(request: ProviderRequest): TextReview {
  const data = input(request);
  const paragraphs = ((data.text as { absaetze?: string[] } | undefined)?.absaetze ?? []).filter((p) => p.trim() !== "");
  const sentences = paragraphs.map(splitSentences);
  const all = sentences.flat();
  const first = all[0] ?? "";
  const these = sentences[0]?.at(-1) ?? first;
  const middle = sentences.length > 2 ? sentences.slice(1, -1) : sentences.slice(0, 1);
  const cards = (data.hilfskarten as { id: string }[] | undefined) ?? [];
  const eLevel = request.system.includes("Bonuskriterien");
  return {
    lens: {
      these,
      argumente: middle.slice(0, 5).map((s) => ({ behauptung: s[0] ?? "", begruendung: s[1] ?? "", beispiel: s[2] ?? "" })),
    },
    scores: { aufbau: 2, argumentation: 2, sprache: 2, richtigkeit: 2 },
    ...(eLevel ? { e_bonus: { gegenargument_genannt: false, gegenargument_entkraeftet: false, schlussregel: false } } : {}),
    error_density: 3,
    strengths: [
      { text: "Dein Standpunkt ist klar zu erkennen.", quote: these },
      { text: "Du begründest deine Behauptung.", quote: middle[0]?.[1] ?? middle[0]?.[0] ?? first },
    ],
    next_step: "Ergänze zu jedem Argument ein Beispiel aus deinem Alltag.",
    revision_task: {
      instruction: "Verbinde diesen Satz mit dem Satz davor durch ein passendes Verknüpfungswort.",
      target_quote: all.at(-1) ?? first,
      help_card_id: cards.find((c) => c.id === "HK-05")?.id ?? cards[0]?.id ?? "HK-05",
    },
    self_check_note: "",
    flags: { too_short: false, off_topic: false, inappropriate: false },
  };
}

function revisionCheck(request: ProviderRequest): RevisionCheck {
  const data = input(request);
  const before = String(data.stelle ?? "").trim();
  const after = String(data.ueberarbeitung ?? "").trim();
  return after !== "" && after !== before
    ? { fulfilled: true, feedback: "Deine Überarbeitung erfüllt die Aufgabe." }
    : { fulfilled: false, feedback: "Der Satz ist noch unverändert. Lies die Aufgabe noch einmal." };
}

const MOCK_PLAN: PlanTranscript = {
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
};

const MOCK_TEXT: TextTranscript = {
  paragraphs: [
    "An unserer Schule wird diskutiert, ob die Mittagspause länger werden soll. Ich bin der Meinung, dass wir eine längere Mittagspause brauchen.",
    "Zunächst können wir in einer längeren Pause in Ruhe essen. Im Moment müssen viele schnell essen, weil die Schlange in der Mensa lang ist.",
  ],
  word_count: 44,
  legibility: 0.85,
  uncertain: [],
};

export const mockFixtures: Record<string, MockFixture> = {
  plan_transcribe: () => MOCK_PLAN,
  plan_review: planReview,
  text_transcribe: () => MOCK_TEXT,
  text_review: textReview,
  revision_check: revisionCheck,
};
