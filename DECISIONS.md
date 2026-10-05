# Entscheidungen (plattformweit)

Modulspezifische Entscheidungen stehen in `modules/<schulart>/klasse-<nn>/<modul>/DECISIONS.md`.

Status:
- "entschieden": vom Projekt festgelegt (Datum).
- "umgesetzt": gilt und ist im Repo umgesetzt.
- "vorgeschlagen": wartet auf Freigabe, siehe [Umsetzungsplan](docs/umsetzungsplan.md).

| ID | Entscheidung | Status | Begründung |
|---|---|---|---|
| D-001 | Module liegen unter `modules/<schulart>/klasse-<nn>/<fach>-<thema>/`. Start: `gesamtschule/klasse-07`, `gesamtschule/klasse-10`, `gymnasium/klasse-11`. | umgesetzt | Gliederung nach Schulart und Klasse; getrennte Verzeichnisse je Workstream |
| D-002 | Eine Plattform (`apps/web`, `packages/*`), Module als pnpm-Workspace-Pakete mit festem Aufbau | umgesetzt (P0) | Beide Specs teilen rund zwei Drittel der Technik (Umsetzungsplan 1, 3) |
| D-003 | Stack: Next.js, TypeScript, Tailwind, pnpm, Drizzle, PostgreSQL, S3-kompatibler EU-Speicher, Docker Compose. Lokal und in Tests ersetzt PGlite die Datenbank, damit kein Docker nötig ist. | umgesetzt (P0), Objektspeicher folgt in P1 | Schnittmenge beider Specs; Drizzle, weil Spec A es verlangt und Spec B den vorhandenen Stack übernimmt |
| D-004 | KI-Zugriff nur über das Paket `llm` (`generateStructured`): Tiers `vision`, `hard`, `light`; Adapter für Bedrock (EU), Anthropic-API (nur Entwicklung) und Mock; CI immer mit Mock. Ein Adapter für ein OpenAI-kompatibles Gateway (offene Modelle) folgt, wenn sie gemessen werden. | umgesetzt (P0) | Austauschbare Modelle, EU-Endpunkte, Tests ohne API-Schlüssel |
| D-005 | Prompts als versionierte Dateien `prompts/<name>.v<N>.md`; die Version wird mit jedem Ergebnis gespeichert | umgesetzt (P0) | Übernommen aus Spec B 7.3 für alle Module |
| D-006 | Code entscheidet, KI formuliert: Bewertung, Freischaltung und Niveauwechsel nur durch Code-Regeln oder Menschen | umgesetzt (A0, B0) | KI-Verordnung Anhang III Nr. 3, Vorgabe Kultusministerium BW (Umsetzungsplan 5.3) |
| D-007 | Datenschutz-Leitplanken in `docs/datenschutz/README.md` sind verbindlich | umgesetzt | Datenschutz von Anfang an |
| D-008 | Die Specs der Module bleiben außerhalb des Repos; das Repo bleibt öffentlich | entschieden 5.10.2026 | Antwort auf Umsetzungsplan 8, Frage 5 |
| D-009 | Code, Bezeichner, Commits und Kommentare auf Englisch; Dokumentation und alle UI-Texte auf Deutsch (Du-Form für Schülerinnen und Schüler, Sie-Form für Erwachsene) | umgesetzt | Übernommen aus Spec B 0 |
| D-010 | Klasse 11 liegt unter `modules/gymnasium/klasse-11/` | entschieden 5.10.2026 | Gymnasiale Oberstufe; Material bleibt an Gymnasien wiederverwendbar |
| D-011 | Schreibwerkstatt v1 läuft nur als Pilot zu Hause; eine Einwilligung ist dafür nicht nötig. Sobald Kinder anderer Familien oder die Schule teilnehmen, wird die Rechtsgrundlage neu bewertet. | entschieden 5.10.2026 | Antwort auf Frage 2 |
| D-012 | Trigonometrie: Arbeitsblätter werden am iPad angezeigt und auf Blanko-Papier gelöst. Die Zuordnung beim Upload läuft über das in der App geöffnete Blatt; ein QR-Code ist nicht nötig. Auf das Papier kommen nur Blatt-Code und Aufgabennummern. Ein Druck als PDF bleibt optional. | entschieden 5.10.2026 | Antwort auf Frage 3 |
| D-013 | Modelle: zuerst Claude über eine EU-Region (Amazon Bedrock, `eu-central-1`); Sonnet 5.5 für `vision` und `hard`, Haiku 4.5 für `light`. Die direkte Anthropic-API nur für die Entwicklung mit synthetischen Daten; die Konfiguration blockiert sie in Produktion und Bedrock außerhalb der EU. Offene Modelle erst nach Messung am Golden Set. | entschieden 5.10.2026 | Antwort auf Frage 4 |
| D-014 | Ablehnungen des Modells (`refusal`) werden nicht automatisch an ein anderes Modell weitergereicht. Das Modul bietet dann den Ersatzweg an (Eingabe per Tastatur oder Hinweis an die Lehrkraft). | umgesetzt (P0) | Ein Modellwechsel soll eine bewusste, dokumentierte Entscheidung sein (DSFA) |
| D-015 | Quelltext nutzt nur Syntax, die Node direkt ausführen kann (`erasableSyntaxOnly`); Skripte laufen mit `node` ohne Build-Schritt | umgesetzt (P0) | Weniger Werkzeuge, einfache Skripte für Seed und Löschjob |
