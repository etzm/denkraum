// One page per mission run; what it shows follows the state of the run (spec 4).
// Every form sends one event; the server applies it through the state machine.

import type { BoundAction } from "@denkraum/sdk";
import type { ReactNode } from "react";
import { lensMarks, revisionTaskFor, splitSentences } from "../domain/feedback.ts";
import type { FormativeStars } from "../domain/rules.ts";
import { MAX_PLAN_REVISIONS, minWordsFor, PLAN_GAP_HINTS, planGate, XP } from "../domain/rules.ts";
import type { MissionRun, MissionState } from "../domain/state.ts";
import { isPlanReviewPending, isTextReviewPending, MAX_REVISION_ATTEMPTS, stageMedia } from "../domain/state.ts";
import { paragraphsToText } from "../domain/text.ts";
import type { Checklist, HelpCard, Mission } from "../schemas/content.ts";
import type { PlanTranscript } from "../schemas/planTranscript.ts";
import { isFlagged } from "../schemas/textReview.ts";
import {
  AiNotice,
  card,
  HelpCardBox,
  Hidden,
  inputClass,
  LensText,
  PlainText,
  PlanSummary,
  primaryButton,
  secondaryButton,
  StarList,
  Steps,
  TrafficLights,
  Unavailable,
} from "./parts.tsx";
import { WordCountField } from "./WordCountField.tsx";

export type RunPageProps = {
  runId: string;
  run: MissionRun;
  mission: Mission;
  checklist: Checklist["items"];
  stars: FormativeStars | null;
  xp: number;
  helpCard: (id: string) => HelpCard | undefined;
  action: (name: string) => BoundAction;
  basePath: string;
};

const STEP_OF: Record<MissionState, number> = {
  briefing: 0,
  planning: 1,
  plan_uploaded: 1,
  plan_confirm: 1,
  plan_feedback: 1,
  plan_revise: 1,
  plan_approved: 1,
  writing: 2,
  text_uploaded: 2,
  text_confirm: 2,
  self_check: 3,
  ai_feedback: 4,
  held_for_adult: 4,
  revision: 5,
  completed: 6,
};

export function RunPage(props: RunPageProps) {
  const { run, mission } = props;
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-sm text-muted">
          Mission {mission.id} · Stufe {mission.stufe}
        </p>
        <h1 className="text-2xl font-semibold">{mission.title}</h1>
        <Steps current={STEP_OF[run.state]} />
      </header>
      <State {...props} />
    </div>
  );
}

function State(props: RunPageProps) {
  switch (props.run.state) {
    case "briefing":
      return <Briefing {...props} />;
    case "planning":
    case "plan_revise":
      return <Planning {...props} />;
    case "plan_feedback":
      return <PlanFeedback {...props} />;
    case "plan_approved":
      return <PlanApproved {...props} />;
    case "writing":
      return <Writing {...props} />;
    case "self_check":
      return <SelfCheckStep {...props} />;
    case "ai_feedback":
      return <TextFeedback {...props} />;
    case "revision":
      return <Revision {...props} />;
    case "completed":
      return <Completed {...props} />;
    case "held_for_adult":
      return <Held {...props} />;
    default:
      // Photo states belong to phase B2; a typed run never gets there.
      return <Unavailable>Dieser Schritt ist noch nicht gebaut. Geh zurück zur Schreibwerkstatt.</Unavailable>;
  }
}

/** A form that sends one event for this run. */
function RunForm({ props, name, children, className = "space-y-4" }: { props: RunPageProps; name: string; children: ReactNode; className?: string }) {
  return (
    <form action={props.action(name)} className={className}>
      <Hidden name="lauf" value={props.runId} />
      {children}
    </form>
  );
}

function Submit({ children }: { children: ReactNode }) {
  return (
    <button type="submit" className={primaryButton}>
      {children}
    </button>
  );
}

/** Shown when a system step was interrupted (for example the app was closed); resumes it (spec 4). */
function Pending({ props, text }: { props: RunPageProps; text: string }) {
  return (
    <section className={card}>
      <p role="status">{text}</p>
      <RunForm props={props} name="weiter">
        <button type="submit" className={secondaryButton}>
          Rückmeldung holen
        </button>
      </RunForm>
    </section>
  );
}

// ---------------------------------------------------------------------------
// briefing

function Briefing(props: RunPageProps) {
  const { mission, checklist } = props;
  return (
    <>
      <section className={card} aria-labelledby="auftrag">
        <h2 id="auftrag" className="text-xl font-semibold">
          Dein Auftrag
        </h2>
        <p className="leading-relaxed">{mission.prompt}</p>
        <dl className="grid gap-2 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Adressat</dt>
            <dd>{mission.adressat ?? "kein Adressat"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Operator</dt>
            <dd>{mission.operator}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Textform</dt>
            <dd>{mission.schreibform === "stellungnahme" ? "Begründete Stellungnahme" : "Lineare Erörterung"}</dd>
          </div>
        </dl>
        <p className="rounded-xl bg-note p-3 text-sm">
          Diesmal planst und schreibst du direkt hier in der App. Das Formular hat dieselben Kästen wie der Planungsbogen. Schreib keinen
          Namen in deinen Plan und deinen Text.
        </p>
      </section>
      <section className={card} aria-labelledby="kriterien">
        <h2 id="kriterien" className="text-lg font-semibold">
          Daran erkennst du einen gelungenen Text
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          {checklist.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Nimm dir etwa {mission.timeboxPlan} Minuten zum Planen und {mission.timeboxWrite} Minuten zum Schreiben. Die Zeit ist nur ein
          Richtwert.
        </p>
      </section>
      <RunForm props={props} name="auftrag">
        <Submit>Ich habe den Auftrag verstanden</Submit>
      </RunForm>
    </>
  );
}

// ---------------------------------------------------------------------------
// planning and plan_revise: typed form with the boxes of the planning sheet

function Box({ id, name, label, value, rows = 2, hint }: { id: string; name: string; label: string; value: string; rows?: number; hint?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hinweis`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={1000}
        defaultValue={value}
        aria-describedby={hint ? `${id}-hinweis` : undefined}
        className={inputClass}
      />
    </div>
  );
}

function Planning(props: RunPageProps) {
  const { run } = props;
  const revising = run.state === "plan_revise";
  const plan: PlanTranscript | null = revising ? run.plan.confirmed : null;
  const missing = run.plan.gate?.missing ?? [];
  const aiMissing = revising ? (run.plan.review?.missing ?? []) : [];
  return (
    <>
      {revising && (
        <section className={card} aria-labelledby="fehlt">
          <h2 id="fehlt" className="text-xl font-semibold">
            Dein Plan braucht noch etwas
          </h2>
          <p className="text-sm text-muted">
            Überarbeitungsrunde {run.plan.round} von {MAX_PLAN_REVISIONS}. Die App hat geprüft:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {missing.map((gap) => (
              <li key={gap}>{PLAN_GAP_HINTS[gap]}</li>
            ))}
          </ul>
          {aiMissing.length > 0 && (
            <div className="space-y-1 border-t border-line pt-3">
              <AiNotice />
              <p className="text-sm">Die KI hat außerdem notiert: {aiMissing.join(", ")}.</p>
            </div>
          )}
        </section>
      )}
      <RunForm props={props} name="plan" className={`${card} space-y-4`}>
        <h2 className="text-xl font-semibold">{revising ? "Ergänze deinen Plan" : "Plane deinen Text"}</h2>
        <p className="text-sm text-muted">Drei Fragen helfen dir: Was meine ich? Warum? Woran sieht man das? Stichworte reichen.</p>
        <Box id="thema" name="thema" label="Thema" value={plan?.thema ?? ""} rows={1} />
        <Box id="standpunkt" name="standpunkt" label="Mein Standpunkt" value={plan?.standpunkt ?? ""} />
        {[1, 2, 3].map((n) => {
          const a = plan?.argumente[n - 1];
          return (
            <fieldset key={n} className="space-y-3 rounded-xl border border-line p-4">
              <legend className="px-1 font-semibold">Argument {n}</legend>
              <Box id={`a${n}_behauptung`} name={`a${n}_behauptung`} label="Behauptung" value={a?.behauptung ?? ""} rows={1} />
              <Box id={`a${n}_begruendung`} name={`a${n}_begruendung`} label="Begründung" value={a?.begruendung ?? ""} />
              <Box id={`a${n}_beispiel`} name={`a${n}_beispiel`} label="Beispiel" value={a?.beispiel ?? ""} />
            </fieldset>
          );
        })}
        <Box
          id="reihenfolge"
          name="reihenfolge"
          label="Reihenfolge"
          value={plan?.reihenfolge ?? ""}
          rows={1}
          hint="In welcher Reihenfolge kommen deine Argumente? Das stärkste kommt zuletzt, zum Beispiel 2, 1, 3."
        />
        <Box id="schluss" name="schluss" label="Schluss" value={plan?.schluss ?? ""} hint="Deine Idee für den Schluss: Fazit, Bitte oder Ausblick." />
        <Submit>Plan abschicken</Submit>
      </RunForm>
    </>
  );
}

// ---------------------------------------------------------------------------
// plan_feedback: P2 (AI) plus the code gate

function PlanFeedback(props: RunPageProps) {
  const { run } = props;
  if (isPlanReviewPending(run)) return <Pending props={props} text="Ich lese deinen Plan." />;
  const plan = run.plan.confirmed!;
  const review = run.plan.review;
  const template = stageMedia(run.stufe).plan;
  const gate = template === "none" ? { approved: true, missing: [] } : planGate(plan, template);
  const lastRound = run.plan.round > MAX_PLAN_REVISIONS;
  return (
    <>
      {review ? (
        <section className={card} aria-labelledby="plan-rueckmeldung">
          <h2 id="plan-rueckmeldung" className="text-xl font-semibold">
            Rückmeldung zu deinem Plan
          </h2>
          <AiNotice />
          <p>{review.mirror}</p>
          <TrafficLights criteria={review.criteria} />
          <p>
            <span className="font-semibold">Eine Frage an dich: </span>
            {review.question}
          </p>
        </section>
      ) : (
        <Unavailable>Die Rückmeldung zu deinem Plan ist gerade nicht verfügbar. Du kannst trotzdem weitermachen.</Unavailable>
      )}
      <section className={card} aria-labelledby="pruefung">
        <h2 id="pruefung" className="text-lg font-semibold">
          Prüfung durch die App
        </h2>
        <ul className="space-y-1">
          <li>{gate.missing.includes("standpunkt") ? "✗" : "✓"} Dein Standpunkt steht im Plan.</li>
          <li>{gate.missing.includes("zwei_argumente_mit_begruendung") ? "✗" : "✓"} Mindestens zwei Argumente haben eine Behauptung und eine Begründung.</li>
        </ul>
        <p className="font-semibold">
          {gate.approved
            ? "Dein Plan ist bereit zum Schreiben."
            : lastRound
              ? "Du hast deinen Plan schon zweimal überarbeitet. Er wird trotzdem freigegeben."
              : "Ergänze deinen Plan noch, dann geht es weiter."}
        </p>
      </section>
      <RunForm props={props} name="planWeiter">
        {review && (
          <div className="space-y-1">
            <label htmlFor="antwort" className="block font-medium">
              Deine Antwort auf die Frage (freiwillig)
            </label>
            <textarea id="antwort" name="antwort" rows={2} maxLength={500} className={inputClass} />
          </div>
        )}
        <Submit>Weiter</Submit>
      </RunForm>
    </>
  );
}

function PlanApproved(props: RunPageProps) {
  const { run } = props;
  const afterMax = run.notes.includes("plan_approved_after_max_rounds");
  return (
    <>
      <section className={card} aria-labelledby="freigegeben">
        <h2 id="freigegeben" className="text-xl font-semibold">
          Dein Plan ist freigegeben
        </h2>
        <p>
          {afterMax
            ? "Du hast zwei Runden an deinem Plan gearbeitet. Beim Schreiben kannst du ihn noch verbessern."
            : "Jetzt schreibst du deinen Text. Dein Plan bleibt beim Schreiben sichtbar."}
        </p>
        {run.plan.confirmed && <PlanSummary plan={run.plan.confirmed} />}
      </section>
      <RunForm props={props} name="schreiben">
        <Submit>Ich fange an zu schreiben</Submit>
      </RunForm>
    </>
  );
}

// ---------------------------------------------------------------------------
// writing: typed text (B1)

function Writing(props: RunPageProps) {
  const { run, mission } = props;
  const minWords = minWordsFor(run.stufe);
  const previous = run.text.confirmed;
  const tooShort = previous !== null && (run.text.wordCount ?? 0) < minWords;
  return (
    <>
      {run.plan.confirmed && (
        <details className={card}>
          <summary className="cursor-pointer font-semibold">Dein Plan</summary>
          <PlanSummary plan={run.plan.confirmed} />
        </details>
      )}
      {tooShort && (
        <p role="alert" className="rounded-xl border border-bad bg-card p-4">
          Dein Text hat {run.text.wordCount} Wörter. Für eine Rückmeldung braucht er mindestens {minWords} Wörter. Schreib weiter.
        </p>
      )}
      <RunForm props={props} name="text" className={`${card} space-y-4`}>
        <h2 className="text-xl font-semibold">Schreib deinen Text</h2>
        <WordCountField
          id="text"
          name="text"
          label="Dein Text"
          rows={16}
          minWords={minWords}
          defaultValue={previous ? previous.join("\n\n") : ""}
          hint={`Schreib an: ${mission.adressat ?? "deinen Adressaten"}. Beginne jeden Absatz in einer neuen Zeile: Einleitung, ein Absatz je Argument, Schluss. Nimm dir etwa ${mission.timeboxWrite} Minuten.`}
        />
        <Submit>Text abschicken</Submit>
      </RunForm>
    </>
  );
}

// ---------------------------------------------------------------------------
// self_check: checklist, optional marks (thesis, examples)

function SelfCheckStep(props: RunPageProps) {
  const { run, checklist } = props;
  const paragraphs = run.text.confirmed ?? [];
  const sentences = splitSentences(paragraphs);
  return (
    <RunForm props={props} name="selbstkontrolle" className="space-y-4">
      <section className={card} aria-labelledby="dein-text">
        <h2 id="dein-text" className="text-xl font-semibold">
          Prüf deinen Text selbst
        </h2>
        <PlainText paragraphs={paragraphs} />
      </section>
      <fieldset className={card}>
        <legend className="px-1 text-lg font-semibold">Hake ab, was dein Text schon erfüllt</legend>
        {checklist.map((item) => (
          <label key={item.id} className="flex min-h-11 items-start gap-3">
            <input type="checkbox" name="punkt" value={item.id} className="mt-1 h-5 w-5" />
            <span>{item.text}</span>
          </label>
        ))}
      </fieldset>
      <details className={card}>
        <summary className="cursor-pointer font-semibold">Markiere deine These und deine Beispiele (freiwillig)</summary>
        <p className="text-sm text-muted">Wähle den Satz mit deiner These und die Sätze mit Beispielen.</p>
        <ol className="space-y-2">
          {sentences.map((s, i) => (
            <li key={i} className="rounded-lg border border-line p-3 space-y-2">
              <p>{s}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex min-h-11 items-center gap-2">
                  <input type="radio" name="these" value={i} className="h-5 w-5" />
                  These
                </label>
                <label className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" name="beispiel" value={i} className="h-5 w-5" />
                  Beispiel
                </label>
              </div>
            </li>
          ))}
        </ol>
      </details>
      <Submit>Selbstkontrolle abschicken</Submit>
    </RunForm>
  );
}

// ---------------------------------------------------------------------------
// ai_feedback: P4 (AI), quotes checked by code, stars formative

function TextFeedback(props: RunPageProps) {
  const { run, stars } = props;
  if (isTextReviewPending(run)) return <Pending props={props} text="Ich lese deinen Text." />;
  const review = run.feedback.review;
  const paragraphs = run.text.confirmed ?? [];
  const next = (
    <RunForm props={props} name="ueberarbeiten">
      <Submit>Zur Überarbeitung</Submit>
    </RunForm>
  );
  if (!review) {
    return (
      <>
        <Unavailable>
          Die Rückmeldung zu deinem Text ist gerade nicht verfügbar. Du kannst trotzdem weitermachen und deinen Text überarbeiten.
        </Unavailable>
        {next}
      </>
    );
  }
  if (isFlagged(review)) {
    return (
      <>
        <section className={card} aria-labelledby="text-rueckmeldung">
          <h2 id="text-rueckmeldung" className="text-xl font-semibold">
            Rückmeldung zu deinem Text
          </h2>
          <AiNotice />
          <p>{review.next_step}</p>
        </section>
        {next}
      </>
    );
  }
  const verified = run.feedback.quotesVerified === true;
  return (
    <>
      <section className={card} aria-labelledby="text-rueckmeldung">
        <h2 id="text-rueckmeldung" className="text-xl font-semibold">
          Rückmeldung zu deinem Text
        </h2>
        <AiNotice />
        <h3 className="font-semibold">Textlupe</h3>
        {verified ? (
          <LensText text={paragraphsToText(paragraphs)} marks={lensMarks(review.lens)} />
        ) : (
          <>
            <p className="text-sm text-muted">Die Markierungen passten nicht genau zu deinem Text. Deshalb siehst du ihn ohne Markierungen.</p>
            <PlainText paragraphs={paragraphs} />
          </>
        )}
        <h3 className="font-semibold">Zwei Stärken</h3>
        <ul className="space-y-3">
          {review.strengths.map((s, i) => (
            <li key={i} className="space-y-1">
              <p>{s.text}</p>
              {verified && s.quote && <blockquote className="border-l-4 border-accent pl-3 text-sm italic">{s.quote}</blockquote>}
            </li>
          ))}
        </ul>
        <h3 className="font-semibold">Dein nächster Schritt</h3>
        <p>{review.next_step}</p>
        {review.self_check_note && (
          <>
            <h3 className="font-semibold">Abgleich mit deiner Selbstkontrolle</h3>
            <p>{review.self_check_note}</p>
          </>
        )}
      </section>
      {stars && (
        <section className={card} aria-labelledby="sterne">
          <h2 id="sterne" className="text-lg font-semibold">
            Deine Sterne
          </h2>
          <AiNotice text="Die Sterne hat eine KI vergeben. Sie sind eine Rückmeldung, keine Bewertung." />
          <StarList stars={stars} />
        </section>
      )}
      {next}
    </>
  );
}

// ---------------------------------------------------------------------------
// revision: one task, one passage, typed (SW-12); P5 checks, one retry

function Revision(props: RunPageProps) {
  const { run, helpCard } = props;
  const task = revisionTaskFor(run);
  if (!task) return <Unavailable>Zu dieser Mission gibt es keinen Text zum Überarbeiten.</Unavailable>;
  if (run.revision.texts.length > run.revision.checks.length) return <Pending props={props} text="Ich prüfe deine Überarbeitung." />;
  const lastCheck = run.revision.checks.at(-1);
  const attempt = run.revision.texts.length + 1;
  const card_ = helpCard(task.helpCardId);
  return (
    <>
      <section className={card} aria-labelledby="aufgabe">
        <h2 id="aufgabe" className="text-xl font-semibold">
          Deine Überarbeitungsaufgabe
        </h2>
        {task.source === "ai" ? <AiNotice /> : <p className="text-sm text-muted">Diese Aufgabe kommt von der App.</p>}
        <p>{task.instruction}</p>
        <p className="text-sm font-semibold">Diese Stelle überarbeitest du:</p>
        <blockquote className="border-l-4 border-accent pl-3 italic">{task.targetQuote}</blockquote>
        {card_ && <HelpCardBox card={card_} />}
      </section>
      {lastCheck && (
        <section className={card} aria-labelledby="erster-versuch">
          <h2 id="erster-versuch" className="text-lg font-semibold">
            Rückmeldung zu deinem ersten Versuch
          </h2>
          <AiNotice />
          <p>{lastCheck.feedback}</p>
          <p className="text-sm text-muted">Du hast noch einen Versuch. Danach geht es auf jeden Fall weiter.</p>
        </section>
      )}
      <RunForm props={props} name="ueberarbeitung" className={`${card} space-y-4`}>
        <div className="space-y-1">
          <label htmlFor="ueberarbeitung" className="block font-semibold">
            Deine überarbeitete Stelle (Versuch {attempt} von {MAX_REVISION_ATTEMPTS})
          </label>
          <textarea
            id="ueberarbeitung"
            name="ueberarbeitung"
            rows={6}
            required
            maxLength={2000}
            defaultValue={run.revision.texts.at(-1) ?? task.targetQuote}
            className={inputClass}
          />
        </div>
        <Submit>Überarbeitung abschicken</Submit>
      </RunForm>
    </>
  );
}

// ---------------------------------------------------------------------------
// completed

function Completed(props: RunPageProps) {
  const { run, stars, xp, basePath } = props;
  const lastCheck = run.revision.checks.at(-1);
  const revised = run.revision.texts.length > 0;
  return (
    <>
      <section className={card} aria-labelledby="geschafft">
        <h2 id="geschafft" className="text-2xl font-semibold">
          Mission geschafft!
        </h2>
        <p className="text-3xl font-semibold text-accent">+{xp} XP</p>
        <ul className="text-sm text-muted">
          <li>{XP.missionCompleted} XP für die abgeschlossene Mission</li>
          {revised && <li>{XP.revisionSubmitted} XP für deine Überarbeitung</li>}
        </ul>
      </section>
      {lastCheck && (
        <section className={card} aria-labelledby="ueberarbeitung-rueckmeldung">
          <h2 id="ueberarbeitung-rueckmeldung" className="text-lg font-semibold">
            Rückmeldung zu deiner Überarbeitung
          </h2>
          <AiNotice />
          <p>{lastCheck.feedback}</p>
          {!lastCheck.fulfilled && <p className="text-sm text-muted">Die Mission ist trotzdem abgeschlossen.</p>}
        </section>
      )}
      {lastCheck === null && <Unavailable>Deine Überarbeitung ist gespeichert. Eine Rückmeldung dazu gibt es diesmal nicht.</Unavailable>}
      {stars && (
        <section className={card} aria-labelledby="sterne-ende">
          <h2 id="sterne-ende" className="text-lg font-semibold">
            Deine Sterne in dieser Mission
          </h2>
          <AiNotice text="Die Sterne hat eine KI vergeben. Sie sind eine Rückmeldung, keine Bewertung." />
          <StarList stars={stars} />
        </section>
      )}
      <a href={basePath} className={`${primaryButton} inline-flex items-center justify-center`}>
        Zurück zur Schreibwerkstatt
      </a>
    </>
  );
}

// ---------------------------------------------------------------------------
// held_for_adult: no feedback, a neutral message (spec 7.6, SW-09)

function Held({ basePath }: RunPageProps) {
  return (
    <>
      <section className={card} aria-labelledby="angehalten">
        <h2 id="angehalten" className="text-xl font-semibold">
          Danke für deinen Text
        </h2>
        <p role="status">Ein Erwachsener schaut sich deinen Text an, bevor es hier weitergeht. Du musst nichts weiter tun.</p>
      </section>
      <a href={basePath} className={`${secondaryButton} inline-flex items-center`}>
        Zurück zur Schreibwerkstatt
      </a>
    </>
  );
}
