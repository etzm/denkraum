# Entscheidungen (plattformweit)

Modulspezifische Entscheidungen stehen in `modules/<schulart>/klasse-<nn>/<modul>/DECISIONS.md`.

Status:
- "umgesetzt": gilt und ist im Repo umgesetzt.
- "vorgeschlagen": wartet auf Freigabe, siehe [Umsetzungsplan](docs/umsetzungsplan.md).

| ID | Entscheidung | Status | Begründung |
|---|---|---|---|
| D-001 | Module liegen unter `modules/<schulart>/klasse-<nn>/<fach>-<thema>/`. Start: `gesamtschule/klasse-07`, `klasse-10`, `klasse-11`. | umgesetzt | Gliederung nach Schulart und Klasse; getrennte Verzeichnisse je Workstream |
| D-002 | Eine Plattform (`apps/web`, `packages/*`), Module als pnpm-Workspace-Pakete mit festem Aufbau | vorgeschlagen | Beide Specs teilen rund zwei Drittel der Technik (Umsetzungsplan 1, 3) |
| D-003 | Stack: Next.js, TypeScript, Tailwind, pnpm, Drizzle, PostgreSQL, S3-kompatibler EU-Speicher, Docker Compose | vorgeschlagen | Schnittmenge beider Specs; Drizzle, weil Spec A es verlangt und Spec B den vorhandenen Stack übernimmt |
| D-004 | KI-Zugriff nur über das Paket `llm`: Tiers `vision`, `hard`, `light`; Adapter für OpenAI-kompatibles Gateway, Anthropic und Mock; CI immer mit Mock | vorgeschlagen | Austauschbare Modelle, EU-Endpunkte, Tests ohne API-Schlüssel |
| D-005 | Prompts als versionierte Dateien `prompts/<name>.v<N>.md`; die Version wird mit jedem Ergebnis gespeichert | vorgeschlagen | Übernommen aus Spec B 7.3 für alle Module |
| D-006 | Code entscheidet, KI formuliert: Bewertung, Freischaltung und Niveauwechsel nur durch Code-Regeln oder Menschen | vorgeschlagen | KI-Verordnung Anhang III Nr. 3, Vorgabe Kultusministerium BW (Umsetzungsplan 5.3) |
| D-007 | Datenschutz-Leitplanken in `docs/datenschutz/README.md` sind verbindlich | umgesetzt | Datenschutz von Anfang an |
| D-008 | Specs der Module liegen vorerst nicht im öffentlichen Repo | umgesetzt | Repo ist öffentlich; Entscheidung offen (Umsetzungsplan 8, Frage 5) |
| D-009 | Code, Bezeichner, Commits und Kommentare auf Englisch; Dokumentation und alle UI-Texte auf Deutsch (Du-Form für Schülerinnen und Schüler, Sie-Form für Erwachsene) | umgesetzt | Übernommen aus Spec B 0 |
