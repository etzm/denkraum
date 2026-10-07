/**
 * Public entry paths per grade: denkraum.martinetzrodt.com/klasse10/ and so on.
 * The slug is the grade only; the school type comes from the group a code belongs to.
 */
export interface ClassEntry {
  slug: string;
  klasse: number;
  label: string;
  fach: string;
  thema: string;
  note: string;
  open: boolean;
}

export const CLASSES: readonly ClassEntry[] = [
  {
    slug: "klasse7",
    klasse: 7,
    label: "Klasse 7",
    fach: "Deutsch",
    thema: "Schreibwerkstatt",
    note: "Argumentieren lernen: erst planen, dann schreiben, dann überarbeiten.",
    open: true,
  },
  {
    slug: "klasse10",
    klasse: 10,
    label: "Klasse 10",
    fach: "Mathematik",
    thema: "Trigonometrie",
    note: "Seiten und Winkel im rechtwinkligen Dreieck mit Sinus, Kosinus und Tangens.",
    open: true,
  },
  {
    slug: "klasse11",
    klasse: 11,
    label: "Klasse 11",
    fach: "Oberstufe",
    thema: "in Vorbereitung",
    note: "Die ersten Module für die Oberstufe entstehen gerade.",
    open: false,
  },
];

export function classBySlug(slug: string): ClassEntry | undefined {
  return CLASSES.find((c) => c.slug === slug);
}

export function slugForKlasse(klasse: number): string {
  return `klasse${klasse}`;
}

/** "klasse07" and "Klasse10" lead to the canonical slug; anything else is unknown. */
export function canonicalSlug(slug: string): string | null {
  const match = /^klasse0*(\d{1,2})$/i.exec(slug);
  if (!match) return null;
  const canonical = slugForKlasse(Number(match[1]));
  return classBySlug(canonical) ? canonical : null;
}
