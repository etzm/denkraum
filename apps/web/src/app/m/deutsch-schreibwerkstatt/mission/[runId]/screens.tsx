import { PLAN_GAP_HINTS, stageMedia } from "@denkraum/mod-deutsch-schreibwerkstatt/domain";
import type { MissionPage } from "@denkraum/mod-deutsch-schreibwerkstatt/server";
import {
  AiNote,
  HelpCardList,
  PlanAmpel,
  PlanFields,
  PlanSummary,
  Section,
  SelfCheckFields,
  StarsPanel,
  SubmitButton,
  Textlupe,
  THREE_QUESTIONS,
} from "@denkraum/mod-deutsch-schreibwerkstatt/ui";
import Link from "next/link";
import { SW_BASE } from "@/lib/schreibwerkstatt.ts";

/** A bound server action for one step of this run. */
export type Step = (kind: string) => (formData: FormData) => Promise<void>;

type Props = { page: MissionPage; step: Step };

function Questions() {
  return (
    <ul className="flex flex-wrap gap-2 text-sm">
      {THREE_QUESTIONS.map((q) => (
        <li key={q} className="rounded-full border border-line px-3 py-1">
          {q}
        </li>
      ))}
    </ul>
  );
}

export function Briefing({ page, step }: Props) {
  const { mission, run } = page;
  const media = stageMedia(run.stufe);
  const paper = media.plan !== "none" || media.text === "paper";
  return (
    <>
      <Section title="Dein Auftrag">
        <p className="leading-relaxed">{mission.prompt}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {mission.adressat ? (
            <>
              <dt className="font-semibold">An wen?</dt>
              <dd>{mission.adressat}</dd>
            </>
          ) : null}
          <dt className="font-semibold">Was?</dt>
          <dd>{mission.form}</dd>
          <dt className="font-semibold">Zeit</dt>
          <dd>
            {mission.timeboxPlan > 0 ? `etwa ${mission.timeboxPlan} Minuten planen, ` : ""}etwa {mission.timeboxWrite} Minuten schreiben
          </dd>
        </dl>
      </Section>
      {page.checklist.length > 0 ? (
        <Section title="Darauf kommt es an">
          <ul className="list-disc space-y-1 pl-5">
            {page.checklist.map((item) => (
              <li key={item.id}>{item.text}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Section title="Vor dem Schreiben drei Fragen">
        <Questions />
      </Section>
      {paper ? <p className="text-sm text-muted">Diesmal tippst du Plan und Text hier ein. Papier und Foto kommen bald dazu.</p> : null}
      <form action={step("briefing")}>
        <SubmitButton>Ich habe den Auftrag verstanden</SubmitButton>
      </form>
    </>
  );
}

export function Planning({ page, step }: Props) {
  const { run } = page;
  const template = stageMedia(run.stufe).plan;
  const revise = run.state === "plan_revise";
  return (
    <>
      {revise && run.plan.gate ? (
        <Section title="Das fehlt noch">
          <ul className="list-disc space-y-1 pl-5">
            {run.plan.gate.missing.map((gap) => (
              <li key={gap}>{PLAN_GAP_HINTS[gap]}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Questions />
      <form action={step("plan")} className="space-y-4">
        <PlanFields paragraphTemplate={template === "paragraph_template"} withCounterArgument={template === "planning_sheet" && run.niveauEEnabled} plan={run.plan.confirmed} />
        <HelpCardList cards={page.helpCards} />
        <SubmitButton pendingText="Ich lese deinen Plan ...">Plan abgeben</SubmitButton>
      </form>
    </>
  );
}

export function PlanFeedback({ page, step }: Props) {
  const review = page.run.plan.review!;
  return (
    <>
      <Section title="So habe ich deinen Plan verstanden">
        <AiNote />
        <p>{review.mirror}</p>
        <PlanAmpel review={review} paragraphTemplate={stageMedia(page.run.stufe).plan === "paragraph_template"} />
      </Section>
      <form action={step("plan_feedback")} className="space-y-3">
        <Section title="Eine Frage an dich">
          <p>{review.question}</p>
          <label className="block space-y-1">
            <span className="block text-sm text-muted">Deine Antwort (freiwillig)</span>
            <textarea name="antwort" rows={3} maxLength={1000} className="w-full rounded-lg border border-line bg-transparent p-3" />
          </label>
        </Section>
        <SubmitButton>Weiter</SubmitButton>
      </form>
    </>
  );
}

export function PlanApproved({ page, step }: Props) {
  const { run } = page;
  const late = run.notes.includes("plan_approved_after_max_rounds");
  return (
    <>
      <Section>
        <p className="text-lg font-semibold">{late ? "Du kannst jetzt schreiben." : "Dein Plan steht. Du kannst jetzt schreiben."}</p>
        {late && run.plan.gate && run.plan.gate.missing.length > 0 ? (
          <>
            <p>Achte beim Schreiben besonders darauf:</p>
            <ul className="list-disc space-y-1 pl-5">
              {run.plan.gate.missing.map((gap) => (
                <li key={gap}>{PLAN_GAP_HINTS[gap]}</li>
              ))}
            </ul>
          </>
        ) : null}
      </Section>
      {run.plan.confirmed ? (
        <Section title="Dein Plan">
          <PlanSummary plan={run.plan.confirmed} paragraphTemplate={stageMedia(run.stufe).plan === "paragraph_template"} />
        </Section>
      ) : null}
      <HelpCardList cards={page.helpCards} />
      <form action={step("start_writing")}>
        <SubmitButton>Ich fange an zu schreiben</SubmitButton>
      </form>
    </>
  );
}

export function Writing({ page, step }: Props) {
  const { run } = page;
  const tooShort = run.notes.includes("text_too_short") && run.text.confirmed !== null;
  const fullText = run.stufe !== 1 && run.stufe !== 2;
  return (
    <>
      {run.plan.confirmed ? (
        <details className="rounded-xl border border-line p-4">
          <summary className="min-h-11 cursor-pointer font-semibold">Dein Plan</summary>
          <div className="mt-3">
            <PlanSummary plan={run.plan.confirmed} paragraphTemplate={stageMedia(run.stufe).plan === "paragraph_template"} />
          </div>
        </details>
      ) : null}
      {tooShort ? (
        <p role="status" className="rounded-lg border border-amber-400 p-3">
          {fullText
            ? `Dein Text hat ${run.text.wordCount ?? 0} Wörter. Ein ganzer Text braucht mindestens 80 Wörter. Schreib noch weiter.`
            : "Schreib bitte mindestens einen ganzen Satz."}
        </p>
      ) : null}
      <form action={step("text")} className="space-y-3">
        <label className="block space-y-1">
          <span className="block font-semibold">Dein Text</span>
          <span className="block text-sm text-muted">Lass zwischen zwei Absätzen eine Zeile frei.</span>
          <textarea
            name="text"
            rows={14}
            maxLength={12000}
            defaultValue={tooShort ? (run.text.confirmed ?? []).join("\n\n") : undefined}
            className="w-full rounded-lg border border-line bg-transparent p-3 leading-relaxed"
          />
        </label>
        <HelpCardList cards={page.helpCards} />
        <SubmitButton>Text abgeben</SubmitButton>
      </form>
    </>
  );
}

export function SelfCheck({ page, step }: Props) {
  return (
    <form action={step("self_check")} className="space-y-4">
      <p>Bevor du eine Rückmeldung bekommst: Prüf deinen Text zuerst selbst.</p>
      <SelfCheckFields checklist={page.checklist} paragraphs={page.run.text.confirmed ?? []} />
      <SubmitButton pendingText="Ich lese deinen Text ...">Abschicken</SubmitButton>
    </form>
  );
}

export function AiFeedback({ page, step }: Props) {
  const { run } = page;
  const review = run.feedback.review!;
  const task = review.revision_task;
  return (
    <>
      <AiNote />
      <Section title="Textlupe">
        <Textlupe paragraphs={run.text.confirmed ?? []} lens={review.lens} />
      </Section>
      {page.stars ? (
        <Section title="Deine Sterne">
          <StarsPanel stars={page.stars} eLevel={run.niveauEEnabled} />
        </Section>
      ) : null}
      {review.strengths.length > 0 ? (
        <Section title="Das gelingt dir schon">
          <ul className="space-y-3">
            {review.strengths.map((s, i) => (
              <li key={i}>
                <p>{s.text}</p>
                {s.quote ? <blockquote className="mt-1 border-l-4 border-line pl-3 text-sm italic">{s.quote}</blockquote> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Section title="Dein nächster Schritt">
        <p>{review.next_step}</p>
      </Section>
      {review.self_check_note ? (
        <Section title="Deine Selbsteinschätzung">
          <p>{review.self_check_note}</p>
        </Section>
      ) : null}
      {task.instruction ? (
        <Section title="Deine Überarbeitungsaufgabe">
          <p>{task.instruction}</p>
          {task.target_quote ? <blockquote className="border-l-4 border-accent pl-3 italic">{task.target_quote}</blockquote> : null}
        </Section>
      ) : null}
      <form action={step("start_revision")}>
        <SubmitButton>Zur Überarbeitung</SubmitButton>
      </form>
    </>
  );
}

export function Revision({ page, step }: Props) {
  const { run } = page;
  const task = run.feedback.review?.revision_task;
  const lastCheck = run.revision.checks.at(-1);
  return (
    <>
      <Section title="Deine Aufgabe">
        <AiNote />
        <p>{task?.instruction || "Verbessere eine Stelle in deinem Text, die dir wichtig ist."}</p>
        {task?.target_quote ? <blockquote className="border-l-4 border-accent pl-3 italic">{task.target_quote}</blockquote> : null}
      </Section>
      {lastCheck ? (
        <Section title="Rückmeldung zu deinem ersten Versuch">
          <p>{lastCheck.feedback}</p>
          <p className="text-sm text-muted">Du hast noch einen Versuch.</p>
        </Section>
      ) : null}
      {page.revisionCard ? <HelpCardList cards={[page.revisionCard]} /> : null}
      <form action={step("revision")} className="space-y-3">
        <label className="block space-y-1">
          <span className="block font-semibold">Deine überarbeitete Stelle</span>
          <textarea
            name="text"
            rows={5}
            maxLength={4000}
            required
            defaultValue={run.revision.texts.at(-1) ?? task?.target_quote ?? ""}
            className="w-full rounded-lg border border-line bg-transparent p-3"
          />
        </label>
        <SubmitButton pendingText="Ich prüfe deine Überarbeitung ...">Überarbeitung abgeben</SubmitButton>
      </form>
    </>
  );
}

export function Completed({ page }: { page: MissionPage }) {
  const { run } = page;
  const lastCheck = run.revision.checks.at(-1);
  return (
    <>
      <Section>
        <p className="text-lg">
          +{page.rewards.xp} XP für diese Mission. Du hast jetzt {page.progress.xp} XP.
        </p>
        {run.typedFallback ? <p className="text-sm text-muted">Vermerk: Text getippt.</p> : null}
      </Section>
      {page.stars ? (
        <Section title="Deine Sterne">
          <StarsPanel stars={page.stars} eLevel={run.niveauEEnabled} />
        </Section>
      ) : null}
      {lastCheck ? (
        <Section title="Zu deiner Überarbeitung">
          <AiNote />
          <p>{lastCheck.feedback}</p>
          <blockquote className="border-l-4 border-line pl-3 italic">{run.revision.texts.at(-1)}</blockquote>
        </Section>
      ) : null}
      <Link href={SW_BASE} className="flex min-h-12 items-center justify-center rounded-lg bg-accent px-6 font-semibold text-paper hover:bg-accent-strong">
        Zur Übersicht
      </Link>
    </>
  );
}

export function Held() {
  return (
    <>
      <Section>
        <p>Ein Erwachsener schaut sich deinen Text kurz an. Danach geht es hier weiter.</p>
        <p className="text-sm text-muted">Deine Arbeit ist gespeichert.</p>
      </Section>
      <Link href={SW_BASE} className="flex min-h-12 items-center justify-center rounded-lg border border-line px-6 hover:border-accent">
        Zur Übersicht
      </Link>
    </>
  );
}

export function NotYet() {
  return (
    <Section>
      <p>Dieser Schritt kommt mit dem Foto-Upload.</p>
    </Section>
  );
}
