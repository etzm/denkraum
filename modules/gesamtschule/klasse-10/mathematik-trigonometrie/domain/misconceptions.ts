import { fillTemplate, placeholders } from "./template.ts";

export const MISCONCEPTION_CODES = [
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "F13",
] as const;
export type MisconceptionCode = (typeof MISCONCEPTION_CODES)[number];

/**
 * How verify.ts recognises a misconception (spec A 6.4, column "Erkennung"):
 * - final_value: the final result matches a wrong path computed in solutions.ts
 * - intermediates: a transcribed intermediate value explains the deviating result
 * - transcription: a transcription field (unit, answer sentence, sketch)
 * - sketch: needs an analysis of the sketch; no data for it in the transcription yet
 * - fallback: only when no other pattern matches
 */
export type Detection = "final_value" | "intermediates" | "transcription" | "sketch" | "fallback";

export interface Misconception {
  code: MisconceptionCode;
  /** Short, student-facing name of the error. */
  label: string;
  /** Student-facing hint template (spec A 6.4). `{{name}}` placeholders are filled per task. */
  hint: string;
  detection: Detection;
}

export const MISCONCEPTIONS: Readonly<Record<MisconceptionCode, Misconception>> = {
  F1: {
    code: "F1",
    label: "Taschenrechner nicht auf DEG",
    hint: "Stell deinen Rechner auf DEG und prüfe mit sin 30° = 0,5.",
    detection: "final_value",
  },
  F2: {
    code: "F2",
    label: "Gegenkathete und Ankathete vertauscht",
    hint: "Welche Seite liegt dem Winkel gegenüber? Markiere sie farbig in deiner Skizze.",
    detection: "final_value",
  },
  F3: {
    code: "F3",
    label: "Falsches Verhältnis gewählt",
    hint: "Welche zwei Seiten kennst du oder suchst du? Wähle das Verhältnis, das genau diese beiden enthält.",
    detection: "final_value",
  },
  F4: {
    code: "F4",
    label: "Umkehrfunktion falsch benutzt",
    hint: "Du suchst den Winkel, also brauchst du {{fn}}⁻¹ (SHIFT + {{fn}}).",
    detection: "final_value",
  },
  F5: {
    code: "F5",
    label: "Zu früh gerundet",
    hint: "Runde erst am Ende.",
    detection: "intermediates",
  },
  F6: {
    code: "F6",
    label: "Gleichung falsch umgestellt",
    hint: "Multipliziere beide Seiten mit {{side}}.",
    detection: "final_value",
  },
  F7: {
    code: "F7",
    label: "Einheit oder Antwortsatz fehlt",
    hint: "Schreibe das Ergebnis mit Einheit in einen Antwortsatz.",
    detection: "transcription",
  },
  F8: {
    code: "F8",
    label: "Hypotenuse verwechselt",
    hint: "Die Hypotenuse liegt dem rechten Winkel gegenüber und ist die längste Seite.",
    detection: "final_value",
  },
  F9: {
    code: "F9",
    label: "Rechter Winkel an der falschen Stelle",
    hint: "Wo genau ist in deiner Skizze der rechte Winkel? Prüfe, ob er wirklich dort liegt.",
    detection: "sketch",
  },
  F10: {
    code: "F10",
    label: "Teilstrecke statt Gesamtstrecke",
    hint: "Vergleiche Gesamtstrecke mit Gesamtstrecke oder Teilstrecke mit Teilstrecke.",
    detection: "final_value",
  },
  F11: {
    code: "F11",
    label: "Skizze fehlt oder ist nicht beschriftet",
    hint: "Zeichne eine Skizze und beschrifte Winkel und Seiten, dann wird der Ansatz leichter.",
    detection: "transcription",
  },
  F12: {
    code: "F12",
    label: "Prozent und Grad verwechselt",
    hint: "{{percent}} % Steigung heißt {{percent}} m hoch auf 100 m waagerecht. Welches Verhältnis ist das?",
    detection: "final_value",
  },
  F13: {
    code: "F13",
    label: "Rechenfehler",
    hint: "Dein Ansatz stimmt. Rechne den letzten Schritt noch einmal nach.",
    detection: "fallback",
  },
};

/** Variables a code's hint template needs, e.g. ["fn"] for F4. */
export function hintVariables(code: MisconceptionCode): string[] {
  return [...new Set(placeholders(MISCONCEPTIONS[code].hint))];
}

/** Student-facing hint for a code. Throws if a template variable is missing. */
export function renderHint(code: MisconceptionCode, vars: Readonly<Record<string, string>> = {}): string {
  return fillTemplate(MISCONCEPTIONS[code].hint, vars);
}
