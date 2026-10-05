import { redirect } from "next/navigation";
import { currentLearner } from "@/lib/session.ts";
import { enter } from "./actions.ts";

const ERRORS: Record<string, string> = {
  format: "Der Code hat 8 Zeichen, zum Beispiel K7QM-X2PA. Prüf bitte, ob du dich vertippt hast.",
  unknown: "Diesen Code kennen wir nicht. Frag bitte deine Lehrkraft.",
  ended: "Diese Gruppe ist beendet. Frag bitte deine Lehrkraft.",
};

export default async function Start({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  if (await currentLearner()) redirect("/m");
  const { fehler } = await searchParams;
  const error = fehler ? ERRORS[fehler] : undefined;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Denkraum</h1>
        <p className="text-muted">Du arbeitest auf Papier, fotografierst deine Lösung und bekommst eine Rückmeldung.</p>
      </header>

      <form action={enter} className="space-y-3">
        <label htmlFor="code" className="block font-medium">
          Dein Code
        </label>
        <input
          id="code"
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="z. B. K7QM-X2PA"
          aria-describedby={error ? "code-fehler" : "code-hilfe"}
          className="w-full min-h-12 rounded-lg border border-line bg-transparent px-4 text-lg tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal"
        />
        {error ? (
          <p id="code-fehler" role="alert" className="text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : (
          <p id="code-hilfe" className="text-sm text-muted">
            Den Code bekommst du von deiner Lehrkraft. Du brauchst keinen Namen und keine E-Mail.
          </p>
        )}
        <button type="submit" className="min-h-12 w-full rounded-lg bg-accent px-6 font-semibold text-paper hover:bg-accent-strong">
          Los geht&apos;s
        </button>
      </form>
    </div>
  );
}
