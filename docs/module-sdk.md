# Module-SDK

So hängt sich ein Modul an die Plattform. Alles Fachliche bleibt im Modulverzeichnis; `apps/web` braucht nur eine Zeile in `src/lib/modules.ts`.

## Aufbau

```
modules/<schulart>/klasse-<nn>/<modul>/
  module.ts      Manifest (defineModule aus @denkraum/core)
  app.tsx        Plattform-Einstieg: definition = defineModuleDefinition({...})
  domain/        reine Fachlogik ohne I/O
  prompts/       <name>.v<N>.md und das generierte index.ts (pnpm prompts:gen)
  db.ts          eigene Tabellen (optional, siehe unten)
  ui/            Komponenten; Client-Komponenten mit "use client"
```

## Definition

```tsx
export const definition = defineModuleDefinition({
  manifest,
  prompts: PROMPTS,                              // aus prompts/index.ts
  uploadKinds: { worksheet: { maxPages: 6 } },   // nur diese Upload-Arten werden angenommen
  mockFixtures: { feedback: () => ({ ... }) },   // feste KI-Antworten für Tests und Entwicklung
  async render(ctx, path, search) {              // Seite für /<klasse>/m/<modul>/<...path>
    if (path[0] === "blatt") return <Blatt ctx={ctx} id={path[1]} />;
    return <Start ctx={ctx} />;                  // null ergibt "nicht gefunden"
  },
  actions: {
    async pruefen(ctx, form) {                   // Formular: <form action={ctx.action("pruefen")}>
      ...
      return { redirect: `${ctx.basePath}/blatt/1` };
    },
  },
});
```

## Kontext `ctx`

| Feld | Inhalt |
|---|---|
| `learner` | `id`, `niveau`, `niveauEEnabled`. Kein Pseudonym, keine Codes. |
| `group` | `id`, `schulart`, `klasse`, `endsAt` |
| `basePath` | z. B. `/klasse10/m/mathematik-trigonometrie` |
| `db` | Drizzle-Datenbank (eigene Tabellen und Plattform-Tabellen) |
| `ai.generate({ prompt, variables, input, images, schema })` | Modellaufruf: neueste Promptversion, Schemaprüfung mit einem Wiederholversuch, Identitätsprüfung, Protokoll ohne Inhalte. Ergebnis `{ ok, data, promptVersion, model }` oder `{ ok: false, reason }` mit `reason` in `schema_error`, `refused`, `timeout`, `error`. |
| `uploads` | `list(ref)`, `get(id)`, `pageUrls(id, n)`, `images(id)` (Base64 für das Modell), `deleteImages(id)` |
| `action(name)` | Server-Action für `<form action>` |

Regeln:
- In `input` für die KI steht nie etwas über die Person. Die Plattform bricht den Aufruf sonst ab (`IdentityLeakError`).
- Ob etwas richtig ist und was freigeschaltet wird, entscheidet Code in `domain/` (DECISIONS.md, D-006). Die KI liest und formuliert.
- Bei `refused` oder `timeout` bietet das Modul einen Ersatzweg an (Eingabe per Tastatur) und wechselt nicht selbst das Modell (D-014).
- Jede KI-Rückmeldung wird sichtbar als solche gekennzeichnet (Art. 50 KI-Verordnung).

## Fotos

Client-Komponente aus `@denkraum/capture`:

```tsx
<PhotoCapture moduleId={manifest.id} kind="worksheet" refId={blattId} maxSide={1600} nextHref={`${ctx.basePath}/blatt/${blattId}/pruefen?upload={uploadId}`} />
```

Die Komponente kodiert jedes Foto im Browser neu (ohne EXIF/GPS), der Server prüft erneut, speichert verschlüsselt und löscht nach 14 Tagen. Anzeigen über `ctx.uploads.pageUrls(id, n)`, an das Modell über `ctx.uploads.images(id)`.

## Eigene Tabellen

```ts
import { learners } from "@denkraum/db/schema";
export const blaetter = pgTable("trig_worksheets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  learnerId: text("learner_id").notNull().references(() => learners.id, { onDelete: "cascade" }),
  ...
});
```

- Tabellennamen mit Modul-Präfix (`trig_`, `sw_`).
- Immer per Fremdschlüssel mit `onDelete: "cascade"` an `learners` hängen, damit Löschjob und Löschung je Pseudonym auch Modul-Daten entfernen.
- Die Datei in `packages/db/drizzle.config.ts` unter `schema` eintragen und `pnpm db:generate` ausführen.

## Tests

- Fachlogik: Vitest in `tests/` oder neben dem Code.
- Seiten und Abläufe: Playwright in `apps/web/e2e/`, immer mit `LLM_PROVIDER=mock` und den `mockFixtures` des Moduls.
