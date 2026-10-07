import Link from "next/link";
import { CLASSES } from "@/lib/classes.ts";

const STEPS = [
  { title: "Code eingeben", text: "Du bekommst einen Code von deiner Lehrkraft. Das System gibt dir einen ausgedachten Namen." },
  { title: "Auf Papier arbeiten", text: "Skizze, Rechenweg, Antwortsatz oder dein Text: alles wie im Heft, mit Stift und Papier." },
  { title: "Foto hochladen", text: "Du fotografierst dein Blatt und prüfst, ob die App deine Schrift richtig gelesen hat." },
  { title: "Rückmeldung bekommen", text: "Du erfährst, was schon gut ist, und bekommst genau einen nächsten Schritt." },
];

const PROMISES = [
  {
    title: "Keine Noten von der KI",
    text: "Ob ein Ergebnis stimmt und was als Nächstes freigeschaltet wird, entscheiden feste, nachprüfbare Regeln. Die KI liest nur deine Schrift und formuliert den Hinweis.",
  },
  { title: "Kein echter Name", text: "Du brauchst keinen Namen und keine E-Mail-Adresse. Du bekommst einen ausgedachten Namen und einen Code." },
  { title: "Fotos werden gelöscht", text: "Fotos nach 14 Tagen, alles andere spätestens am Ende des Schuljahres. Ortsangaben im Foto entfernen wir beim Hochladen." },
  { title: "Keine Werbung, kein Tracking", text: "Keine Drittanbieter, keine Analyse-Werkzeuge. Nur ein Cookie, damit du angemeldet bleibst." },
];

/** Hero drawing: a right triangle on squared paper with a handwritten line and a feedback note. */
function HeroSketch() {
  return (
    <svg viewBox="0 0 420 320" role="img" aria-label="Skizze: rechtwinkliges Dreieck mit farbig markierten Seiten und eine Rückmeldung" className="w-full h-auto">
      <rect x="10" y="10" width="400" height="300" rx="18" fill="var(--color-card)" stroke="var(--color-line)" />
      <g stroke="var(--color-grid)" strokeWidth="1">
        {Array.from({ length: 19 }, (_, i) => (
          <line key={`v${i}`} x1={30 + i * 20} y1="12" x2={30 + i * 20} y2="308" />
        ))}
        {Array.from({ length: 14 }, (_, i) => (
          <line key={`h${i}`} x1="12" y1={30 + i * 20} x2="408" y2={30 + i * 20} />
        ))}
      </g>
      <line x1="50" y1="250" x2="330" y2="250" stroke="var(--color-hyp)" strokeWidth="5" strokeLinecap="round" />
      <line x1="50" y1="250" x2="234" y2="118" stroke="var(--color-ak)" strokeWidth="5" strokeLinecap="round" />
      <line x1="234" y1="118" x2="330" y2="250" stroke="var(--color-gk)" strokeWidth="5" strokeLinecap="round" />
      <path d="M226 132 L238 141 L247 129" fill="none" stroke="var(--color-muted)" strokeWidth="1.6" />
      <path d="M86 250 A36 36 0 0 0 79 229" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" />
      <text x="98" y="240" fontSize="18" fill="var(--color-accent)" fontWeight="700">α</text>
      <text x="186" y="276" fontSize="17" fill="var(--color-hyp)" fontWeight="700">c</text>
      <text x="128" y="172" fontSize="17" fill="var(--color-ak)" fontWeight="700">b</text>
      <text x="292" y="176" fontSize="17" fill="var(--color-gk)" fontWeight="700">a</text>
      <text x="40" y="60" fontSize="20" fill="var(--color-ink)" fontFamily="var(--font-mono)">sin α = a : c</text>
      <path d="M40 70 Q120 76 196 68" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
      <g transform="translate(250 34)">
        <rect width="146" height="72" rx="12" fill="var(--color-note)" stroke="var(--color-line)" />
        <text x="12" y="26" fontSize="14" fontWeight="700" fill="var(--color-ink)">Fast!</text>
        <text x="12" y="46" fontSize="13" fill="var(--color-ink)">Steht dein Rechner</text>
        <text x="12" y="62" fontSize="13" fill="var(--color-ink)">auf DEG?</text>
      </g>
    </svg>
  );
}

export default function Landing() {
  return (
    <div className="max-w-5xl mx-auto space-y-16">
      <section className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div className="space-y-6 min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">Denkraum</p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.08] tracking-tight">
            Denken auf Papier. Rückmeldung am Bildschirm.
          </h1>
          <p className="text-lg text-muted max-w-prose">
            Du arbeitest wie im Heft, fotografierst deine Lösung und bekommst eine Rückmeldung, die dir den nächsten Schritt
            zeigt. Ohne Noten, ohne deinen Namen.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/klasse10" className="inline-flex min-h-12 items-center rounded-xl bg-accent px-6 font-semibold text-paper hover:bg-accent-strong">
              Klasse 10: Trigonometrie
            </Link>
            <Link href="/klasse7" className="inline-flex min-h-12 items-center rounded-xl border-2 border-accent px-6 font-semibold text-accent hover:bg-accent-soft">
              Klasse 7: Schreibwerkstatt
            </Link>
          </div>
        </div>
        <div className="min-w-0 max-w-md md:max-w-none mx-auto w-full">
          <HeroSketch />
        </div>
      </section>

      <section aria-labelledby="klassen" className="space-y-5">
        <h2 id="klassen" className="text-2xl font-bold">
          Wähle deine Klasse
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {CLASSES.map((c) => (
            <li key={c.slug} className="min-w-0">
              {c.open ? (
                <Link
                  href={`/${c.slug}`}
                  className="group flex h-full flex-col gap-3 rounded-2xl border border-line bg-card p-5 hover:border-accent"
                >
                  <span className="font-mono text-sm text-muted">/{c.slug}</span>
                  <span className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    {c.label}
                  </span>
                  <span className="font-semibold text-accent">
                    {c.fach}: {c.thema}
                  </span>
                  <span className="text-sm text-muted">{c.note}</span>
                  <span className="mt-auto font-semibold text-accent group-hover:underline underline-offset-4">Zur {c.label}</span>
                </Link>
              ) : (
                <div className="flex h-full flex-col gap-3 rounded-2xl border border-dashed border-line p-5 text-muted">
                  <span className="font-mono text-sm">/{c.slug}</span>
                  <span className="text-xl font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                    {c.label}
                  </span>
                  <span className="font-semibold">{c.thema}</span>
                  <span className="text-sm">{c.note}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ablauf" className="space-y-5">
        <h2 id="ablauf" className="text-2xl font-bold">
          So funktioniert es
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 min-w-0">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 flex-none place-items-center rounded-full border-2 border-accent font-mono font-semibold text-accent bg-card"
              >
                {i + 1}
              </span>
              <div className="space-y-1 min-w-0">
                <h3 className="font-bold">{s.title}</h3>
                <p className="text-sm text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="versprechen" className="space-y-5">
        <h2 id="versprechen" className="text-2xl font-bold">
          Darauf kannst du dich verlassen
        </h2>
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {PROMISES.map((p) => (
            <div key={p.title} className="space-y-1 border-l-4 border-accent pl-4 min-w-0">
              <h3 className="font-bold">{p.title}</h3>
              <p className="text-muted">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="erwachsene" className="rounded-2xl border border-line bg-card p-6 space-y-3">
        <h2 id="erwachsene" className="text-xl font-bold">
          Für Eltern und Lehrkräfte
        </h2>
        <p className="text-muted max-w-prose">
          Denkraum ist ein offenes Projekt in der Pilotphase. Die Aufgaben folgen dem Bildungsplan 2016 Baden-Württemberg. Wie wir mit
          Daten umgehen, lesen Sie in den Hinweisen zum Datenschutz. Der Quellcode ist öffentlich und enthält keine Daten von
          Schülerinnen und Schülern.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/datenschutz" className="font-semibold text-accent underline underline-offset-4 min-h-11 inline-flex items-center">
            Hinweise zum Datenschutz
          </Link>
          <a
            href="https://github.com/etzm/denkraum"
            rel="noopener noreferrer"
            className="font-semibold text-accent underline underline-offset-4 min-h-11 inline-flex items-center"
          >
            Quellcode ansehen
          </a>
        </div>
      </section>
    </div>
  );
}
