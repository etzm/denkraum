# Deutsch Klasse 7: Schreibwerkstatt

Workstream B. Status: Entwicklung.

## Inhalt

Argumentierendes Schreiben: erst die begründete Stellungnahme (Niveau M), dann die lineare Erörterung mit Gegenargument (Niveau E).

Das Modul folgt drei Grundsätzen:
- Planen vor dem Schreiben, mit Papier zuerst
- KI-Feedback mit "zwei Stärken, ein nächster Schritt"
- Überarbeiten

Der Weg führt über eine Skill-Leiter mit Stufen 1 bis 6 bis zur handschriftlichen Boss-Mission.

## Spezifikation

"Schreibwerkstatt: Implementierungsplan", Version 0.1 (Stand 5. Oktober 2026). Sie liegt noch nicht im Repo, weil das Repository öffentlich ist (DECISIONS.md, D-008). Nach der Freigabe kommt sie als `SPEC.md` hierher.

## Anpassungen an die gemeinsame Plattform

Siehe [Umsetzungsplan](../../../../docs/umsetzungsplan.md), Abschnitte 3, 5.3 und 7.

- Drizzle statt Prisma; das Paket `llm` mit den Tiers `vision`, `hard` und `light` ersetzt das Vercel AI SDK im Modulcode.
- Freischaltungen nur nach Regeln, die Code prüft: bestätigtes Transkript, Mindestlänge, Selbstkontrolle, erledigte Überarbeitung, gefundene Zitate. KI-Sterne bleiben formative Rückmeldung ohne Torwirkung.
- Den E-Pfad schaltet ein Mensch frei, auf Vorschlag des Systems.
- Dimension D (Richtigkeit): Vorschlag ist eine regelbasierte Zählung mit selbst gehostetem LanguageTool auf dem bestätigten Transkript.
- Bilder 14 Tage statt 180 Tage. Das Portfolio arbeitet mit Transkripten.
- Die Schwelle von 25 % Änderungsmenge wird in v1 nur protokolliert und am Golden Set kalibriert.
- Golden Set und Eval-Berichte liegen nicht im öffentlichen Repo.

## Erster Schritt (B0)

Umgesetzt: reine Fachlogik ohne Datenbank, ohne UI und ohne KI-Aufrufe, getestet mit Vitest. Alle Abweichungen von der Spec und alle Ermessensentscheidungen stehen in [DECISIONS.md](DECISIONS.md).

- `domain/rules.ts`: Regeln aus Spec B 3.2 bis 3.4, angepasst nach Umsetzungsplan 5.3. "Mission abgeschlossen" statt "bestanden", Stufenaufstieg, Boss, Planfreigabe per Code, Vorschlag für den E-Pfad, formative Sterne mit Schnittstelle für Dimension D, Schlüssel, Joker, Hilfskarten, XP, Streak nach Berliner Kalendertag, Abzeichen.
- `domain/state.ts`: State Machine aus Spec B 4 als reine Funktion `transition(lauf, ereignis)` mit Guards und Fehlerergebnis statt Ausnahme. Stufenvarianten, höchstens zwei Planrunden, ein zweiter Überarbeitungsversuch, Zustand `held_for_adult`. Jeder Zustand ist reine JSON-Daten und damit wiederaufnehmbar.
- `domain/exercises.ts`: Bewertung der sieben Übungstypen aus Spec B 5, Station bestanden bei 3 von 4, Ziehung mit Seed ohne Wiederholung innerhalb der letzten 10 Aufgaben.
- `domain/quotes.ts`: Prüfung, ob alle Zitate eines Text-Feedbacks wörtlich im bestätigten Text stehen.
- `schemas/`: zod-Schemas für die Ausgaben von P1 bis P5 (Spec B 7.4), für Übungen, Inhalte, Selbstkontrolle und das Frontmatter der Prompts.
- `prompts/`: P1 bis P5 als `<name>.v1.md` mit Frontmatter (`name`, `version`, `model_tier`, `output_schema`).
- `content/`: Missionen, Hilfskarten, Checklisten, Stationen und 14 Beispielübungen (zwei je Typ). Alles mit `approved: false`, bis die Deutschlehrkraft es freigibt.
- `tests/`: 134 Tests für Regeln, State Machine, Übungen, Zitate, Schemas, Inhalte und Prompts.

## Spielschicht: der Garten

Die Fortschrittskarte ist ein Garten mit Gartenhaus, entworfen nach dem Octalysis-Modell. Jeder Text lässt eine Pflanze wachsen, jede Stufe füllt ein Beet, das Gartenhaus wächst über das Schuljahr. Ohne Übung welkt der Garten, stirbt aber nie; eine Station macht ihn wieder frisch. Der Garten liest keine KI-Ausgabe. Details in [docs/spielschicht.md](docs/spielschicht.md), Entscheidungen SW-29 bis SW-33.

- `domain/garden.ts`: Pflanzenstufen, Beete, Gartenhaus, Besucher, Vitalität mit Ferien und Wochenenden, Wetter, alles als Ansicht `gardenView`.
- `content/garden.json`: Schwellen, Ferien 2026/27 (KMK), Sorten, Farben und die Texte für das Kind.
- `tests/garden.test.ts`: 29 Tests, darunter "nichts geht verloren" und "gleicher Garten bei 0 und 12 Sternen".

Prüfen im Repo-Wurzelverzeichnis:

```
npx vitest run modules/gesamtschule/klasse-07/deutsch-schreibwerkstatt
npx tsc -p modules/gesamtschule/klasse-07/deutsch-schreibwerkstatt
```

Offen für die nächsten Schritte:
- Freigabe aller Inhalte und der Boss-Themen durch die Deutschlehrkraft
- Rubrik als Inhalt für P4; für Stufe 1 und 2 gibt es noch keine passende Rubrik
- mindestens 14 freigegebene Übungen je Station, damit die Ziehung ohne Wiederholung immer gelingt
- LanguageTool für Dimension D, Meldeweg für `held_for_adult` (Schutzkonzept)
