# Mathematik Klasse 10: Trigonometrie-Einstieg

Workstream A. Status: Planung.

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

Prüfen im Wurzelverzeichnis des Repos:

```
npx vitest run modules/gesamtschule/klasse-10/mathematik-trigonometrie
npx tsc -p modules/gesamtschule/klasse-10/mathematik-trigonometrie
```

Noch offen:
- vollständige Aufgabenbank je Lektion (Spec A 14 Nr. 3) und Parameterbereiche für alle Aufgaben außer L4-A2 (A2)
- Erkennung von F9, dafür fehlen Angaben in der Transkription
