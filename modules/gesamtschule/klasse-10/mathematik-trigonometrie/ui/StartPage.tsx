import { NIVEAUS } from "@denkraum/core";
import type { ModuleContext } from "@denkraum/sdk";
import { fadedState, lessonPassed, lessonTasks, OPEN_LESSONS } from "../domain/lesson.ts";
import { countedResults } from "../domain/overrides.ts";
import { checksOf, effectiveResultsOf, resultsOf, worksheetsOf } from "../server/store.ts";
import { buttonPrimary, Card, NIVEAU_TEXT } from "./common.tsx";

const LESSONS = [
  { n: 1, title: "Ähnliche Dreiecke" },
  { n: 2, title: "Bezeichnungen im rechtwinkligen Dreieck" },
  { n: 3, title: "Sinus, Kosinus und Tangens" },
  { n: 4, title: "Seitenlängen berechnen" },
  { n: 5, title: "Winkel berechnen" },
  { n: 6, title: "Anwendungen" },
  { n: 7, title: "Trigonometrische Beziehungen", onlyE: true },
] as const;

/** Screen 1 (spec A 5.1): choose the level, see the lessons and the progress of lesson 4. */
export async function StartPage({ ctx }: { ctx: ModuleContext }) {
  const niveau = ctx.learner.niveau;
  const { faded, paper } = lessonTasks(4);
  const [checks, results, sheets] = await Promise.all([
    checksOf(ctx, faded.map((t) => t.id)),
    resultsOf(ctx, paper.map((t) => t.id)),
    worksheetsOf(ctx, 4),
  ]);
  const counted = countedResults(await effectiveResultsOf(ctx, results));
  const fadedDone = faded.filter((t) => fadedState(checks.filter((c) => c.taskId === t.id)).done).length;
  const paperRight = paper.filter((t) => counted.some((r) => r.taskId === t.id && r.status === "correct")).length;
  const passed = lessonPassed(paper, counted);
  const latest = sheets[0];
  const latestEvaluated = latest ? results.some((r) => r.worksheetId === latest.id) : false;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Trigonometrie-Einstieg</h1>
        <p className="text-muted">
          Seiten und Winkel im rechtwinkligen Dreieck mit Sinus, Kosinus und Tangens. Du lernst hier am iPad und rechnest auf Papier.
        </p>
      </header>

      <Card label="Dein Niveau">
        <h2 className="text-lg font-semibold">Dein Niveau</h2>
        <p className="text-muted">
          {niveau ? (
            <>
              Du arbeitest auf <strong className="text-ink">Niveau {niveau}</strong>. Du kannst es jederzeit wechseln.
            </>
          ) : (
            "Wähle, auf welchem Niveau du arbeiten möchtest. Du kannst es später wechseln."
          )}
        </p>
        <form action={ctx.action("niveau")} className="grid gap-3 sm:grid-cols-3">
          {NIVEAUS.map((n) => (
            <button
              key={n}
              type="submit"
              name="niveau"
              value={n}
              aria-pressed={niveau === n}
              className={`min-h-16 rounded-xl border-2 p-3 text-left ${niveau === n ? "border-accent bg-accent-soft" : "border-line bg-paper hover:border-accent"}`}
            >
              <span className="block font-semibold">{NIVEAU_TEXT[n].title}</span>
              <span className="block text-sm text-muted">{NIVEAU_TEXT[n].text}</span>
            </button>
          ))}
        </form>
      </Card>

      <Card label="Deine Lektionen">
        <h2 className="text-lg font-semibold">Deine Lektionen</h2>
        <ol className="space-y-2">
          {LESSONS.map((lesson) => {
            const open = OPEN_LESSONS.includes(lesson.n);
            const status = lesson.n === 4 && passed ? "geschafft" : open ? "offen" : "kommt bald";
            const body = (
              <>
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    Lektion {lesson.n}: {lesson.title}
                    {"onlyE" in lesson ? " (nur E)" : ""}
                  </span>
                  <span className={`text-sm ${status === "geschafft" ? "font-semibold text-ok" : "text-muted"}`}>{status}</span>
                </span>
                {lesson.n === 4 && niveau && (
                  <span className="mt-1 block text-sm text-muted">
                    Lückenaufgaben {fadedDone} von {faded.length} erledigt, Papieraufgaben {paperRight} von {paper.length} richtig
                  </span>
                )}
              </>
            );
            return (
              <li key={lesson.n}>
                {open && niveau ? (
                  <a href={`${ctx.basePath}/lektion/${lesson.n}`} className="block min-h-11 rounded-xl border border-line bg-paper p-3 hover:border-accent">
                    {body}
                  </a>
                ) : (
                  <div className="min-h-11 rounded-xl border border-dashed border-line p-3 opacity-80">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
        {!niveau && <p className="text-sm text-muted">Wähle zuerst dein Niveau, dann geht es mit Lektion 4 los.</p>}
        {niveau && latest && (
          <a href={`${ctx.basePath}/blatt/${latest.id}${latestEvaluated ? "/ergebnis" : ""}`} className={buttonPrimary}>
            {latestEvaluated ? "Letzte Rückmeldung ansehen" : "Zum offenen Arbeitsblatt"}
          </a>
        )}
      </Card>
    </div>
  );
}
