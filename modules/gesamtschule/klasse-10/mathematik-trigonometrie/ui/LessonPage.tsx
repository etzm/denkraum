import type { Niveau } from "@denkraum/core";
import type { ModuleContext } from "@denkraum/sdk";
import { renderText, textVariables } from "../domain/format.ts";
import { lessonTasks } from "../domain/lesson.ts";
import { drawParameters } from "../domain/generator.ts";
import { buttonPrimary, Card, Note, Steps } from "./common.tsx";
import { StepReveal } from "./client.tsx";
import { TriangleExplorer } from "./TriangleExplorer.tsx";

const CALCULATOR: Record<string, { tone: "ok" | "warn"; text: string }> = {
  deg: { tone: "ok", text: "Richtig: sin 30° = 0,5. Dein Rechner steht auf DEG." },
  rad: {
    tone: "warn",
    text: "Dein Rechner zeigt ungefähr −0,988. Er steht auf RAD (Bogenmaß). Stell ihn auf DEG um und prüfe noch einmal.",
  },
  grad: {
    tone: "warn",
    text: "Dein Rechner zeigt ungefähr 0,454. Er steht auf GRAD (Neugrad). Stell ihn auf DEG um und prüfe noch einmal.",
  },
  other: { tone: "warn", text: "Das passt nicht zu sin 30°. Tippe genau sin 30 ein und schau, ob im Display DEG oder D steht." },
  leer: { tone: "warn", text: "Gib die Zahl ein, die dein Rechner zeigt, zum Beispiel 0,5." },
};

function procedure(level: Niveau): string[] {
  const steps = [
    "Skizze zeichnen: rechtwinkliges Dreieck, gegebene und gesuchte Größen markieren.",
    "Seiten benennen, und zwar vom gegebenen Winkel aus: Hypotenuse, Gegenkathete, Ankathete.",
    "Passendes Verhältnis wählen: das, in dem die gegebene und die gesuchte Seite vorkommen.",
    "Gleichung aufstellen und nach der gesuchten Seite umstellen.",
    "Berechnen und erst am Ende runden, auf 2 Nachkommastellen.",
    "Antwortsatz mit Einheit schreiben.",
  ];
  if (level !== "G") steps.push("Kontrolle mit dem Satz des Pythagoras: a² + b² ≈ c².");
  return steps;
}

/** Screen 2 (spec A 5.2): explanation, interactive triangle, calculator check, worked example. */
export function LessonPage({ ctx, level, search }: { ctx: ModuleContext; level: Niveau; search: Record<string, string | undefined> }) {
  const { worked, faded } = lessonTasks(4);
  const example = worked?.levels[level];
  const vars = worked ? textVariables(worked, level, drawParameters(worked, "beispiel", 0)) : {};
  const calculator = search.rechner && Object.hasOwn(CALCULATOR, search.rechner) ? CALCULATOR[search.rechner] : undefined;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted">Lektion 4 · Niveau {level}</p>
        <h1 className="text-2xl font-semibold">Seitenlängen berechnen</h1>
        <p>
          Du kennst in einem rechtwinkligen Dreieck einen Winkel und eine Seite. Damit kannst du jede andere Seite berechnen. Der Trick: Du
          wählst das Seitenverhältnis, in dem genau die gegebene und die gesuchte Seite vorkommen.
        </p>
      </header>

      <Card label="Welche Seite ist welche?">
        <h2 className="text-lg font-semibold">1. Welche Seite ist welche?</h2>
        <p>
          Gegenkathete und Ankathete hängen davon ab, von welchem Winkel aus du schaust. Tippe auf α oder β und sieh, wie sich die Namen
          ändern. Die Hypotenuse bleibt immer gleich.
        </p>
        <TriangleExplorer />
      </Card>

      <Card label="Die Verhältnisse">
        <h2 className="text-lg font-semibold">2. Die Verhältnisse</h2>
        <ul className="space-y-1">
          <li>
            <strong>sin α</strong> = <span className="text-gk">Gegenkathete</span> : <span className="text-hyp">Hypotenuse</span>
          </li>
          {level !== "G" && (
            <li>
              <strong>cos α</strong> = <span className="text-ak">Ankathete</span> : <span className="text-hyp">Hypotenuse</span>
            </li>
          )}
          <li>
            <strong>tan α</strong> = <span className="text-gk">Gegenkathete</span> : <span className="text-ak">Ankathete</span>
          </li>
        </ul>
        <p className="text-sm text-muted">
          {level === "G"
            ? "Merkhilfe: Sinus ist Gegenkathete durch Hypotenuse, Tangens ist Gegenkathete durch Ankathete. Es gibt noch den Kosinus, den brauchst du hier nicht."
            : "Merkhilfe: GAGA HühnerHof AG. Sinus: G durch H, Kosinus: A durch H, Tangens: G durch A."}
        </p>
        <h3 className="font-semibold">So gehst du vor</h3>
        <Steps steps={procedure(level)} />
      </Card>

      <Card label="Taschenrechner-Check">
        <h2 id="rechner" className="text-lg font-semibold">
          3. Taschenrechner-Check
        </h2>
        <p>Steht dein Rechner auf DEG? Tippe sin 30 ein. Was zeigt er?</p>
        <form action={ctx.action("rechner")} className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-sm font-medium">sin 30° =</span>
            <input
              name="wert"
              inputMode="decimal"
              autoComplete="off"
              aria-label="Was zeigt dein Rechner für sin 30°?"
              className="min-h-12 w-36 rounded-lg border border-line bg-paper px-3 text-lg"
            />
          </label>
          <button type="submit" className="min-h-12 rounded-lg border-2 border-accent px-5 font-semibold text-accent">
            Prüfen
          </button>
        </form>
        {calculator && (
          <Note tone={calculator.tone} role="status">
            <p>{calculator.text}</p>
          </Note>
        )}
      </Card>

      {worked && example && (
        <Card label="Beispiel">
          <h2 className="text-lg font-semibold">4. Ein Beispiel, Schritt für Schritt</h2>
          <p className="font-medium">{renderText(example.text, vars)}</p>
          <StepReveal steps={example.steps.map((s) => renderText(s, vars))} />
          {example.extra && <p className="text-sm text-muted">{renderText(example.extra, vars)}</p>}
        </Card>
      )}

      <Card label="Jetzt du">
        <h2 className="text-lg font-semibold">5. Jetzt du</h2>
        <p>
          Zuerst {faded.length} Lückenaufgaben hier am iPad. Danach bekommst du ein Arbeitsblatt mit deinen eigenen Zahlen und rechnest auf
          Papier.
        </p>
        <a href={`${ctx.basePath}/lektion/4/uebung`} className={buttonPrimary}>
          Zu den Lückenaufgaben
        </a>
      </Card>
    </div>
  );
}

