import Link from "next/link";
import { redirect } from "next/navigation";
import { classBySlug, slugForKlasse } from "@/lib/classes.ts";
import { modulesFor } from "@/lib/modules.ts";
import { currentLearner } from "@/lib/session.ts";
import { enter, leave } from "../actions.ts";

const ERRORS: Record<string, string> = {
  format: "Der Code hat 8 Zeichen, zum Beispiel K7QM-X2PA. Prüf bitte, ob du dich vertippt hast.",
  unknown: "Diesen Code kennen wir nicht. Frag bitte deine Lehrkraft.",
  ended: "Diese Gruppe ist beendet. Frag bitte deine Lehrkraft.",
};

export default async function Klasse({
  params,
  searchParams,
}: {
  params: Promise<{ klasse: string }>;
  searchParams: Promise<{ fehler?: string }>;
}) {
  const { klasse } = await params;
  const entry = classBySlug(klasse)!;
  const session = await currentLearner();

  if (session) {
    const own = slugForKlasse(session.group.klasse);
    if (own !== klasse) redirect(`/${own}`);
    const modules = modulesFor(session.group);
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Angemeldet als</p>
            <p className="font-semibold">{session.learner.pseudonym}</p>
          </div>
          <form action={leave}>
            <input type="hidden" name="klasse" value={klasse} />
            <button type="submit" className="min-h-11 rounded-lg border border-line bg-card px-4">
              Abmelden
            </button>
          </form>
        </header>
        <h1 className="text-2xl font-semibold">Deine Module</h1>
        {modules.length === 0 ? (
          <p className="text-muted">Für deine Klasse gibt es noch kein Modul.</p>
        ) : (
          <ul className="space-y-3">
            {modules.map((m) => (
              <li key={m.id}>
                <Link href={`/${klasse}/m/${m.id}`} className="block rounded-xl border border-line bg-card p-4 hover:border-accent min-h-11">
                  <span className="block font-semibold">{m.title}</span>
                  <span className="text-sm text-muted">
                    {m.fach}, Klasse {m.klasse}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const { fehler } = await searchParams;
  const error = fehler ? ERRORS[fehler] : undefined;
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {entry.fach}: {entry.thema}
        </h1>
        <p className="text-muted">{entry.note}</p>
      </header>
      {entry.open ? (
        <form action={enter} className="space-y-3 rounded-2xl border border-line bg-card p-5">
          <input type="hidden" name="klasse" value={klasse} />
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
            className="w-full min-h-12 rounded-lg border border-line bg-paper px-4 text-lg tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal"
          />
          {error ? (
            <p id="code-fehler" role="alert" className="text-bad">
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
      ) : (
        <p className="rounded-2xl border border-line bg-card p-5 text-muted">Hier geht es bald los.</p>
      )}
    </div>
  );
}
