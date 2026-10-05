# Deutsch Klasse 7: Schreibwerkstatt

Workstream B. Status: Planung.

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

Reine Fachlogik in `domain/`, nur mit Vitest:
- `rules.ts` mit den Regeln aus Spec B 3.2 und 3.3, angepasst nach Umsetzungsplan 5.3
- `state.ts` mit der State Machine aus Spec B 4
- zod-Schemas aus Spec B 7.4
- Prompt-Dateien P1 bis P5
- `content/missions.json`, `help_cards.json`, `checklists.json`
