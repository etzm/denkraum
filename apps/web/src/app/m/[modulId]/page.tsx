import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { findModule } from "@/lib/modules.ts";
import { currentLearner } from "@/lib/session.ts";

export default async function ModulStart({ params }: { params: Promise<{ modulId: string }> }) {
  const session = await currentLearner();
  if (!session) redirect("/");
  const { modulId } = await params;
  const manifest = findModule(modulId);
  if (!manifest || manifest.schulart !== session.group.schulart || manifest.klasse !== session.group.klasse) notFound();

  return (
    <div className="space-y-6">
      <Link href="/m" className="text-sm underline underline-offset-4">
        Zurück
      </Link>
      <h1 className="text-2xl font-semibold">{manifest.title}</h1>
      <p className="text-muted">
        {manifest.fach}, Klasse {manifest.klasse}. Dieses Modul ist noch in Entwicklung.
      </p>
    </div>
  );
}
