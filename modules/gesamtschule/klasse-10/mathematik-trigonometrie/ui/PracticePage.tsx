import type { Niveau } from "@denkraum/core";
import type { ModuleContext } from "@denkraum/sdk";
import { renderText, textVariables } from "../domain/format.ts";
import { checkFaded, FADED_HELP_AFTER, fadedParams, fadedState, hiddenSteps, lessonTasks, worksheetUnlocked } from "../domain/lesson.ts";
import type { Task } from "../domain/schema.ts";
import { checksOf, type Check } from "../server/store.ts";
import { buttonPrimary, Card, Note, Steps } from "./common.tsx";

/** "Umstellen: b = c · sin β" -> ["Umstellen", "b = c · sin β"]. */
function splitLabel(step: string): [string | null, string] {
  const match = /^([A-ZÄÖÜ][a-zäöüß]+): (.*)$/.exec(step);
  return match ? [match[1]!, match[2]!] : [null, step];
}

function FadedTask({ ctx, task, level, number, checks }: { ctx: ModuleContext; task: Task; level: Niveau; number: number; checks: Check[] }) {
  const def = task.levels[level];
  if (!def) return null;
  const vars = textVariables(task, level, fadedParams(task));
  const state = fadedState(checks);
  const last = checks.at(-1);
  const hidden = hiddenSteps(task, level);
  const hiddenIndex = new Set(hidden.map((h) => h.index));
  // After a wrong attempt the answers stay in the form and the wrong steps are marked (checked again by code).
  const previous = last && !last.correct && last.niveau === level ? last.answers : {};
  const wrongSteps = new Set(
    last && !last.correct && last.niveau === level ? checkFaded(task, level, last.answers, 0).steps.filter((s) => !s.correct).map((s) => s.index) : [],
  );
  const allSteps = def.steps.map((s) => renderText(s, vars));

  return (
    <Card label={`Lückenaufgabe ${number}`}>
      <div id={task.id} className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Lückenaufgabe {number}</h2>
        {state.solved && <span className="font-semibold text-ok">richtig</span>}
        {state.withHelp && <span className="font-semibold text-muted">mit Hilfe</span>}
      </div>
      <p className="font-medium">{renderText(def.text, vars)}</p>

      {state.done ? (
        <>
          <Note tone={state.solved ? "ok" : "info"} role="status">
            <p>{state.solved ? "Richtig! So sieht der ganze Lösungsweg aus:" : "Hier ist der vollständige Lösungsweg. Schau ihn dir in Ruhe an."}</p>
          </Note>
          <Steps steps={allSteps} />
        </>
      ) : (
        <form action={ctx.action("luecke")} className="space-y-4">
          <input type="hidden" name="task" value={task.id} />
          <ol className="list-decimal space-y-3 pl-6">
            {def.steps.map((step, index) => {
              if (!hiddenIndex.has(index)) return <li key={index}>{renderText(step, vars)}</li>;
              const blank = hidden.find((h) => h.index === index)!;
              if (blank.kind === "choice") {
                const [label] = splitLabel(blank.correct);
                return (
                  <li key={index}>
                    <fieldset className={`space-y-2 rounded-xl border p-3 ${wrongSteps.has(index) ? "border-2 border-bad" : "border-line"}`}>
                      <legend className="px-1 font-medium">{label ?? `Schritt ${index + 1}`}: Wähle aus.</legend>
                      {wrongSteps.has(index) && <p className="text-sm text-bad">Dieser Schritt stimmt noch nicht.</p>}
                      {blank.options.map((option) => (
                        <label key={option} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-accent-soft">
                          <input type="radio" name={`s${index}`} value={option} defaultChecked={previous[String(index)] === option} required className="h-5 w-5" />
                          <span>{renderText(splitLabel(option)[1], vars)}</span>
                        </label>
                      ))}
                    </fieldset>
                  </li>
                );
              }
              return (
                <li key={index}>
                  <label className="flex flex-wrap items-center gap-2">
                    <span>{renderText(blank.before, vars)}</span>
                    <input
                      name={`s${index}`}
                      inputMode="decimal"
                      autoComplete="off"
                      required
                      defaultValue={previous[String(index)] ?? ""}
                      aria-label={`Lückenaufgabe ${number}: Ergebnis für ${blank.quantity}`}
                      aria-invalid={wrongSteps.has(index) || undefined}
                      className={`min-h-12 w-28 rounded-lg bg-paper px-3 text-lg ${wrongSteps.has(index) ? "border-2 border-bad" : "border border-line"}`}
                    />
                    <span>{renderText(blank.after, vars)}</span>
                  </label>
                  {wrongSteps.has(index) && <p className="text-sm text-bad">Dieser Wert stimmt noch nicht.</p>}
                </li>
              );
            })}
          </ol>
          {last && !last.correct && (
            <Note tone="warn" role="status">
              <p className="font-semibold">Noch nicht richtig.</p>
              {last.hint && <p>Tipp: {last.hint}</p>}
              <p className="text-sm text-muted">
                Fehlversuche: {state.wrong} von {FADED_HELP_AFTER}. Danach zeige ich dir den Lösungsweg.
              </p>
            </Note>
          )}
          <button type="submit" className={buttonPrimary}>
            Prüfen
          </button>
        </form>
      )}
    </Card>
  );
}

/** Screen 3 (spec A 5.3): two faded tasks; the worksheet opens when both are done. */
export async function PracticePage({ ctx, level }: { ctx: ModuleContext; level: Niveau }) {
  const { faded } = lessonTasks(4);
  const checks = await checksOf(ctx, faded.map((t) => t.id));
  const states = faded.map((t) => fadedState(checks.filter((c) => c.taskId === t.id)));
  const unlock = worksheetUnlocked(states);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted">Lektion 4 · Niveau {level}</p>
        <h1 className="text-2xl font-semibold">Lückenaufgaben</h1>
        <p>Ergänze die fehlenden Schritte. Ergebnisse gibst du mit Komma ein, zum Beispiel 7,66.</p>
      </header>
      {faded.map((task, i) => (
        <FadedTask key={task.id} ctx={ctx} task={task} level={level} number={i + 1} checks={checks.filter((c) => c.taskId === task.id)} />
      ))}
      <Card label="Arbeitsblatt">
        <h2 className="text-lg font-semibold">Arbeitsblatt</h2>
        {unlock.open ? (
          <>
            <p>
              {unlock.withHelp
                ? "Du hast die Lückenaufgaben mit Hilfe geschafft. Weiter geht es mit dem Arbeitsblatt."
                : "Beide Lückenaufgaben sind richtig. Weiter geht es mit dem Arbeitsblatt."}
            </p>
            <form action={ctx.action("blatt_oeffnen")}>
              <button type="submit" className={buttonPrimary}>
                Arbeitsblatt öffnen
              </button>
            </form>
          </>
        ) : (
          <p className="text-muted">Löse zuerst beide Lückenaufgaben. Danach öffnet sich dein Arbeitsblatt.</p>
        )}
      </Card>
    </div>
  );
}
