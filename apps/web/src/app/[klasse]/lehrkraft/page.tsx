import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canonicalSlug, slugForKlasse } from "@/lib/classes.ts";
import { findDefinition, modulesFor } from "@/lib/modules.ts";
import { getDb } from "@/lib/db.ts";
import { currentViewer } from "@/lib/session.ts";
import { asc, eq, schema } from "@denkraum/db";
import { leave } from "../../actions.ts";

/** Start page of the teacher view (DECISIONS.md D-017, D-030): the group, its pseudonyms and the modules. */
export default async function Lehrkraft({ params }: { params: Promise<{ klasse: string }> }) {
  const { klasse } = await params;
  if (!canonicalSlug(klasse)) notFound();
  const session = await currentViewer();
  if (!session) redirect(`/${klasse}`);
  const own = slugForKlasse(session.group.klasse);
  if (own !== klasse) redirect(`/${own}/lehrkraft`);

  const learners = await (await getDb())
    .select({ pseudonym: schema.learners.pseudonym })
    .from(schema.learners)
    .where(eq(schema.learners.groupId, session.group.id))
    .orderBy(asc(schema.learners.pseudonym));
  const modules = modulesFor(session.group);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Lehrkraft</p>
          <h1 className="text-2xl font-semibold">{session.group.label}</h1>
        </div>
        <form action={leave}>
          <input type="hidden" name="klasse" value={klasse} />
          <button type="submit" className="min-h-11 rounded-lg border border-line bg-card px-4">
            Abmelden
          </button>
        </form>
      </header>

      <section aria-label="Module" className="space-y-3">
        <h2 className="text-lg font-semibold">Module</h2>
        {modules.length === 0 ? (
          <p className="text-muted">Für diese Klasse gibt es noch kein Modul.</p>
        ) : (
          <ul className="space-y-3">
            {modules.map((m) =>
              findDefinition(m.id)?.teacher ? (
                <li key={m.id}>
                  <Link href={`/${klasse}/lehrkraft/m/${m.id}`} className="block min-h-11 rounded-xl border border-line bg-card p-4 hover:border-accent">
                    <span className="block font-semibold">{m.title}</span>
                    <span className="text-sm text-muted">Fehlerbild der Klasse und Ergebnisse je Schülerin oder Schüler</span>
                  </Link>
                </li>
              ) : (
                <li key={m.id} className="rounded-xl border border-line bg-card p-4">
                  <span className="block font-semibold">{m.title}</span>
                  <span className="text-sm text-muted">Für dieses Modul gibt es noch keine Ansicht für Lehrkräfte.</span>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section aria-label="Schülerinnen und Schüler" className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-lg font-semibold">Schülerinnen und Schüler ({learners.length})</h2>
        <p>
          Code für die Klasse: <span className="font-mono font-semibold">{session.group.joinCode}</span>
        </p>
        <p className="text-sm text-muted">
          Jedes Kind bekommt beim ersten Anmelden mit diesem Code ein Pseudonym. Sie sehen nur Pseudonyme; die Zuordnung zu Namen führen Sie außerhalb der App.
        </p>
        {learners.length === 0 ? (
          <p>Noch hat sich niemand angemeldet.</p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {learners.map((l) => (
              <li key={l.pseudonym}>{l.pseudonym}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
