import Link from "next/link";
import { redirect } from "next/navigation";
import { modulesFor } from "@/lib/modules.ts";
import { currentLearner } from "@/lib/session.ts";
import { leave } from "../actions.ts";

export default async function Module() {
  const session = await currentLearner();
  if (!session) redirect("/");
  const modules = modulesFor(session.group);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Angemeldet als</p>
          <p className="font-semibold">{session.learner.pseudonym}</p>
        </div>
        <form action={leave}>
          <button type="submit" className="min-h-11 rounded-lg border border-line px-4">
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
              <Link href={`/m/${m.id}`} className="block rounded-lg border border-line p-4 hover:border-accent min-h-11">
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
