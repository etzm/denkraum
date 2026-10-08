import type { TeacherContext } from "@denkraum/sdk";
import { formatGiven, withUnit } from "../domain/format.ts";
import { lessonPassed, lessonTasks, OPEN_LESSONS, PASS_TASKS } from "../domain/lesson.ts";
import { MISCONCEPTIONS } from "../domain/misconceptions.ts";
import { countedResults, REASON_MAX, REASON_MIN, type EffectiveResult, type OverrideError } from "../domain/overrides.ts";
import { lessonCodes, taskOverview, type CodeCount } from "../domain/overview.ts";
import type { Task } from "../domain/schema.ts";
import { getTask } from "../domain/tasks.ts";
import type { VerificationStatus } from "../domain/verify.ts";
import { confirmedTasks, groupOverrides, groupResults, learnerOf, overviewAttempts, sheetCodes } from "../server/teacher.ts";
import { buttonPrimary, Card, Note } from "./common.tsx";

/**
 * Teacher view of the module (D-030, D-031): the error picture of the class and, per learner,
 * the results with corrections. Adults are addressed with "Sie" (D-009).
 */

const LESSON = OPEN_LESSONS[0]!;

const STATUS: Record<VerificationStatus, string> = {
  correct: "richtig",
  partially_correct: "fast richtig",
  incorrect: "falsch",
  not_found: "nicht gefunden",
};

const ERRORS: Record<OverrideError, string> = {
  reason: `Bitte geben Sie eine Begründung mit ${REASON_MIN} bis ${REASON_MAX} Zeichen an.`,
  unchanged: "Diese Korrektur ändert nichts am aktuellen Stand.",
  kind: "Bitte wählen Sie, was Sie ändern möchten.",
  status: "Bitte wählen Sie ein Ergebnis.",
};

/** The task text with the numbers left out: every learner has their own numbers. */
function taskText(task: Task): string {
  const def = task.levels.M ?? task.levels.G ?? task.levels.E;
  return (def?.text ?? "").replace(/\{\{\s*\w+\s*\}\}/g, "…");
}

const TYPE: Record<string, string> = { paper: "Papieraufgabe", faded: "Lückenaufgabe", worked_example: "Musterbeispiel" };

const time = (date: Date) => date.toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });

function CodeList({ codes, names }: { codes: readonly CodeCount[]; names: (ids: readonly string[]) => string }) {
  if (codes.length === 0) return <p className="text-muted">Keine Fehlertypen erkannt.</p>;
  return (
    <ul className="space-y-2">
      {codes.map((c) => (
        <li key={c.code} className="rounded-lg border border-line bg-paper p-3">
          <p className="font-medium">
            {c.label} <span className="text-sm text-muted">({c.code})</span>
          </p>
          <p className="text-sm">
            Jetzt: {c.learnerIds.length === 0 ? "niemand" : `${c.learnerIds.length} (${names(c.learnerIds)})`} · Versuche insgesamt: {c.attempts}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** K1: error picture of the class for the open lesson, built by code from verify() (D-030). */
export async function TeacherOverview({ ctx }: { ctx: TeacherContext }) {
  const { faded, paper } = lessonTasks(LESSON);
  const tasks = [...faded, ...paper];
  const paperIds = paper.map((t) => t.id);
  const perTask = taskOverview(
    tasks.map((t) => t.id),
    await overviewAttempts(ctx, paperIds, faded.map((t) => t.id)),
  );
  const pseudonym = new Map(ctx.learners.map((l) => [l.id, l.pseudonym]));
  const names = (ids: readonly string[]) => ids.map((id) => pseudonym.get(id) ?? "?").join(", ");
  const results = await groupResults(ctx, paperIds);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Trigonometrie: Fehlerbild der Klasse</h1>
        <p className="text-muted">
          Lektion {LESSON}. Gezählt wird der letzte Versuch jeder Schülerin und jedes Schülers; Ihre Korrekturen sind eingerechnet. Die Fehlertypen erkennt das
          Programm über die Musterlösungen, nicht die KI.
        </p>
      </header>

      <Card label="Häufigste Fehlertypen">
        <h2 className="text-lg font-semibold">Häufigste Fehlertypen in Lektion {LESSON}</h2>
        <CodeList codes={lessonCodes(perTask)} names={names} />
      </Card>

      <ol className="space-y-4">
        {perTask.map((overview) => {
          const task = getTask(overview.taskId);
          const { latest } = overview;
          return (
            <li key={task.id}>
              <Card label={`Aufgabe ${task.id}`}>
                <h2 className="font-semibold">
                  {task.id} · {TYPE[task.type] ?? task.type}
                </h2>
                <p className="text-sm text-muted">{taskText(task)}</p>
                {overview.learners === 0 ? (
                  <p>Noch niemand hat diese Aufgabe bearbeitet.</p>
                ) : (
                  <>
                    <p data-testid={`stand-${task.id}`}>
                      Bearbeitet von {overview.learners}: richtig {latest.correct}, fast richtig {latest.partially_correct}, falsch {latest.incorrect}
                      {latest.not_found > 0 ? `, nicht gefunden ${latest.not_found}` : ""}
                    </p>
                    <CodeList codes={overview.codes} names={names} />
                  </>
                )}
              </Card>
            </li>
          );
        })}
      </ol>

      <Card label="Schülerinnen und Schüler">
        <h2 className="text-lg font-semibold">Schülerinnen und Schüler</h2>
        {ctx.learners.length === 0 ? (
          <p>Noch hat sich niemand angemeldet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {ctx.learners.map((learner) => {
              const own = countedResults(results.filter((r) => r.learnerId === learner.id).map((r) => r.effective));
              const right = paper.filter((t) => own.some((r) => r.taskId === t.id && r.status === "correct")).length;
              return (
                <li key={learner.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <a href={`${ctx.basePath}/lernende/${learner.id}`} className="min-h-11 inline-flex items-center font-medium underline underline-offset-4">
                    {learner.pseudonym}
                  </a>
                  <span className="text-sm text-muted">
                    {own.length === 0
                      ? "noch keine Abgabe"
                      : lessonPassed(paper, own)
                        ? `Lektion ${LESSON} geschafft`
                        : `${right} von ${paper.length} Papieraufgaben richtig`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CorrectionForm({ ctx, result, open }: { ctx: TeacherContext; result: EffectiveResult; open: boolean }) {
  const options: { value: string; label: string }[] = [
    ...(["correct", "partially_correct", "incorrect", "not_found"] as const)
      .filter((s) => result.override?.kind === "void" || s !== result.status)
      .map((s) => ({ value: `status:${s}`, label: `Ergebnis ist ${STATUS[s]}` })),
    ...(result.counted ? [{ value: "void", label: "Versuch zählt nicht (weiterer Versuch)" }] : []),
    ...(result.override ? [{ value: "clear", label: "Korrektur zurücknehmen" }] : []),
  ];
  return (
    <details open={open} className="rounded-xl border border-line bg-paper">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 font-medium">Korrigieren</summary>
      <form action={ctx.action("korrigieren")} className="space-y-3 border-t border-line p-3">
        <input type="hidden" name="ergebnis" value={result.resultId} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Was soll gelten?</legend>
          {options.map((o) => (
            <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-2">
              <input type="radio" name="wahl" value={o.value} required className="h-5 w-5" />
              {o.label}
            </label>
          ))}
        </fieldset>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Begründung (sieht auch die Schülerin oder der Schüler)</span>
          <textarea
            name="grund"
            required
            minLength={REASON_MIN}
            maxLength={REASON_MAX}
            rows={2}
            className="w-full rounded-lg border border-line bg-card p-2"
            placeholder="zum Beispiel: Einheit steht auf dem Foto, wurde nicht gelesen."
          />
        </label>
        <button type="submit" className={buttonPrimary}>
          Korrektur speichern
        </button>
      </form>
    </details>
  );
}

/** K5: results of one learner with the confirmed values and the correction log (D-031). */
export async function TeacherLearnerPage({ ctx, learnerId, search }: { ctx: TeacherContext; learnerId: string; search: Record<string, string | undefined> }) {
  const learner = learnerOf(ctx, learnerId);
  if (!learner) return null;
  const { paper } = lessonTasks(LESSON);
  const results = (await groupResults(ctx, paper.map((t) => t.id))).filter((r) => r.learnerId === learner.id);
  const log = await groupOverrides(ctx, results.map((r) => r.row.id));
  const codes = await sheetCodes(ctx, results.map((r) => r.row.worksheetId));
  const confirmed = await confirmedTasks(ctx, results.flatMap((r) => (r.row.transcriptId ? [r.row.transcriptId] : [])));
  const passed = lessonPassed(paper, countedResults(results.map((r) => r.effective)));
  const error = search.fehler as OverrideError | undefined;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted">Trigonometrie · Lektion {LESSON}</p>
        <h1 className="text-2xl font-semibold">{learner.pseudonym}</h1>
        <p>{passed ? `Lektion ${LESSON} geschafft.` : `Lektion ${LESSON} ist geschafft, wenn ${PASS_TASKS} Papieraufgaben im ersten oder zweiten Versuch richtig sind.`}</p>
        <p className="text-sm text-muted">
          Sie sehen, was die Schülerin oder der Schüler als gelesen bestätigt hat, nicht das Foto. Korrigieren Sie, wenn das Programm falsch entschieden hat; jede
          Korrektur wird mit Begründung gespeichert und der Schülerin oder dem Schüler angezeigt.
        </p>
      </header>

      {results.length === 0 && <p>Noch keine Papieraufgabe abgegeben.</p>}
      <ol className="space-y-4">
        {results.map(({ row, effective }) => {
          const task = getTask(row.taskId);
          const values = (confirmed.get(row.transcriptId ?? "") ?? []).find((t) => t.task_id === row.taskId)?.final_answers ?? [];
          const entries = log.filter((o) => o.resultId === row.id);
          const changed = effective.status !== effective.originalStatus;
          return (
            <li key={row.id} id={`ergebnis-${row.id}`}>
              <Card label={`${row.taskId}, Blatt ${codes.get(row.worksheetId) ?? "?"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">
                    {row.taskId} · Blatt {codes.get(row.worksheetId) ?? "?"} · {effective.counted ? `Versuch ${effective.attemptNo}` : "ohne Wertung"}
                  </h2>
                  <span data-testid={`status-${row.id}`} className="font-semibold">
                    {effective.counted ? STATUS[effective.status] : "zählt nicht"}
                    {changed && effective.counted && <span className="text-sm font-normal text-muted"> (Programm: {STATUS[effective.originalStatus]})</span>}
                  </span>
                </div>
                <p className="text-sm text-muted">{taskText(task)}</p>
                <p>
                  Bestätigte Werte:{" "}
                  {values.length === 0 ? "keine" : values.map((a) => `${a.quantity} = ${withUnit(a.value === null ? "?" : formatGiven(a.value), a.unit ?? "")}`).join("; ")}
                </p>
                {effective.codes.length > 0 && <p className="text-sm">Erkannt: {effective.codes.map((c) => `${MISCONCEPTIONS[c].label} (${c})`).join(", ")}</p>}
                {row.solutionViewed && <p className="text-sm text-muted">Lösungsweg angesehen.</p>}
                {entries.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">Korrekturen</h3>
                    <ul className="space-y-1 text-sm">
                      {entries.map((o) => (
                        <li key={o.id}>
                          {time(o.createdAt)}:{" "}
                          {o.kind === "status" && o.status ? `Ergebnis ${STATUS[o.status]}` : o.kind === "void" ? "Versuch zählt nicht" : "Korrektur zurückgenommen"}. {o.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {search.ergebnis === row.id && error && ERRORS[error] && (
                  <Note tone="bad" role="alert">
                    <p>{ERRORS[error]}</p>
                  </Note>
                )}
                {search.gespeichert === row.id && (
                  <Note tone="ok" role="status">
                    <p>Korrektur gespeichert.</p>
                  </Note>
                )}
                <CorrectionForm ctx={ctx} result={effective} open={search.ergebnis === row.id || search.gespeichert === row.id} />
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
