// Presentational server components of the mission screens. They render data only; forms
// get their server actions from the page. Mobile first: one column, touch targets of 44 px.

import type { ReactNode } from "react";
import type { StarSummary } from "../domain/rules.ts";
import { splitSentences } from "../domain/text.ts";
import type { HelpCard } from "../schemas/content.ts";
import type { PlanReview } from "../schemas/planReview.ts";
import type { PlanTranscript } from "../schemas/planTranscript.ts";
import type { TextReview } from "../schemas/textReview.ts";
import { PLAN_FIELDS } from "../server/forms.ts";
import { AI_LABEL, AMPEL_TEXT, DIMENSIONS, ERROR_TEXT, PLAN_CRITERIA } from "./labels.ts";
import { LENS_LABELS, lensQuotes, lensSegments, type LensMark } from "./lens.ts";

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-line p-4">
      {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}

export function ErrorBox({ code }: { code: string | undefined }) {
  if (!code) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      {ERROR_TEXT[code] ?? ERROR_TEXT.ungueltig}
    </p>
  );
}

/** Art. 50 KI-Verordnung: every AI-formulated feedback is labelled. */
export function AiNote() {
  return <p className="text-sm text-muted">{AI_LABEL}</p>;
}

export function StarRow({ value, max = 3 }: { value: number; max?: number }) {
  return (
    <span aria-label={`${value} von ${max} Sternen`} className="tracking-widest text-amber-500" role="img">
      {"★".repeat(value)}
      <span className="text-line">{"★".repeat(Math.max(0, max - value))}</span>
    </span>
  );
}

export function StarsPanel({ stars, eLevel }: { stars: StarSummary; eLevel: boolean }) {
  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {DIMENSIONS.map((d) => (
          <li key={d.key} className="flex items-center justify-between gap-3">
            <span>{d.label}</span>
            <StarRow value={stars.scores[d.key]} />
          </li>
        ))}
      </ul>
      <p className="font-semibold">
        Zusammen: {stars.display} von 12 Sternen
        {eLevel ? `, dazu ${stars.bonus} von 3 Bonussternen` : ""}
      </p>
      {stars.capped ? <p className="text-sm text-muted">Weil du den Text getippt hast, zählen hier höchstens 10 Sterne.</p> : null}
    </div>
  );
}

const AMPEL_CLASS = {
  gruen: "bg-green-600",
  gelb: "bg-amber-400",
  rot: "bg-red-600",
} as const;

export function PlanAmpel({ review, paragraphTemplate }: { review: PlanReview; paragraphTemplate: boolean }) {
  const criteria = paragraphTemplate ? PLAN_CRITERIA.slice(0, 3) : PLAN_CRITERIA;
  return (
    <ul className="space-y-1">
      {criteria.map((c) => {
        const value = review.criteria[c.key];
        return (
          <li key={c.key} className="flex items-center gap-3">
            <span aria-hidden className={`inline-block size-3 rounded-full ${AMPEL_CLASS[value]}`} />
            <span className="flex-1">{c.label}</span>
            <span className="text-sm text-muted">{AMPEL_TEXT[value]}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function PlanSummary({ plan, paragraphTemplate }: { plan: PlanTranscript; paragraphTemplate: boolean }) {
  const args = paragraphTemplate ? plan.argumente.slice(0, 1) : plan.argumente.filter((a) => a.behauptung.trim() !== "");
  return (
    <dl className="space-y-2 text-sm">
      {!paragraphTemplate && plan.standpunkt ? (
        <div>
          <dt className="font-semibold">Mein Standpunkt</dt>
          <dd>{plan.standpunkt}</dd>
        </div>
      ) : null}
      {args.map((a, i) => (
        <div key={i}>
          <dt className="font-semibold">{paragraphTemplate ? "Mein Argument" : `Argument ${i + 1}`}</dt>
          <dd>
            {a.behauptung}
            {a.begruendung ? `, weil ${a.begruendung}` : ""}
            {a.beispiel ? ` (Beispiel: ${a.beispiel})` : ""}
          </dd>
        </div>
      ))}
      {!paragraphTemplate && plan.reihenfolge ? (
        <div>
          <dt className="font-semibold">Reihenfolge</dt>
          <dd>{plan.reihenfolge}</dd>
        </div>
      ) : null}
      {!paragraphTemplate && plan.schluss ? (
        <div>
          <dt className="font-semibold">Schluss</dt>
          <dd>{plan.schluss}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function HelpCardList({ cards }: { cards: readonly HelpCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="space-y-2">
      {cards.map((card) => (
        <details key={card.id} className="rounded-lg border border-line p-3">
          <summary className="min-h-11 cursor-pointer font-semibold">Hilfskarte: {card.title}</summary>
          <p className="mt-2 text-sm text-muted">{card.content.intro}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {card.content.phrases.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

const MARK_CLASS: Record<LensMark, string> = {
  these: "bg-sky-200 dark:bg-sky-800",
  behauptung: "bg-amber-200 dark:bg-amber-800",
  begruendung: "bg-green-200 dark:bg-green-800",
  beispiel: "bg-violet-200 dark:bg-violet-800",
  einwand: "bg-rose-200 dark:bg-rose-800",
  entkraeftung: "bg-teal-200 dark:bg-teal-800",
};

/** The child's own text with the parts the review found (spec 4, "Textlupe"). */
export function Textlupe({ paragraphs, lens }: { paragraphs: readonly string[]; lens: TextReview["lens"] }) {
  const quotes = lensQuotes(lens);
  const used = [...new Set(quotes.map((q) => q.mark))];
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2 text-sm" aria-label="Legende">
        {used.map((mark) => (
          <li key={mark} className={`rounded px-2 py-0.5 ${MARK_CLASS[mark]}`}>
            {LENS_LABELS[mark]}
          </li>
        ))}
      </ul>
      {lensSegments(paragraphs, quotes).map((segments, i) => (
        <p key={i} className="leading-relaxed">
          {segments.map((s, j) =>
            s.mark ? (
              <mark key={j} className={`rounded px-0.5 text-ink ${MARK_CLASS[s.mark]}`} title={LENS_LABELS[s.mark]}>
                {s.text}
              </mark>
            ) : (
              <span key={j}>{s.text}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

function TextField({ name, label, defaultValue, rows = 2, hint }: { name: string; label: string; defaultValue?: string; rows?: number; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="block font-medium">{label}</span>
      {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        maxLength={1000}
        className="w-full rounded-lg border border-line bg-transparent p-3"
      />
    </label>
  );
}

/** Typed planning sheet: the same boxes as the paper sheet (spec 6.2). */
export function PlanFields({
  paragraphTemplate,
  withCounterArgument,
  plan,
}: {
  paragraphTemplate: boolean;
  withCounterArgument: boolean;
  plan: PlanTranscript | null;
}) {
  const count = paragraphTemplate ? 1 : 3;
  return (
    <div className="space-y-4">
      {!paragraphTemplate ? (
        <>
          <TextField name={PLAN_FIELDS.thema} label="Thema" defaultValue={plan?.thema} rows={1} />
          <TextField name={PLAN_FIELDS.standpunkt} label="Mein Standpunkt" defaultValue={plan?.standpunkt} hint="Was meine ich?" />
        </>
      ) : null}
      {Array.from({ length: count }, (_, i) => (
        <fieldset key={i} className="space-y-3 rounded-lg border border-line p-3">
          <legend className="px-1 font-semibold">{paragraphTemplate ? "Mein Argument" : `Argument ${i + 1}`}</legend>
          <TextField name={PLAN_FIELDS.argument(i, "behauptung")} label="Behauptung" defaultValue={plan?.argumente[i]?.behauptung} hint="Was behaupte ich?" />
          <TextField name={PLAN_FIELDS.argument(i, "begruendung")} label="Begründung" defaultValue={plan?.argumente[i]?.begruendung} hint="Warum stimmt das?" />
          <TextField name={PLAN_FIELDS.argument(i, "beispiel")} label="Beispiel" defaultValue={plan?.argumente[i]?.beispiel} hint="Woran sieht man das?" />
        </fieldset>
      ))}
      {withCounterArgument ? (
        <fieldset className="space-y-3 rounded-lg border border-line p-3">
          <legend className="px-1 font-semibold">Gegenargument</legend>
          <TextField name={PLAN_FIELDS.einwand} label="Einwand" defaultValue={plan?.gegenargument?.einwand} />
          <TextField name={PLAN_FIELDS.entkraeftung} label="Entkräftung" defaultValue={plan?.gegenargument?.entkraeftung} />
        </fieldset>
      ) : null}
      {!paragraphTemplate ? (
        <>
          <TextField name={PLAN_FIELDS.reihenfolge} label="Reihenfolge" defaultValue={plan?.reihenfolge} rows={1} hint="Das stärkste Argument kommt zum Schluss, zum Beispiel 2, 1, 3." />
          <TextField name={PLAN_FIELDS.schluss} label="Schluss" defaultValue={plan?.schluss} />
        </>
      ) : null}
    </div>
  );
}

/** Self check (spec 4): tick the checklist, then mark the thesis and the examples in the own text. */
export function SelfCheckFields({ checklist, paragraphs }: { checklist: readonly { id: string; text: string }[]; paragraphs: readonly string[] }) {
  const sentences = paragraphs.flatMap(splitSentences);
  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="font-semibold">Meine Checkliste</legend>
        {checklist.map((item) => (
          <label key={item.id} className="flex min-h-11 items-start gap-3">
            <input type="checkbox" name="check" value={item.id} className="mt-1 size-5 shrink-0" />
            <span>{item.text}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="font-semibold">Markiere in deinem Text</legend>
        <p className="text-sm text-muted">Wo steht deine These? Wo stehen deine Beispiele?</p>
        <ol className="space-y-2">
          {sentences.map((sentence, i) => (
            <li key={i} className="rounded-lg border border-line p-3">
              <p className="mb-2">{sentence}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" name="these" value={sentence} className="size-5" />
                  These
                </label>
                <label className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" name="beispiel" value={sentence} className="size-5" />
                  Beispiel
                </label>
              </div>
            </li>
          ))}
        </ol>
      </fieldset>
    </div>
  );
}
