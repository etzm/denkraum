// Small building blocks of the mission pages. Server components, no state.

import type { ReactNode } from "react";
import type { LensMark, LensPart } from "../domain/feedback.ts";
import { LENS_LABELS, lensSegments } from "../domain/feedback.ts";
import type { FormativeStars } from "../domain/rules.ts";
import type { Ampel, Star } from "../schemas/common.ts";
import type { HelpCard } from "../schemas/content.ts";
import type { PlanReview } from "../schemas/planReview.ts";
import type { PlanTranscript } from "../schemas/planTranscript.ts";

export const card = "rounded-2xl border border-line bg-card p-5 space-y-3";
export const primaryButton = "min-h-12 w-full rounded-lg bg-accent px-6 font-semibold text-paper hover:bg-accent-strong sm:w-auto";
export const secondaryButton = "min-h-11 rounded-lg border border-line bg-card px-4";
export const inputClass = "w-full min-h-11 rounded-lg border border-line bg-paper px-3 py-2";

/** Art. 50 AI Act: every text the model formulated carries this label. */
export const AI_LABEL = "Diese Rückmeldung hat eine KI formuliert.";

export function AiNotice({ text = AI_LABEL }: { text?: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted">
      <span aria-hidden="true" className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
        KI
      </span>
      {text}
    </p>
  );
}

/** A neutral note when the model gave no answer (D-014). Never blames the student. */
export function Unavailable({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-xl border border-line bg-note p-4">
      {children}
    </p>
  );
}

export function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}

// ---------------------------------------------------------------------------
// Steps

const STEPS = ["Auftrag", "Planen", "Schreiben", "Selbstkontrolle", "Rückmeldung", "Überarbeiten"] as const;

export function Steps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-2 text-sm" aria-label="Schritte der Mission">
      {STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === current ? "step" : undefined}
          className={`rounded-full border px-3 py-1 ${
            i === current ? "border-accent bg-accent-soft font-semibold text-accent" : i < current ? "border-line text-ink" : "border-line text-muted"
          }`}
        >
          {i < current ? "✓ " : ""}
          {label}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Plan

const CRITERIA: { key: keyof PlanReview["criteria"]; label: string }[] = [
  { key: "P1", label: "Standpunkt" },
  { key: "P2", label: "Anzahl Argumente" },
  { key: "P3", label: "Vollständigkeit" },
  { key: "P4", label: "Reihenfolge" },
  { key: "P5", label: "Schlussidee" },
];

const AMPEL: Record<Ampel, { word: string; dot: string }> = {
  gruen: { word: "grün", dot: "bg-ok" },
  gelb: { word: "gelb", dot: "bg-amber-400" },
  rot: { word: "rot", dot: "bg-bad" },
};

export function TrafficLights({ criteria }: { criteria: PlanReview["criteria"] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Ampel für deinen Plan">
      {CRITERIA.map(({ key, label }) => (
        <li key={key} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
          <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-full ${AMPEL[criteria[key]].dot}`} />
          <span className="flex-1">{label}</span>
          <span className="text-sm font-semibold">{AMPEL[criteria[key]].word}</span>
        </li>
      ))}
    </ul>
  );
}

export function PlanSummary({ plan }: { plan: PlanTranscript }) {
  const row = (label: string, value: string) => (
    <div key={label}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="whitespace-pre-wrap">{value.trim() === "" ? <span className="text-muted">(leer)</span> : value}</dd>
    </div>
  );
  return (
    <dl className="space-y-2">
      {row("Thema", plan.thema)}
      {row("Mein Standpunkt", plan.standpunkt)}
      {plan.argumente.map((a, i) => (
        <div key={i} className="rounded-lg border border-line p-3 space-y-1">
          <p className="text-sm font-semibold">Argument {i + 1}</p>
          {row("Behauptung", a.behauptung)}
          {row("Begründung", a.begruendung)}
          {row("Beispiel", a.beispiel)}
        </div>
      ))}
      {row("Reihenfolge", plan.reihenfolge)}
      {row("Schluss", plan.schluss)}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Text and Textlupe

export function PlainText({ paragraphs }: { paragraphs: readonly string[] }) {
  return (
    <div className="space-y-3 rounded-xl border border-line bg-paper p-4 leading-relaxed">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

const MARK_CLASS: Record<LensPart, string> = {
  these: "bg-sky-100 dark:bg-sky-900/70",
  behauptung: "bg-amber-100 dark:bg-amber-900/70",
  begruendung: "bg-emerald-100 dark:bg-emerald-900/70",
  beispiel: "bg-fuchsia-100 dark:bg-fuchsia-900/70",
  einwand: "bg-rose-100 dark:bg-rose-900/70",
  entkraeftung: "bg-slate-200 dark:bg-slate-700",
};

/** The student's text with the passages of the Textlupe marked (only exact quotes, SW-19). */
export function LensText({ text, marks }: { text: string; marks: readonly LensMark[] }) {
  const segments = lensSegments(text, marks);
  const parts = [...new Set(segments.flatMap((s) => (s.part ? [s.part] : [])))];
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-2 text-sm" aria-label="Legende der Textlupe">
        {parts.map((part) => (
          <li key={part} className={`rounded px-2 py-0.5 text-ink ${MARK_CLASS[part]}`}>
            {LENS_LABELS[part]}
          </li>
        ))}
      </ul>
      <div className="whitespace-pre-wrap rounded-xl border border-line bg-paper p-4 leading-relaxed">
        {segments.map((s, i) =>
          s.part ? (
            <mark key={i} data-part={s.part} title={LENS_LABELS[s.part]} className={`rounded px-0.5 text-ink ${MARK_CLASS[s.part]}`}>
              <span className="sr-only">{LENS_LABELS[s.part]}: </span>
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stars (formative, for the student only, D-020)

function StarRow({ label, value }: { label: string; value: Star | null }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
      <span>{label}</span>
      {value === null ? (
        <span className="text-sm text-muted">kommt später</span>
      ) : (
        <span aria-label={`${value} von 3 Sternen`} className="tracking-widest text-accent">
          {"★".repeat(value)}
          <span className="text-line">{"★".repeat(3 - value)}</span>
        </span>
      )}
    </li>
  );
}

export function StarList({ stars }: { stars: FormativeStars }) {
  return (
    <div className="space-y-2">
      <ul className="space-y-2" aria-label="Sterne je Bereich">
        <StarRow label="Aufbau" value={stars.aufbau} />
        <StarRow label="Argumentation" value={stars.argumentation} />
        <StarRow label="Sprache und Formulierung" value={stars.sprache} />
        <StarRow label="Richtigkeit" value={stars.richtigkeit} />
      </ul>
      <p className="text-sm text-muted">
        {stars.shown} von {stars.max} Sternen. Die Sterne zeigen dir, wo du stehst. Sie sind keine Note und nur für dich.
        {stars.richtigkeit === null ? " Sterne für die Rechtschreibung kommen später." : ""}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Help card

export function HelpCardBox({ card: helpCard }: { card: HelpCard }) {
  return (
    <aside className="rounded-xl border border-accent bg-accent-soft p-4 space-y-2" aria-label={`Hilfskarte ${helpCard.title}`}>
      <p className="text-sm font-semibold text-accent">
        Hilfskarte {helpCard.id}: {helpCard.title}
      </p>
      <p className="text-sm">{helpCard.content.intro}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {helpCard.content.phrases.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </aside>
  );
}
