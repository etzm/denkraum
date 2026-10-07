# Deutsch Klasse 7: Schreibwerkstatt

Workstream B. Status: B1 umgesetzt (Mission m-04-01 mit getipptem Plan und Text).

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

Prüfen im Repo-Wurzelverzeichnis:

```
npx vitest run modules/gesamtschule/klasse-07/deutsch-schreibwerkstatt
npx tsc -p modules/gesamtschule/klasse-07/deutsch-schreibwerkstatt
```

## Zweiter Schritt (B1): Mission m-04-01 getippt

Umgesetzt nach Spec Phase 1: die ganze Mission auf der Plattform, Plan und Text werden getippt. Entscheidungen SW-29 bis SW-38 in [DECISIONS.md](DECISIONS.md).

Ablauf unter `/klasse7/m/deutsch-schreibwerkstatt`, eine Seite je Missionslauf (`/lauf/<id>`). Jede Eingabe ist genau ein Ereignis der State Machine; die Seite zeigt, was zum Zustand gehört:

1. Auftrag mit Adressat, Operator und Checkliste der Erfolgskriterien
2. Planen im Formular mit denselben Kästen wie der Planungsbogen (Thema, Mein Standpunkt, Argument 1 bis 3 mit Behauptung, Begründung, Beispiel, Reihenfolge, Schluss)
3. Plan-Rückmeldung mit P2: Spiegelung, Ampel P1 bis P5, eine Frage (Antwort freiwillig). Ob es weitergeht, entscheidet `planGate` im Code; höchstens zwei Überarbeitungsrunden
4. Schreiben im Textfeld mit Wortzähler; unter 80 Wörtern schickt der Code den Text zurück
5. Selbstkontrolle mit der Checkliste der Stufe; These und Beispiele markieren ist freiwillig
6. Text-Rückmeldung mit P4: Textlupe mit Markierungen (nur exakte Zitate, sonst ein zweiter Abruf, dann ohne Markierung), zwei Stärken, ein nächster Schritt, Sterne je Dimension nur für das Kind; Richtigkeit zeigt "kommt später" (D-021)
7. Überarbeitung einer Stelle, geprüft mit P5; ein zweiter Versuch, danach geht es mit Vermerk weiter
8. Abschluss mit XP (100 für die Mission, 20 für die Überarbeitung)

Jede KI-Ausgabe trägt den Hinweis "Diese Rückmeldung hat eine KI formuliert." Antwortet das Modell nicht oder lehnt ab, sieht das Kind einen neutralen Hinweis und macht weiter (D-006, D-014). Setzt P4 `inappropriate`, hält der Lauf in `held_for_adult`: keine Rückmeldung, ein neutraler Hinweis für das Kind.

Inhalte mit `approved: false` erscheinen nur, wenn `DENKRAUM_SHOW_UNAPPROVED=true` gesetzt ist (Tests, Durchsicht von Entwürfen). Sonst steht dort "Diese Mission wartet auf Freigabe" (D-022).

Dateien:
- `app.tsx`: Seiten und Aktionen für die Plattform, Mock-Antworten
- `mission/`: Aktionen (`actions.ts`), Ablauf mit KI-Aufrufen (`engine.ts`), Speicher (`store.ts`), Eingaben für P2, P4, P5 ohne Personenbezug (`ai-input.ts`), Mock-Antworten (`mocks.ts`), Inhalte (`content.ts`)
- `ui/`: Seiten je Zustand (`RunPage.tsx`), Startseite, Bausteine, Textfeld mit Wortzähler (einzige Client-Komponente)
- `db.ts`: Tabelle `sw_mission_runs` (Zustand des Laufs, Sterne, XP), Migration `packages/db/drizzle/0002_sw.sql`
- `domain/feedback.ts`: Sätze für die Markierung, Textlupe, Überarbeitungsaufgabe mit Ersatz durch Code, Prüfung "KI schreibt nicht für das Kind"
- `content/rubrics.json`: Rubrik 7.1 als Eingabe für P4

Speicherung: Plan, Text und Überarbeitung sind je eine Zeile in `uploads` (`typed = true`, `kind` plan, text oder revision, `ref` = Lauf-ID) mit dem Inhalt in `transcripts`. Jede KI-Antwort steht in `feedback` mit Promptname, Version und Modell. So erfassen Export, Löschung und Aufbewahrung der Plattform die Inhalte. Nichts wird überschrieben; eine neue Runde ist eine neue Zeile.

Mock-Antworten (`LLM_PROVIDER=mock`) leiten sich aus der Anfrage ab; Zitate sind Teilstrings des abgeschickten Texts. Markierwörter im Text lösen Sonderwege aus: `TESTMARKER-UNGEEIGNET` (P4 setzt `inappropriate`), `TESTMARKER-KEINE-ANTWORT` (ungültige Antwort, Aufruf scheitert), `TESTMARKER-ZITAT` (Zitate passen nicht), `TESTMARKER-NICHT-ERFUELLT` (P5 nicht erfüllt). Sie wirken nur mit dem Mock.

Tests:
- `tests/mission-flow.test.ts`: ganzer Ablauf über die Aktionen auf PGlite, mit Zeilen in `uploads`, `transcripts`, `feedback`; Planrunden, `held_for_adult`, Zitatprüfung, zweiter Überarbeitungsversuch, Freigabe, Ausfälle und Ablehnungen des Modells, Pseudonym im Text, Wiederaufnahme, Löschung per Kaskade
- `tests/mocks.test.ts`: Mock-Antworten passen zu den Schemas und zur Zitatprüfung; zehn Beispieltexte ergeben kein Feedback, das Text für das Kind schreibt (Spec Phase 1)
- `tests/b1.test.ts`, `tests/feedback.test.ts`: neue Ereignisse, Sterne ohne Dimension D, XP, Freigabe, Rubrik, Textlupe, Überarbeitungsaufgabe
- `apps/web/e2e/sw-mission.spec.ts`: ganzer Lauf im Browser, Planrunde, `held_for_adult`

```
npx vitest run modules/gesamtschule/klasse-07/deutsch-schreibwerkstatt
pnpm build && PW_CHROMIUM_PATH=... pnpm --filter @denkraum/web test:e2e
```

Offen für die nächsten Schritte:
- Freigabe aller Inhalte, der Rubrik und der Boss-Themen durch die Deutschlehrkraft
- Erwachsenen-Ansicht (P2): Hinweis bei `held_for_adult` und Freigabe (`ADULT_RELEASED`); bis dahin bleibt ein angehaltener Lauf angehalten
- Export der Plattform um Modul-Tabellen erweitern (Selbstkontrolle, Antwort auf die Plan-Frage, Vermerke und Sterne liegen in `sw_mission_runs`)
- Eingangsfilter vor P2 und P4 (Spec 7.6), Meldeweg für `held_for_adult` (Schutzkonzept)
- Spielschicht (B3): Fortschritt, Startregeln mit Station und Stufe, Schlüssel, Hilfskarten-Shop, Joker, Streak
- Handschrift (B2): Druckvorlagen, Foto, P1 und P3, Bestätigung
- LanguageTool für Dimension D; für Stufe 1 und 2 gibt es noch keine passende Rubrik
- mindestens 14 freigegebene Übungen je Station, damit die Ziehung ohne Wiederholung immer gelingt
