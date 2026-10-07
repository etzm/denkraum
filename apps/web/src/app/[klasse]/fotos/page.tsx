import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, schema } from "@denkraum/db";
import { slugForKlasse } from "@/lib/classes.ts";
import { getDb } from "@/lib/db.ts";
import { findModule } from "@/lib/modules.ts";
import { currentLearner } from "@/lib/session.ts";
import { deletePhotos } from "../../actions.ts";

const date = (d: Date) => d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });

/** Transparency and erasure: every photo of this learner, when it will be deleted, and a delete button. */
export default async function MeineFotos({
  params,
  searchParams,
}: {
  params: Promise<{ klasse: string }>;
  searchParams: Promise<{ geloescht?: string }>;
}) {
  const { klasse } = await params;
  const session = await currentLearner();
  if (!session) redirect(`/${klasse}`);
  if (slugForKlasse(session.group.klasse) !== klasse) redirect(`/${slugForKlasse(session.group.klasse)}/fotos`);
  const db = await getDb();
  const uploads = await db.select().from(schema.uploads).where(eq(schema.uploads.learnerId, session.learner.id)).orderBy(desc(schema.uploads.createdAt));
  const withPhotos = uploads.filter((u) => !u.imagesDeletedAt && u.storageKeys.length > 0);
  const { geloescht } = await searchParams;

  return (
    <div className="space-y-6">
      <Link href={`/${klasse}`} className="text-sm underline underline-offset-4 min-h-11 inline-flex items-center">
        Zurück
      </Link>
      <h1 className="text-2xl font-semibold">Meine Fotos</h1>
      <p className="text-muted">
        Fotos werden nach 14 Tagen automatisch gelöscht. Du kannst sie auch sofort löschen. Was die App aus deinen Fotos gelesen hat,
        bleibt erhalten.
      </p>
      {geloescht && (
        <p role="status" className="rounded-xl border border-line bg-card p-3 text-ok">
          Die Fotos sind gelöscht.
        </p>
      )}
      {withPhotos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-5 text-muted">Hier sind gerade keine Fotos gespeichert.</p>
      ) : (
        <ul className="space-y-4">
          {withPhotos.map((u) => (
            <li key={u.id} className="rounded-2xl border border-line bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{findModule(u.moduleId)?.title ?? u.moduleId}</p>
                <p className="text-sm text-muted">
                  hochgeladen am {date(u.createdAt)}, gelöscht spätestens am {date(u.imagesDeleteAfter)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {u.storageKeys.map((_, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={`/api/uploads/${u.id}/pages/${i + 1}`} alt={`Seite ${i + 1}`} className="w-full rounded-lg border border-line" />
                ))}
              </div>
              <form action={deletePhotos}>
                <input type="hidden" name="upload" value={u.id} />
                <button type="submit" className="min-h-11 rounded-lg border border-line px-4 text-bad">
                  Fotos jetzt löschen
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
