import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { slugForKlasse } from "@/lib/classes.ts";
import { findDefinition } from "@/lib/modules.ts";
import { buildModuleContext } from "@/lib/runtime.ts";
import { currentLearner } from "@/lib/session.ts";

export default async function ModulSeite({
  params,
  searchParams,
}: {
  params: Promise<{ klasse: string; modulId: string; pfad?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { klasse, modulId, pfad = [] } = await params;
  const session = await currentLearner();
  if (!session) redirect(`/${klasse}`);
  if (slugForKlasse(session.group.klasse) !== klasse) redirect(`/${slugForKlasse(session.group.klasse)}`);
  const definition = findDefinition(modulId);
  const manifest = definition?.manifest;
  if (!definition || !manifest || manifest.schulart !== session.group.schulart || manifest.klasse !== session.group.klasse) notFound();

  const raw = await searchParams;
  const search = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const ctx = await buildModuleContext(definition, session);
  const content = await definition.render(ctx, pfad, search);
  if (content === null) notFound();

  return (
    <div className="space-y-6">
      <Link href={pfad.length > 0 ? ctx.basePath : `/${klasse}`} className="text-sm underline underline-offset-4 min-h-11 inline-flex items-center">
        {pfad.length > 0 ? manifest.title : "Alle Module"}
      </Link>
      {content}
    </div>
  );
}
