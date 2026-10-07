import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canonicalSlug, classBySlug } from "@/lib/classes.ts";

export default async function KlasseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ klasse: string }> }) {
  const { klasse } = await params;
  const slug = canonicalSlug(klasse);
  if (!slug) notFound();
  if (slug !== klasse) redirect(`/${slug}`);
  const entry = classBySlug(slug)!;
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <nav className="flex items-center justify-between gap-4 text-sm">
        <Link href="/" className="font-semibold tracking-tight text-accent min-h-11 inline-flex items-center">
          Denkraum
        </Link>
        <span className="text-muted">
          {entry.label} · {entry.fach}
        </span>
      </nav>
      {children}
    </div>
  );
}
