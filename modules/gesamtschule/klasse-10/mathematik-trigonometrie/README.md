# Mathematik Klasse 10: Trigonometrie-Einstieg

Workstream A. Status: Entwicklung. Lektion 4 läuft als Durchstich (A1).

## Inhalt

Interaktive Lektionen zur Trigonometrie im rechtwinkligen Dreieck mit Einstieg über ähnliche Dreiecke.

So läuft eine Lektion ab:
1. Die Schülerinnen und Schüler lösen Papieraufgaben mit individuellen Zahlen.
2. Sie fotografieren die Lösung und laden sie hoch.
3. Sie bekommen formatives Feedback, keine Note. Richtig oder falsch entscheidet Code, nicht das Sprachmodell.

Die Lektionen bauen aufeinander auf:
- Lektionen 1 bis 7, davon Lektion 7 nur auf E-Niveau
- danach ein Abschlusstest
- Niveaus G, M und E

## Spezifikation

"Umsetzungs-Prompt: Modul Trigonometrie-Einstieg, Mathematik Klasse 10" (Stand 5. Oktober 2026). Sie liegt noch nicht im Repo, weil das Repository öffentlich ist (DECISIONS.md, D-008). Nach der Freigabe kommt sie als `SPEC.md` hierher.

## Anpassungen an die gemeinsame Plattform

Siehe [Umsetzungsplan](../../../../docs/umsetzungsplan.md), Abschnitte 3 und 6.

- Drizzle, Paket `llm` (Tier `vision` für die Transkription, `light` für den Feedbacktext), Prompts als versionierte Dateien.
- Foto-Pipeline, Druck und Login kommen aus der Plattform.
- Der Parameter-Generator verwirft Seeds, bei denen ein Fehlweg innerhalb der Toleranz der richtigen Lösung liegt. Beispiele: α = 45° bei Sinus und Kosinus vertauscht, oder F5 bei bestimmten Winkeln.
- F5 (zu früh gerundet) wird über die transkribierten Zwischenwerte erkannt.
- Tagging: Teilkompetenz 7-8-9_03 (17) (Ähnlichkeitssätze) hat kein G-Niveau.

## Erster Schritt (A0)

Umgesetzt: reine Fachlogik in `domain/`, ohne Oberfläche, Datenbank und Sprachmodell, getestet mit Vitest.

- `domain/schema.ts`: zod-Schema für Aufgaben (Spec A 4.1) und für eine Aufgabe der bestätigten Transkription (Spec A 6.2). Erlaubt sind nur die sechs geprüften Bildungsplan-Codes, mit ihren Niveau-Regeln.
- `domain/solutions.ts`: Musterlösungen mit allen Zwischenwerten und den typischen Fehlwegen für alle Beispielaufgaben aus Spec A 4.2. L7-A1 ist eine Schritt-Checkliste.
- `domain/verify.ts`: `verify()` entscheidet per Code über `correct`, `partially_correct`, `incorrect` oder `not_found` und erkennt die Fehlertypen.
- `domain/misconceptions.ts`: Fehlerkatalog F1 bis F13 mit Bezeichnung und Hinweisvorlage.
- `domain/generator.ts` und `domain/random.ts`: Parameter aus Seed und Versuch, mit Mehrdeutigkeitsprüfung.
- `domain/tasks.ts` und `content/tasks/*.json`: die zwölf Beispielaufgaben, beim Laden gegen Schema und Musterlösung geprüft.
- `tests/`: alle Werte aus Spec A 4.2, die Fälle aus Spec A 14 Nr. 2, der Generator mit 2000 Seeds je Aufgabe.

Die Entscheidungen dazu stehen in [DECISIONS.md](DECISIONS.md).

## Durchstich Lektion 4 (A1)

Lektion 4 „Seitenlängen berechnen“ läuft vollständig auf der Plattform, vom Niveau bis zur Rückmeldung. Die Entscheidungen dazu sind T-28 bis T-41 in [DECISIONS.md](DECISIONS.md).

Ablauf und Seiten unter `/klasse10/m/mathematik-trigonometrie`:

| Pfad | Inhalt |
|---|---|
| (Start) | Niveau G, M oder E wählen (gespeichert in `learners.niveau`), Lektionen 1 bis 7 mit Stand von Lektion 4 |
| `lektion/4` | Erklärung, Dreieck zum Antippen (α oder β, Seiten färben sich um), Verhältnisse, Vorgehen, Taschenrechner-Check, Beispiel Schritt für Schritt |
| `lektion/4/uebung` | Zwei Lückenaufgaben mit sofortiger Prüfung durch Code und Hinweisen; nach 3 Fehlversuchen der Lösungsweg „mit Hilfe“ |
| `blatt/<id>` | Arbeitsblatt am iPad mit eigenen Zahlen und Blatt-Code, gelöst auf Blanko-Papier (D-012) |
| `blatt/<id>/foto` | Foto aufnehmen mit `PhotoCapture` (Art `worksheet`, 1600 px) |
| `blatt/<id>/pruefen?upload=<id>` | Die KI liest die Lösung („Ich lese deine Lösung …“), dann „Habe ich dich richtig gelesen?“ mit Foto und änderbaren Feldern |
| `blatt/<id>/ergebnis` | richtig, fast oder nochmal je Aufgabe, ein Hinweis (als KI-Rückmeldung gekennzeichnet oder Katalogtext), „Nochmal mit neuen Zahlen“, „Lösungsweg ansehen“ ab dem zweiten Fehlversuch, Fotos löschen |
| `blatt/<id>/loesung/<aufgabe>` | Vollständiger Lösungsweg, erst nachdem das Öffnen gespeichert ist |

Wer was entscheidet:
- Code (`domain/`): richtig oder falsch (`verify`), Fehlertypen, Freischaltung des Arbeitsblatts, Versuche, „Lektion geschafft“ (3 von 4 Papieraufgaben richtig im ersten oder zweiten Versuch), wann der Lösungsweg sichtbar wird.
- KI, Tier `vision`: Abschrift der Fotos (`prompts/transcribe.v1.md`, Schema in `domain/ai.ts`). Sie bewertet nichts; die Person bestätigt oder korrigiert.
- KI, Tier `light`: Formulierung der Rückmeldung (`prompts/feedback.v1.md`). Status, Codes und nächster Schritt setzt der Code; ein Text mit einem richtigen Endwert wird verworfen.

Aufbau:
- `content/tasks/L4.json`: L4-A1 Beispiel, L4-A3 und L4-A4 Lückenaufgaben, L4-A2, L4-A5, L4-A6, L4-A7 Papieraufgaben, alle in G, M und E.
- `domain/lesson.ts`: Regeln des Ablaufs; `domain/format.ts`: Anzeige mit Dezimalkomma und Eingabe; `domain/ai.ts`: Ein- und Ausgaben der KI, Mock-Antworten, Schutz gegen verratene Ergebnisse.
- `db.ts`: Tabellen `trig_worksheets`, `trig_checks`, `trig_results` (Migration `packages/db/drizzle/0003_trig.sql`). Abschrift und Rückmeldung liegen in den Plattform-Tabellen `transcripts` und `feedback`.
- `server/`: Datenzugriff und Server-Actions; `ui/`: Seiten und Client-Komponenten; `app.tsx`: Einstieg für die Plattform.
- Prompts ändern: neue Datei `prompts/<name>.v<N+1>.md`, dann `pnpm prompts:gen`.

Prüfen im Wurzelverzeichnis des Repos:

```
npx vitest run modules/gesamtschule/klasse-10/mathematik-trigonometrie
npx tsc -p modules/gesamtschule/klasse-10/mathematik-trigonometrie
pnpm build
PW_CHROMIUM_PATH=... pnpm --filter @denkraum/web test:e2e trig-lesson4
```

Der E2E-Test `apps/web/e2e/trig-lesson4.spec.ts` läuft mit `LLM_PROVIDER=mock` und einem im Browser gezeichneten Testbild.

Noch offen:
- Lektionen 1 bis 3 und 5 bis 7 mit vollständiger Aufgabenbank (Spec 14 Nr. 3) und Interleaving ab Lektion 3 (A2)
- Punkte und Abzeichen (Spec 7), Lehrkraft-Ansicht (A3), Offline-Lektionen (D-019)
- Druckansicht des Arbeitsblatts als PDF (optional, D-012)
- Erkennung von F9, dafür fehlen Angaben in der Transkription
- Prüfung von Transkription und Rückmeldung mit einem echten Modell am Golden Set
