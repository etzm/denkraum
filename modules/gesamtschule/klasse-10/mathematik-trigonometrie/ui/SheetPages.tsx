import { PhotoCapture } from "@denkraum/capture";
import type { ModuleContext, UploadSummary } from "@denkraum/sdk";
import { needsNewPhoto, readingCheck, transcribedFor, type ReadingFlag } from "../domain/ai.ts";
import { formatGiven, formatInput, renderText, textVariables, unitOf, withUnit } from "../domain/format.ts";
import { catalogHint, lessonPassed, lessonTasks, PASS_TASKS, solutionAvailable, statusLabel } from "../domain/lesson.ts";
import { MISCONCEPTIONS, type MisconceptionCode } from "../domain/misconceptions.ts";
import { getTask } from "../domain/tasks.ts";
import type { VerificationResult } from "../domain/verify.ts";
import { countedResults, type EffectiveResult } from "../domain/overrides.ts";
import { confirmedOf, effectiveResultsOf, feedbackTexts, resultsOf, resultsOfSheet, transcriptOf, type Worksheet } from "../server/store.ts";
import { AiNotice, buttonPrimary, buttonQuiet, buttonSecondary, Card, Note, StatusBadge, Steps } from "./common.tsx";
import { WaitingForm } from "./client.tsx";

function SheetHeader({ sheet, title }: { sheet: Worksheet; title: string }) {
  return (
    <header className="space-y-2">
      <p className="text-sm text-muted">
        Lektion {sheet.lesson} · Niveau {sheet.niveau} · Blatt-Code <span className="font-mono font-semibold text-ink">{sheet.sheetCode}</span>
      </p>
      <h1 className="text-2xl font-semibold">{title}</h1>
    </header>
  );
}

function taskTexts(sheet: Worksheet) {
  return sheet.taskIds.map((id, i) => {
    const task = getTask(id);
    const def = task.levels[sheet.niveau];
    const vars = textVariables(task, sheet.niveau, sheet.params[id] ?? {});
    return {
      id,
      number: i + 1,
      text: def ? renderText(def.text, vars) : "",
      extra: def?.extra ? renderText(def.extra, vars) : null,
    };
  });
}

/** Screen 4 (spec A 5.4, D-012): the sheet on the iPad, solved on blank paper. */
export async function WorksheetPage({ ctx, sheet }: { ctx: ModuleContext; sheet: Worksheet }) {
  const evaluated = (await resultsOfSheet(ctx, sheet.id)).length > 0;
  return (
    <div className="space-y-6">
      <SheetHeader sheet={sheet} title="Dein Arbeitsblatt" />
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-ink bg-card p-4">
        <span className="text-sm font-medium">Blatt-Code</span>
        <span className="font-mono text-4xl font-bold tracking-[0.3em]" data-testid="blatt-code">
          {sheet.sheetCode}
        </span>
      </div>
      <Note>
        <p className="font-semibold">Skizze, Rechenweg, Antwortsatz mit Einheit. Schreib den Blatt-Code und die Aufgabennummer an jede Lösung.</p>
        <p className="text-sm">Rechne auf einem leeren Blatt Papier. Schreib deinen Namen nicht auf das Blatt.</p>
      </Note>
      <ol className="space-y-4">
        {taskTexts(sheet).map((t) => (
          <li key={t.id}>
            <Card label={`Aufgabe ${t.number}`}>
              <h2 className="font-semibold">Aufgabe {t.number}</h2>
              <p>{t.text}</p>
              {t.extra && <p className="text-sm text-muted">Zusatz: {t.extra}</p>}
            </Card>
          </li>
        ))}
      </ol>
      {sheet.withHelp && <p className="text-sm text-muted">Die Lückenaufgaben hast du mit Hilfe gelöst.</p>}
      {evaluated ? (
        <a href={`${ctx.basePath}/blatt/${sheet.id}/ergebnis`} className={buttonPrimary}>
          Rückmeldung ansehen
        </a>
      ) : (
        <a href={`${ctx.basePath}/blatt/${sheet.id}/foto`} className={buttonPrimary}>
          Fertig? Foto hochladen
        </a>
      )}
    </div>
  );
}

/** Screen 5 (spec A 5.5): photos of the paper, re-encoded in the browser. */
export async function PhotoPage({ ctx, sheet }: { ctx: ModuleContext; sheet: Worksheet }) {
  if ((await resultsOfSheet(ctx, sheet.id)).length > 0) {
    return (
      <div className="space-y-6">
        <SheetHeader sheet={sheet} title="Foto hochladen" />
        <p>Dieses Blatt ist schon ausgewertet.</p>
        <a href={`${ctx.basePath}/blatt/${sheet.id}/ergebnis`} className={buttonPrimary}>
          Rückmeldung ansehen
        </a>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <SheetHeader sheet={sheet} title="Foto hochladen" />
      <p>
        Fotografier deine Lösungen zu Blatt <span className="font-mono font-semibold">{sheet.sheetCode}</span>. Eine Seite pro Foto. Achte darauf,
        dass Blatt-Code und Aufgabennummern zu sehen sind.
      </p>
      <PhotoCapture
        moduleId={ctx.manifest.id}
        kind="worksheet"
        refId={sheet.id}
        maxSide={1600}
        nextHref={`${ctx.basePath}/blatt/${sheet.id}/pruefen?upload={uploadId}`}
      />
      <a href={`${ctx.basePath}/blatt/${sheet.id}`} className={buttonQuiet}>
        Zurück zum Arbeitsblatt
      </a>
    </div>
  );
}

const PHOTO_TIPS = "Tageslicht, senkrecht von oben, die ganze Seite im Bild, kein Schatten.";

const FLAG_TEXT: Record<ReadingFlag, string> = {
  unreadable: "Nicht lesbar: bitte vom Foto eintragen.",
  uncertain: "Unsicher gelesen: bitte mit dem Foto vergleichen.",
};

/** Screen 6 (spec A 5.6): "Habe ich dich richtig gelesen?". Reads the photo first if needed. */
export async function ConfirmPage({ ctx, sheet, upload }: { ctx: ModuleContext; sheet: Worksheet; upload: UploadSummary }) {
  if ((await resultsOfSheet(ctx, sheet.id)).length > 0) {
    return (
      <div className="space-y-6">
        <SheetHeader sheet={sheet} title="Habe ich dich richtig gelesen?" />
        <p>Dieses Blatt ist schon ausgewertet.</p>
        <a href={`${ctx.basePath}/blatt/${sheet.id}/ergebnis`} className={buttonPrimary}>
          Rückmeldung ansehen
        </a>
      </div>
    );
  }
  const hidden = (
    <>
      <input type="hidden" name="blatt" value={sheet.id} />
      <input type="hidden" name="upload" value={upload.id} />
    </>
  );
  const stored = await transcriptOf(ctx, upload.id);
  if (!stored) {
    return (
      <div className="space-y-6">
        <SheetHeader sheet={sheet} title="Ich lese deine Lösung" />
        <p>Das dauert ein paar Sekunden. Die KI schreibt nur ab, was auf deinem Foto steht. Sie bewertet nichts.</p>
        <WaitingForm action={ctx.action("lesen")} label="Lösung jetzt lesen" waiting="Ich lese deine Lösung …" auto>
          {hidden}
        </WaitingForm>
      </div>
    );
  }

  const transcription = stored.transcription;
  const pages = upload.imagesDeletedAt ? [] : ctx.uploads.pageUrls(upload.id, upload.pages);
  const checks = new Map(
    taskTexts(sheet).map((t) => [t.id, readingCheck(transcribedFor(transcription, t.id, t.number), getTask(t.id).levels[sheet.niveau]?.sought ?? [])]),
  );
  const flagged = [...checks.values()].reduce((n, c) => n + Object.keys(c.fields).length, 0);
  const regions = transcription?.unreadable_regions ?? [];
  const retake = (
    <a href={`${ctx.basePath}/blatt/${sheet.id}/foto`} className={buttonSecondary}>
      Neues Foto aufnehmen
    </a>
  );

  return (
    <div className="space-y-6">
      <SheetHeader sheet={sheet} title="Habe ich dich richtig gelesen?" />
      <p>Vergleiche mit deinem Foto und korrigiere, was nicht stimmt. Erst danach prüft das Programm deine Lösung.</p>
      {!transcription ? (
        <Note tone="warn" role="alert">
          <p>Ich konnte dein Foto gerade nicht lesen. Du kannst ein neues Foto aufnehmen oder deine Ergebnisse unten selbst eintragen.</p>
          <p className="text-sm">Tipps für das Foto: {PHOTO_TIPS}</p>
          {retake}
        </Note>
      ) : (
        needsNewPhoto(transcription) && (
          <Note tone="warn" role="alert">
            <p>Ich konnte dein Foto nicht sicher lesen. Mach am besten ein neues Foto.</p>
            <p className="text-sm">Tipps: {PHOTO_TIPS}</p>
            {retake}
            <p className="text-sm">Du kannst die Felder unten auch selbst ausfüllen.</p>
          </Note>
        )
      )}
      {transcription && (flagged > 0 || regions.length > 0) && (
        <Note tone="warn" role="status">
          {flagged > 0 && (
            <p data-testid="markiert">
              {flagged === 1 ? "Eine Stelle habe ich markiert" : `${flagged} Stellen habe ich markiert`}, weil ich unsicher bin. Vergleiche sie besonders genau
              mit deinem Foto.
            </p>
          )}
          {regions.length > 0 && <p className="text-sm">Nicht lesen konnte ich: {regions.join("; ")}</p>}
        </Note>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:sticky md:top-4 md:self-start">
          {pages.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt={`Dein Foto, Seite ${i + 1}`} className="w-full rounded-lg border border-line" />
          ))}
          {pages.length === 0 && <p className="text-sm text-muted">Die Fotos sind gelöscht.</p>}
        </div>
        <WaitingForm action={ctx.action("bestaetigen")} label="Stimmt so, jetzt prüfen" waiting="Ich prüfe deine Lösung …">
          {hidden}
          {taskTexts(sheet).map((t) => {
            const task = getTask(t.id);
            const params = sheet.params[t.id] ?? {};
            const read = transcribedFor(transcription, t.id, t.number);
            const sought = task.levels[sheet.niveau]?.sought ?? [];
            const check = checks.get(t.id);
            const yesNo = (name: string, legend: string, value: boolean) => (
              <fieldset className="flex flex-wrap items-center gap-3">
                <legend className="w-full text-sm font-medium">{legend}</legend>
                {(["ja", "nein"] as const).map((option) => (
                  <label key={option} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3">
                    <input type="radio" name={name} value={option} defaultChecked={(option === "ja") === value} className="h-5 w-5" />
                    {option}
                  </label>
                ))}
              </fieldset>
            );
            return (
              <fieldset key={t.id} className="space-y-3 rounded-2xl border border-line bg-card p-4">
                <legend className="px-1 font-semibold">Aufgabe {t.number}</legend>
                <p className="text-sm text-muted">{t.text}</p>
                {read && !read.found && <p className="text-sm text-bad">Diese Aufgabe habe ich auf dem Foto nicht gefunden.</p>}
                {check?.lowConfidence && <p className="text-sm font-medium">Diese Aufgabe konnte ich nur schwer lesen. Prüf alle Werte.</p>}
                {sought.map((q) => {
                  const answer = read?.final_answers.find((a) => a.quantity === q);
                  const unit = answer?.unit ?? "";
                  const flag = check?.fields[q];
                  const hintId = `hinweis-${t.id}-${q}`;
                  return (
                    <div key={q} data-flag={flag} className={`flex flex-wrap items-center gap-2 ${flag ? "rounded-lg border-l-4 border-hyp bg-note p-2" : ""}`}>
                      <span className="w-6 font-semibold">{q} =</span>
                      <input
                        name={`v.${t.id}.${q}`}
                        defaultValue={formatInput(answer?.value ?? null)}
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`Aufgabe ${t.number}: Wert für ${q}`}
                        aria-describedby={flag ? hintId : undefined}
                        className={`min-h-12 w-28 rounded-lg bg-paper px-3 text-lg ${flag ? "border-2 border-hyp" : "border border-line"}`}
                      />
                      <input
                        name={`u.${t.id}.${q}`}
                        defaultValue={unit}
                        autoComplete="off"
                        maxLength={12}
                        placeholder={unitOf(task, sheet.niveau, params, q) === "" ? "" : "Einheit"}
                        aria-label={`Aufgabe ${t.number}: Einheit für ${q}`}
                        className="min-h-12 w-24 rounded-lg border border-line bg-paper px-3"
                      />
                      {flag && (
                        <span id={hintId} className="w-full text-sm font-medium">
                          {FLAG_TEXT[flag]}
                        </span>
                      )}
                    </div>
                  );
                })}
                {yesNo(`skizze.${t.id}`, "Skizze vorhanden?", read?.sketch_present ?? false)}
                {yesNo(`satz.${t.id}`, "Antwortsatz vorhanden?", read?.answer_sentence_present ?? false)}
              </fieldset>
            );
          })}
        </WaitingForm>
      </div>
    </div>
  );
}

/** Screens 7 to 9 (spec A 5.7, 5.8): status, one hint, AI label, retry, solution, photo deletion. */
export async function ResultPage({ ctx, sheet }: { ctx: ModuleContext; sheet: Worksheet }) {
  const results = await resultsOfSheet(ctx, sheet.id);
  if (results.length === 0) {
    return (
      <div className="space-y-6">
        <SheetHeader sheet={sheet} title="Deine Rückmeldung" />
        <p>Für dieses Blatt gibt es noch keine Rückmeldung.</p>
        <a href={`${ctx.basePath}/blatt/${sheet.id}/foto`} className={buttonPrimary}>
          Foto hochladen
        </a>
      </div>
    );
  }
  const { paper } = lessonTasks(sheet.lesson);
  const effective = await effectiveResultsOf(ctx, await resultsOf(ctx, paper.map((t) => t.id)));
  const all = countedResults(effective);
  const passed = lessonPassed(paper, all);
  const effectiveOf = (resultId: string) => effective.find((e) => e.resultId === resultId);
  const texts = await feedbackTexts(ctx, results.flatMap((r) => (r.feedbackId ? [r.feedbackId] : [])));
  const uploadId = results[0]!.uploadId;
  const upload = await ctx.uploads.get(uploadId);
  const stored = await transcriptOf(ctx, uploadId);
  const confirmedRaw = stored ? await confirmedOf(ctx, stored.id) : [];
  const anyOpen = results.some((r) => {
    const e = effectiveOf(r.id);
    return !e || !e.counted || e.status !== "correct";
  });

  return (
    <div className="space-y-6">
      <SheetHeader sheet={sheet} title="Deine Rückmeldung" />
      {passed ? (
        <Note tone="ok" role="status">
          <p className="font-semibold">Lektion 4 geschafft!</p>
          <p>Du hast mindestens {PASS_TASKS} Papieraufgaben im ersten oder zweiten Versuch richtig gelöst.</p>
        </Note>
      ) : (
        <Note>
          <p>
            Lektion 4 ist geschafft, wenn {PASS_TASKS} von {paper.length} Papieraufgaben im ersten oder zweiten Versuch richtig sind. Keine Note,
            nur dein Weg.
          </p>
        </Note>
      )}
      <ol className="space-y-4">
        {sheet.taskIds.map((taskId, i) => {
          const result = results.find((r) => r.taskId === taskId);
          if (!result) return null;
          const task = getTask(taskId);
          const params = sheet.params[taskId] ?? {};
          const verification = result.verification as VerificationResult;
          const ai = result.feedbackId ? texts.get(result.feedbackId) : undefined;
          const confirmed = confirmedRaw.find((c) => c.task_id === taskId);
          const corrected = effectiveOf(result.id);
          const codes = corrected?.codes ?? (result.misconceptionCodes as MisconceptionCode[]);
          const mine = (confirmed?.final_answers ?? []).map(
            (a) => `${a.quantity} = ${withUnit(a.value === null ? "?" : formatGiven(a.value), a.unit ?? "")}`,
          );
          return (
            <li key={taskId}>
              <article aria-label={`Aufgabe ${i + 1}`} data-testid={`ergebnis-${i + 1}`} className="space-y-3 rounded-2xl border border-line bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Aufgabe {i + 1}</h2>
                  <StatusBadge status={statusLabel(corrected?.status ?? result.status)} />
                </div>
                {corrected?.override && <TeacherCorrection result={corrected} />}
                <p className="text-sm text-muted">{renderText(task.levels[sheet.niveau]?.text ?? "", textVariables(task, sheet.niveau, params))}</p>
                {mine.length > 0 && <p>Dein Ergebnis: {mine.join("; ")}</p>}
                {codes.length > 0 && (
                  <p className="text-sm">
                    Erkannt: {codes.map((c) => MISCONCEPTIONS[c].label).join(", ")}
                  </p>
                )}
                {corrected?.override && <p className="text-sm text-muted">Die Rückmeldung unten bezieht sich auf das Ergebnis vor der Korrektur.</p>}
                {ai ? (
                  <div className="space-y-1 rounded-xl border border-dashed border-accent bg-accent-soft p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">KI-Rückmeldung</p>
                    <p className="font-semibold">{ai.headline}</p>
                    <p>{ai.hint}</p>
                    {ai.praise && <p>{ai.praise}</p>}
                    <AiNotice />
                  </div>
                ) : (
                  <div className="space-y-1 rounded-xl border border-line bg-paper p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Hinweis</p>
                    <p>{catalogHint(verification)}</p>
                  </div>
                )}
                {solutionAvailable(all, taskId) && (
                  <form action={ctx.action("loesung")}>
                    <input type="hidden" name="blatt" value={sheet.id} />
                    <input type="hidden" name="task" value={taskId} />
                    <button type="submit" className={buttonQuiet}>
                      Lösungsweg ansehen
                    </button>
                  </form>
                )}
              </article>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-3">
        {anyOpen && (
          <form action={ctx.action("neu")}>
            <button type="submit" className={buttonPrimary}>
              Nochmal mit neuen Zahlen
            </button>
          </form>
        )}
        <a href={ctx.basePath} className={buttonSecondary}>
          Zur Übersicht
        </a>
      </div>
      <Card label="Deine Fotos">
        <h2 className="font-semibold">Deine Fotos</h2>
        {!upload || upload.imagesDeletedAt ? (
          <p role="status">Die Fotos zu diesem Blatt sind gelöscht. Was die App gelesen hat, bleibt erhalten.</p>
        ) : (
          <>
            <p className="text-sm text-muted">Fotos werden nach 14 Tagen automatisch gelöscht. Du kannst sie jetzt schon löschen.</p>
            <form action={ctx.action("fotos_loeschen")}>
              <input type="hidden" name="blatt" value={sheet.id} />
              <input type="hidden" name="upload" value={uploadId} />
              <button type="submit" className={`${buttonQuiet} text-bad`}>
                Fotos jetzt löschen
              </button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}

/** A correction by the teacher (D-031), always with its reason. */
function TeacherCorrection({ result }: { result: EffectiveResult }) {
  const override = result.override;
  if (!override) return null;
  return (
    <Note tone="info" role="status">
      {override.kind === "void" ? (
        <p>Deine Lehrkraft hat entschieden: Dieser Versuch zählt nicht. Du hast dafür einen weiteren Versuch.</p>
      ) : (
        <p>
          Deine Lehrkraft hat das Ergebnis geändert: vorher „{statusLabel(result.originalStatus)}“, jetzt „{statusLabel(result.status)}“.
        </p>
      )}
      <p className="text-sm">Begründung: {override.reason}</p>
    </Note>
  );
}

/** Full solution, only after the second failed attempt and only once its viewing is logged (spec A 2.3). */
export function SolutionPage({ ctx, sheet, taskId }: { ctx: ModuleContext; sheet: Worksheet; taskId: string }) {
  const task = getTask(taskId);
  const def = task.levels[sheet.niveau];
  if (!def) return null;
  const vars = textVariables(task, sheet.niveau, sheet.params[taskId] ?? {});
  const number = sheet.taskIds.indexOf(taskId) + 1;
  return (
    <div className="space-y-6">
      <SheetHeader sheet={sheet} title={`Lösungsweg zu Aufgabe ${number}`} />
      <Card label="Aufgabe">
        <p className="font-medium">{renderText(def.text, vars)}</p>
        <Steps steps={def.steps.map((s) => renderText(s, vars))} />
        {def.extra && <p className="text-sm text-muted">Zusatz: {renderText(def.extra, vars)}</p>}
      </Card>
      <p className="text-sm text-muted">Diese Aufgabe zählt als bearbeitet. Mit neuen Zahlen kannst du sie jederzeit noch einmal rechnen.</p>
      <a href={`${ctx.basePath}/blatt/${sheet.id}/ergebnis`} className={buttonSecondary}>
        Zurück zur Rückmeldung
      </a>
    </div>
  );
}
