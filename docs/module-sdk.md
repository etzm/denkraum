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
import { learners, pgTable, text } from "@denkraum/sdk/db";
export const blaetter = pgTable("trig_worksheets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  learnerId: text("learner_id").notNull().references(() => learners.id, { onDelete: "cascade" }),
  ...
});
```

- Module importieren Tabellen-Bausteine, Plattform-Tabellen und Abfrage-Operatoren aus `@denkraum/sdk/db`; sie brauchen keine eigene Abhängigkeit auf `drizzle-orm` oder `@denkraum/db`.
- Tabellennamen mit Modul-Präfix (`trig_`, `sw_`).
- Immer per Fremdschlüssel mit `onDelete: "cascade"` an `learners` hängen, damit Löschjob und Löschung je Pseudonym auch Modul-Daten entfernen.
- `db.ts` direkt im Modulverzeichnis wird automatisch erfasst. Migration erzeugen: `pnpm --filter @denkraum/db generate --name <modul>` (ohne `--` vor `--name`).
- Export-Haken: `export.ts` im Modul mit `exportLearner(db, learnerId)`, das alle Zeilen des Moduls zu dieser Person liefert; in der Definition als `exportLearner` eintragen und in `apps/web/src/lib/learner-data.ts` registrieren. Ein Test prüft, dass jedes Modul einen Haken hat.

## Hinweise

- Eine Weiterleitung aus einer Server-Action, die nur den `#anker` ändert, lädt die Seite nicht neu. Für "gleiche Seite, neuer Stand" einen wechselnden Query-Parameter anhängen (z. B. `?versuch=2`).
- Module haben `react`, aber kein `react-dom`. Wartezustände beim Absenden (zum Beispiel "Ich lese deine Lösung …") über eigenen Client-Zustand statt `useFormStatus`.
- Mit `LLM_PROVIDER=mock` antwortet jedes Modul aus seinen eigenen `mockFixtures`; gleiche Promptnamen in verschiedenen Modulen stören sich nicht.

## Ansicht für Lehrkräfte

Optional. Die Lehrkraft meldet sich mit dem Lehrkraft-Code der Gruppe an (D-017, D-030) und sieht unter `/<klasse>/lehrkraft/m/<modul>/<...pfad>` die Seiten des Moduls:

```tsx
teacher: {
  async render(ctx, path, search) {               // ctx: TeacherContext
    if (path[0] === undefined) return <Overview ctx={ctx} />;
    return null;                                  // "nicht gefunden"
  },
  actions: { async korrigieren(ctx, form) { ... } },   // <form action={ctx.action("korrigieren")}>
},
```

| Feld | Inhalt |
|---|---|
| `viewer` | `id` der Lehrkraft (pseudonym) |
| `group` | wie bei `ModuleContext`, dazu `label` |
| `learners` | alle Lernenden der Gruppe mit `id` und `pseudonym`, sortiert |
| `basePath` | z. B. `/klasse10/lehrkraft/m/mathematik-trigonometrie` |
| `db`, `action(name)`, `now` | wie bei `ModuleContext` |

Regeln:
- Kein `ai` und keine `uploads`: Die Lehrkraft sieht bestätigte Transkripte, keine Fotos (Leitplanken, Abschnitt 4).
- Jede Abfrage wird über `learners.groupId = ctx.group.id` auf die eigene Gruppe begrenzt, auch bei IDs aus Formularen.
- Erwachsene werden gesiezt (D-009).

## Tests

- Fachlogik: Vitest in `tests/` oder neben dem Code. Für Datenbank-Tests: `connectDb("pglite:memory")` und `createMemoryBlobStore()` aus `@denkraum/sdk/testing`.
- Seiten und Abläufe: Playwright in `apps/web/e2e/`, immer mit `LLM_PROVIDER=mock` und den `mockFixtures` des Moduls.
