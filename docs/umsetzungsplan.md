# Umsetzungsplan: Plattform und erste Module

Stand: 5. Oktober 2026. Status: Fragen aus Abschnitt 8 beantwortet; P0, A0 und B0 umgesetzt (Abschnitt 9).

Grundlage:

- Spec A: "Umsetzungs-Prompt: Modul Trigonometrie-Einstieg, Mathematik Klasse 10" (Stand 5. Oktober 2026)
- Spec B: "Schreibwerkstatt: Implementierungsplan", Deutsch Klasse 7, Version 0.1 (Stand 5. Oktober 2026)
- Rahmen: Gliederung nach Schulart und Klasse; Start mit Klasse 7, 10 und 11 an der Staudinger Gesamtschule; iPads ab Klasse 8, daher Web-App (PWA); Datenschutz von Anfang an.

Abschnittsverweise wie "A 6.4" oder "B 3.2" beziehen sich auf die beiden Specs.

---

## 1. Kurzfassung

1. **Eine Plattform, zwei Module, nicht zwei Apps.** Beide Specs teilen rund zwei Drittel der Technik: Code-Login mit Pseudonym, Druckvorlagen ohne Namensfeld, Foto-Upload, Transkription per Vision-Modell, Bestätigungsschritt "Habe ich dich richtig gelesen?", schemageprüftes KI-Feedback, Spielschicht, Ansicht für Erwachsene, Löschjobs, EU-Hosting. Getrennt gebaut entstünden zwei ORMs (Drizzle und Prisma), zwei LLM-Schichten und zwei Datenschutz-Umsetzungen.
2. **Getrennte Verzeichnisse je Workstream.** Workstream A arbeitet in `modules/gesamtschule/klasse-10/mathematik-trigonometrie/`, Workstream B in `modules/gesamtschule/klasse-07/deutsch-schreibwerkstatt/`. Die Plattform (`apps/`, `packages/`) wird einmal gebaut und nur über kleine, eigene PRs geändert.
3. **Sofort parallel startbar:** die reine Fachlogik beider Module, ohne Plattform. Für A: Musterlösungen, Verifikation, Fehlermuster, Parameter-Generator. Für B: Spielregeln, State Machine, Schemas, Prompt-Dateien, Inhalte. Das ist testgetrieben, risikoarm und klärt die fachlich schwierigsten Teile zuerst.
4. **Vor dem Bau klären:**
   - KI-Verordnung: In Spec B vergibt die KI Sterne, und die Sterne steuern Freischaltungen und den E-Pfad. Das fällt in den Hochrisiko-Bereich (Abschnitt 5.3).
   - Löschfristen: Die beiden Specs widersprechen sich, und Transkripte haben in keiner der beiden eine Frist (Abschnitt 5.2).
   - Drucklogistik für individuelle Arbeitsblätter in Klasse 10 (Abschnitt 6, entschieden in D-012).

---

## 2. Zielstruktur des Repos

```
denkraum/
  apps/
    web/                       Next.js-PWA: Shell, Login, Modul-Routing, Ansicht für Lehrkraft und Eltern
  packages/
    core/                      gemeinsame Typen: Schulart, Niveau, Modul-Manifest
    db/                        Drizzle-Schema der Plattform, Migrations (Postgres, lokal PGlite), Löschjob
    llm/                       Gateway-Client, Tier-Routing, Prompt-Loader, Schema- und Zitatprüfung, Mock
    capture/                   Foto-Pipeline: EXIF und GPS entfernen, skalieren, mehrseitig, Upload
    print/                     A4-Druckvorlagen: Blatt-ID, QR-Code, kein Namensfeld
    game/                      generische Bausteine: XP, Abzeichen, Streak, Fortschrittskarte (reine Funktionen)
    privacy/                   Pseudonyme, Codes, Fristen, Bild-Metadaten entfernen, Identitätsprüfung für Prompts
    ui/                        gemeinsame Komponenten, Design-Tokens, Texte (i18n/de)
  modules/
    gesamtschule/
      klasse-07/deutsch-schreibwerkstatt/     Workstream B
      klasse-10/mathematik-trigonometrie/     Workstream A
    gymnasium/
      klasse-11/                              noch leer
  infra/                       Docker Compose (app, postgres, minio), Deployment
  docs/
  DECISIONS.md
```

Jedes Modul ist ein pnpm-Workspace-Paket mit festem Aufbau:

```
<modul>/
  module.ts        Manifest: id, schulart, klasse, fach, niveaus, geraete, offline, llmTiers, aufbewahrung
  SPEC.md          fachliche Spezifikation (Quelle der Wahrheit für das Modul)
  DECISIONS.md     Entscheidungen des Moduls
  content/         Lektionen, Aufgaben, Missionen, Hilfskarten (JSON oder MDX, mit zod validiert)
  domain/          reine Fachlogik ohne I/O (A: solutions, verify; B: rules, state)
  prompts/         versionierte Prompts <name>.v<N>.md
  schemas/         zod-Schemas
  ui/              modulspezifische Komponenten
  db.ts            modulspezifische Tabellen (Präfix je Modul)
  tests/
```

`apps/web` bindet Module über eine Registry ein (Routen unter `/m/<modul-id>/...`). Ein Workstream muss `apps/web` daher kaum anfassen.

Geräte nach Klasse:

| Klasse | Verzeichnis | Geräte in der Schule | Folge |
|---|---|---|---|
| 7 | `gesamtschule/klasse-07` | keine | Papier zuerst; Upload über ein Gerät zu Hause oder das Gerät der Lehrkraft |
| 10 | `gesamtschule/klasse-10` | iPads | PWA auf dem iPad, Foto-Upload mit der iPad-Kamera |
| 11 | `gymnasium/klasse-11` | iPads | noch kein Modul |

---

## 3. Die beiden Specs zusammenführen

| Thema | Spec A (Trigonometrie) | Spec B (Schreibwerkstatt) | Empfehlung |
|---|---|---|---|
| Framework | Next.js App Router, TypeScript, Tailwind | Next.js App Router, TypeScript | Next.js, TypeScript, Tailwind; eine App für beide Module |
| Paketmanager | offen | pnpm | pnpm-Workspaces |
| ORM | Drizzle, Postgres-Migrations Pflicht | Prisma, aber "bestehenden Stack verwenden" (B 0) | Drizzle. B erlaubt das ausdrücklich; die Prisma-Modelle aus B 8 werden in Drizzle übersetzt. |
| LLM-Zugriff | Provider-Interface mit Anthropic SDK, OpenAI-kompatibel, Mock (A 6.7) | LiteLLM-Gateway, Vercel AI SDK `generateObject`, Tiers `vision`, `hard`, `light` (B 7.5) | Ein Paket `llm` mit einer Funktion `generateStructured({ tier, prompt, schema, images })`. Standard-Adapter ist ein OpenAI-kompatibles Gateway (LiteLLM), dazu ein direkter Anthropic-Adapter und ein Mock. Module wählen nur das Tier, nie das Modell. |
| Prompts | im Spec-Text (A 6.5, 6.6) | versionierte Dateien, Version wird am Feedback gespeichert (B 7.3) | Variante B für beide Module |
| Offline | Lektionen offline, Serwist (A 8) | kein Offline in v1 | Serwist in der Plattform; Offline je Modul per Manifest-Flag |
| Druck | A4-Druckansicht und `/print`-Route | `@react-pdf/renderer`, serverseitig | Ein Paket `print` mit serverseitigem PDF. Formeln auf Arbeitsblättern als Unicode (sin α, α², sin⁻¹, √); KaTeX nur am Bildschirm. In Klasse 10 wird das Blatt am iPad gezeigt und auf Papier gelöst (D-012); PDF bleibt optional, für Spec B (Druck zu Hause) Pflicht. |
| Login | Klassencode und selbst gewähltes Pseudonym; Lehrkraft per Magic-Link | Zugangscode und Spitzname; Lesecode für Erwachsene | Ein Modell: Gruppe (Klasse oder Einzelpilot) mit Code; Lernende mit systemgenerierten Pseudonymen; Betrachtende (Lehrkraft, Eltern) mit Lesecode; Magic-Link nur für Lehrkräfte. LTI 1.3 und VIDIS später. |
| Foto-Aufbewahrung | 14 Tage | 180 Tage | Plattformweit 14 Tage; Abweichung nur begründet im Modul-Manifest (Abschnitt 5.2) |
| Foto-Auflösung | 1600 px, unter 500 KB | 2000 px | Plattform-Standard 1600 px; B darf für mehrseitige Fließtexte auf 2000 px erhöhen |
| Spiel | Punkte, Abzeichen, Streak, keine Ranglisten | Sterne, XP, Schlüssel, Hilfskarten, Joker, Abzeichen, Streak | Gemeinsamer Kern in `packages/game`; modulspezifische Regeln als reine Funktionen im Modul (`domain/`) |
| Protokoll | `Event`-Tabelle mit Tokens, Latenz, Kosten; Langfuse optional | Promptversion je Feedback; Langfuse (EU) optional | Eine Tabelle `llm_call` mit Modul, Modell, Promptversion, Tokens, Latenz, Kosten, ohne Inhalte. Langfuse standardmäßig aus; wenn an, dann selbst gehostet. |
| Tests | Vitest, Playwright | Vitest, Playwright | gleich; CI läuft immer mit Mock-Provider |
| Betrieb | Docker Compose (app, postgres, minio) | Docker Compose | ein gemeinsames `infra/docker-compose.yml` |

---

## 4. Phasen und Parallelisierung

```
Schritt  Plattform (gemeinsam)            Workstream A: Mathematik 10         Workstream B: Deutsch 7
1        P0 Gerüst                        A0 Fachlogik ohne Plattform         B0 Fachlogik ohne Plattform
2        P1 Foto-Pipeline und Druck       A1 Lektion 4 als Durchstich         B1 Mission m-04-01, getippt
3        P2 Erwachsenen-Ansicht, PWA,     A2 Lektionen 1 bis 7, Aufgabenbank  B2 Handschrift (nutzt P1)
            Löschjobs, Export
4                                         A3 Spiel, Lehrkraft-Ansicht         B3 bis B7 laut Spec B 11
```

**P0 Plattform-Gerüst** (eine Sitzung, bevor sich die Workstreams aufteilen). Enthält den Plattformteil von Spec A Phase 1 und Spec B Phase 0.

- Monorepo, Next.js-Shell, Drizzle-Schema der Plattform (Gruppen, Lernende, Betrachtende, Uploads, Transkripte, `llm_call`, Aufbewahrungsfristen)
- Paket `llm` mit Mock und Gateway-Adapter, Prompt-Loader mit Versionen
- Code-Login mit generiertem Pseudonym
- Docker Compose, CI (Lint, Typecheck, Vitest)
- die Datenschutz-Tests aus Abschnitt 5.2

DoD:
- `pnpm dev` und `docker compose up` laufen.
- Login per Code funktioniert auf iPad und Smartphone.
- CI ist grün, ohne API-Schlüssel.

**A0 und B0, parallel zu P0.** Reines TypeScript in `domain/`, nur mit Vitest, ohne Datenbank und ohne UI.

A0:
- `solutions.ts`, `verify.ts`, Fehlerkatalog F1 bis F13, Parameter-Generator mit Mehrdeutigkeitsprüfung (Abschnitt 6)
- Task-Schema mit zod
- Alle Werte aus A 4.2 als Tests (bereits nachgerechnet, Abschnitt 6)

B0:
- `rules.ts` mit den Regeln aus B 3.2 und 3.3
- `state.ts` mit der State Machine aus B 4
- zod-Schemas aus B 7.4
- P1 bis P5 als Prompt-Dateien
- `content/missions.json`, `help_cards.json`, `checklists.json`

**Zuordnung zu den Spec-Phasen:**
- A0 und A1 entsprechen Spec A Phase 1, A2 entspricht Phase 2, A3 entspricht Phase 3.
- B0 entspricht Spec B Phase 0 ohne den Plattformteil, der nach P0 wandert. B1 bis B7 entsprechen Spec B Phasen 1 bis 7.
- Die Foto-Pipeline baut die Plattform einmal (P1). A braucht sie zuerst (A1), B ab B2.

**Zusammenarbeit**

- Je Workstream ein Branch und eine eigene Claude-Code-Sitzung. Die Sitzung startet im Modulverzeichnis mit `SPEC.md` als Auftrag.
- Plattform-Änderungen nur als eigene kleine PRs, nie im Modul-PR versteckt.
- Plattformweite Entscheidungen in `/DECISIONS.md`, Modulentscheidungen in `<modul>/DECISIONS.md`.
- Beide Specs verlangen Rückfragen vor dem Start (A 15, B 0). Die gemeinsamen Fragen stehen in Abschnitt 8. Modulspezifische Fragen (B 12) bleiben beim jeweiligen Workstream.

---

## 5. Datenschutz und KI-Recht

Die verbindlichen technischen Leitplanken stehen in [datenschutz/README.md](datenschutz/README.md). Hier die Befunde aus beiden Specs.

### 5.1 Was beide Specs schon gut machen

- Pseudonyme statt Klarnamen, kein Namensfeld auf Bögen
- EU-Hosting, Fotos mit Löschfrist
- keine Noten, keine Ranglisten, kein offener Chat, kein Tracking durch Dritte
- Spec A: Der Code entscheidet über richtig oder falsch, das Sprachmodell transkribiert und formuliert nur (A 2.5).

### 5.2 Lücken, die die Plattform schließen sollte

1. **Das Repository ist öffentlich.**
   - Spec A sieht Testfotos unter `fixtures/photos/` vor, Spec B ein Golden Set unter `eval/golden/`. Auch die Handschrift von Testschreibern ist ein personenbezogenes Datum.
   - Regel: Im Repo liegen nur synthetische Fixtures oder Bilder mit ausdrücklicher Freigabe. Golden Set und Eval-Berichte liegen außerhalb des Repos; `.gitignore` ist entsprechend vorbereitet.
2. **Transkripte und Feedback haben keine Frist.**
   - Spec A: "die Transkription bleibt" (A 6.1). Spec B: "nie überschrieben", Bilder 180 Tage (B 0, 6.5).
   - Art. 5 Abs. 1 lit. e DSGVO verlangt eine Begrenzung der Speicherdauer.
   - Vorschlag:
     - Fotos 14 Tage plattformweit, Löschung auf Knopfdruck jederzeit.
     - Transkripte, Feedback und Fortschritt bis zum Ende des Schuljahres oder des Pilots. Vorher können Lehrkraft oder Eltern sie exportieren.
     - Löschung je Pseudonym jederzeit.
   - "Nie überschreiben" in Spec B bleibt als Versionierung erhalten; Löschen muss trotzdem vollständig möglich sein.
   - Das Portfolio in Spec B Phase 6 zeigt Bilder. Es soll mit Transkripten statt Bildern arbeiten, sonst braucht B die 180 Tage.
3. **Selbst gewählte Pseudonyme** (A 5.1, B 7.6). Kinder wählen häufig ihren echten Namen. Vorschlag: Die Plattform erzeugt Pseudonyme (zum Beispiel "Blauer Falke 42"). Die Zuordnung zu echten Namen führt die Lehrkraft außerhalb des Systems.
4. **Standort im Foto.** Handyfotos enthalten oft GPS-Koordinaten in den EXIF-Daten.
   - Die clientseitige Neukodierung (A 5.5, B 6.1) entfernt sie nur, wenn sie über Canvas neu kodiert.
   - Der Server prüft zusätzlich und entfernt verbleibende Metadaten, denn es gibt Fallback-Uploads ohne Neukodierung.
   - Beides wird getestet.
5. **Prompts ohne Identität technisch erzwingen.** Beide Specs verlangen: keine Pseudonyme oder Codes in Prompts (A 11, B 7.6). Vorschlag: Prompt-Builder nehmen nur einen Eingabetyp ohne Identitätsfelder entgegen. Ein Test prüft jeden Prompt auf Pseudonym, Code und Gruppen-ID.
6. **Modellanbieter.**
   - Nur EU-Endpunkte mit Auftragsverarbeitungsvertrag und ohne Nutzung der Daten zum Training.
   - Claude zum Start über die EU-Region eines Cloud-Anbieters (zum Beispiel AWS Bedrock oder Google Vertex AI). Die Verfügbarkeit des Modells in der Region muss je Modell geprüft werden.
   - Offene Modelle selbst gehostet, passend zur Ausrichtung "lokal" des Projekts.
   - Das Transkriptions-Tier wechselt erst auf ein lokales Modell, wenn es auf dem Golden Set ausreicht (wie in B 7.5).
7. **Logs und Tracing.** Kein Schülertext, kein Bild und kein Prompt-Inhalt in Anwendungslogs. Server-Logs mit gekürzter IP-Adresse und kurzer Frist. Tracing (Langfuse) standardmäßig aus.
8. **Schutzkonzept.**
   - Texte von 12-Jährigen können Hinweise auf Mobbing, Gewalt oder Selbstverletzung enthalten. Spec B sieht ein Flag `inappropriate` und einen Hinweis an den Erwachsenen vor (B 7.6).
   - Nötig ist ein festgelegter Ablauf: Wer erfährt was, wie schnell? Das wird mit der Schule abgestimmt (zum Beispiel mit der Beratungslehrkraft).
   - Spec A braucht denselben Mechanismus nicht.
9. **Rollen und Rechtsgrundlage.** Die Antwort hängt davon ab, wer die App einsetzt:
   - Setzt die Schule die App im Unterricht ein, ist sie Verantwortliche, der Betreiber ist Auftragsverarbeiter, und ein Auftragsverarbeitungsvertrag ist nötig.
   - Spec B v1 läuft nur als Pilot zu Hause (D-011). Dafür ist nach Entscheidung des Projekts keine Einwilligung nötig; das gilt nur, solange es um die eigene Familie geht.
   - Eine Datenschutz-Folgenabschätzung ist wegen KI-Auswertung von Daten Minderjähriger sehr wahrscheinlich erforderlich.
   - Beide Specs verweisen auf vorhandene Unterlagen (Elternschreiben, AVV, DSFA) im Projektbericht. Diese gehören zum Modul, aber nicht in dieses öffentliche Repo, sofern sie Kontaktdaten enthalten.

### 5.3 KI-Verordnung (EU) 2024/1689 und Vorgabe des Kultusministeriums

Die rechtliche Einordnung bleibt Aufgabe der Schule und ihrer Datenschutzbeauftragten. Für die Architektur sind diese Punkte maßgeblich:

- **Hochrisiko-Bereich Bildung.** Anhang III Nr. 3 lit. b nennt KI-Systeme, die Lernergebnisse bewerten, auch wenn diese Ergebnisse den Lernprozess steuern. Lit. c nennt Systeme, die das angemessene Bildungsniveau einer Person bewerten.
- **Zeitplan.** Durch die Verordnung (EU) 2026/1744 (Digital Omnibus, in Kraft seit 27. Juli 2026) gelten die Hochrisiko-Pflichten für Anhang-III-Systeme ab dem 2. Dezember 2027. Ein Pilot ist heute also noch nicht betroffen, aber die Architektur sollte jetzt so gebaut werden, dass sie es später nicht wird.
- **Ausnahme nach Art. 6 Abs. 3.** Ein System ist nicht hochriskant, wenn es nur eine eng begrenzte Verfahrensaufgabe oder eine vorbereitende Aufgabe erfüllt und das Ergebnis nicht wesentlich beeinflusst.
  - Die Einschätzung muss dokumentiert und das System registriert werden (Art. 6 Abs. 4, Art. 49 Abs. 2).
  - Achtung: Systeme, die Profiling betreiben, sind immer hochriskant. Ob Fortschritts- und Fehlertyp-Profile je Pseudonym als Profiling gelten, ist rechtlich zu prüfen.
- **Transparenz nach Art. 50 (gilt seit 2. August 2026).** Wer direkt mit einer KI interagiert, muss das erfahren. Deshalb wird jede KI-formulierte Rückmeldung sichtbar als solche gekennzeichnet.
- **Vorgabe des Kultusministeriums Baden-Württemberg.** "KI-Anwendungen [dürfen] keine Noten vergeben oder andere wesentlichen schulischen Entscheidungen treffen." Die abschließende Bewertung bleibt bei den Lehrkräften (gestützt auf § 115b Abs. 9 SchG in Verbindung mit § 6 DUVO).

Folgen für die Module:

- **Spec A passt gut.**
  - Das Sprachmodell transkribiert (vorbereitend) und formuliert. Richtig oder falsch und die Freischaltungen bestimmt deterministischer Code. Der Transkriptions-Check durch die Schülerin oder den Schüler ist eine zusätzliche menschliche Kontrolle.
  - Empfehlung: diese Trennung als harte Plattformregel festschreiben und die Einschätzung nach Art. 6 Abs. 3 früh dokumentieren.
- **Spec B muss angepasst werden.**
  - Heute vergibt das Sprachmodell Sterne je Rubrikdimension (B 7.1, P4). Diese Sterne entscheiden über "Mission bestanden", "Nächste Stufe", den E-Pfad und den Boss (B 2.4, 3.2). Damit bewertet die KI Lernergebnisse und steuert den Lernprozess, und der E-Pfad berührt die Niveau-Zuordnung.
  - Vorschlag:
    - Freischaltungen nur nach nachprüfbaren Kriterien, die Code prüft: bestätigtes Transkript, Mindestlänge, Selbstkontrolle erledigt, Überarbeitungsaufgabe erledigt, Zitate der Textlupe als exakte Teilstrings gefunden.
    - KI-Sterne bleiben formative Rückmeldung, ohne Torwirkung.
    - Den E-Pfad schaltet ein Mensch frei (Lehrkraft oder Elternteil), auf Vorschlag des Systems.
    - Dimension D (Richtigkeit) wird regelbasiert gezählt (Abschnitt 7).
  - Der Sternverlauf je Dimension für Erwachsene (B Phase 6) wirkt wie eine Benotung. Er sollte mit der Vorgabe des Kultusministeriums abgeglichen oder als Selbsteinschätzung neben der KI-Rückmeldung dargestellt werden.

Quellen:

- KI-Verordnung: https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202401689
- Digital Omnibus: https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601744
- Kultusministerium Baden-Württemberg: https://km.baden-wuerttemberg.de/de/schule/digitalisierung/kuenstliche-intelligenz-im-unterricht

---

## 6. Fachliche Befunde zu Spec A (Trigonometrie)

1. **Alle Beispielwerte aus A 4.2 stimmen.** Nachgerechnet:

   | Aufgabe | Werte |
   |---|---|
   | L1-A1 | 7,5 / 10 / 12,5 cm; Verhältnis 0,6 |
   | L1-A2 | 9 m |
   | L3-A1 | 0,5 / 1 / 0,5 / 0,7071; RAD-Wert von sin 30: -0,988 |
   | L4-A2 | a = 4,5886, b = 6,5532; Pythagoras 64,00 (mit gerundeten Werten 63,97); RAD-Fehlweg a = -3,4255 |
   | L4-A3 | 7,660 |
   | L5-A1 | 30,964° / 59,036°; F2 ergibt 59,036° |
   | L5-A2 | 36,870° |
   | L6-A1 | 31,243 + 1,6 = 32,843 m |
   | L6-A2 | 72,542°, Höhe 3,8158 m (beide Wege) |
   | L6-A3 | 6,843° |

   4,6 statt 4,59 weicht 0,25 % ab und ist damit in der Toleranz (A 14).
2. **Mehrdeutige Parameter.** Ein Scan von L4-A2 über den ganzen Parameterbereich (α 25° bis 65°, c 6 bis 12 cm) zeigt zwei Probleme:
   - Bei α = 45° liefert der Fehler "cos statt sin" (F2, F3) dasselbe Ergebnis wie die richtige Lösung.
   - Bei 30°, 37°, 44°, 53°, 64° und 65° ist "zu früh gerundet" (F5, auf eine Dezimale) innerhalb von 1 % nicht vom richtigen Ergebnis zu unterscheiden.

   Vorschlag:
   - Der Generator verwirft jeden Seed, bei dem ein Fehlweg aus `expected_misconceptions` innerhalb der Toleranz der richtigen Lösung liegt. Das wird als Test für alle Templates festgeschrieben.
   - F5 wird über die transkribierten Zwischenwerte erkannt, nicht über das Endergebnis.
3. **Drucklogistik in Klasse 10.** Jede Schülerin und jeder Schüler bekommt eigene Zahlen (A 2.7), arbeitet aber am iPad ohne eigenen Drucker. Spec A sieht nur den Druck eines einzelnen Blatts durch die Lehrkraft vor (A 12). Möglichkeiten:
   - Die Lehrkraft druckt vor der Stunde einen Klassensatz: ein PDF mit allen Blättern, sortiert nach Pseudonym.
   - Das Blatt wird am iPad angezeigt, gelöst wird auf Blanko-Papier mit Blatt-Code.

   Entschieden: Anzeige am iPad, Lösung auf Blanko-Papier (D-012).
4. **iPads der Schule.** Spec A nennt das Smartphone für den Upload. In Klasse 10 ist das iPad das Hauptgerät; `capture="environment"` funktioniert dort. Mit der Schul-IT klären: Werden die iPads per MDM verwaltet, sind Domain und Kamera freigegeben, wird die App als Web-Clip verteilt?
5. **Bildungsplan-Codes sind korrekt.** Alle Codes aus A 1 wurden auf bildungsplaene-bw.de geprüft. Einschränkung: Teilkompetenz 7-8-9_03 (17), die Ähnlichkeitssätze, hat kein G-Niveau. Auf G wird L1 daher nur mit (16) und (18) getaggt; die Begründung über einen Ähnlichkeitssatz bleibt M und E vorbehalten (wie im E-Zusatz von L1-A2).
6. **Schulart.** Spec A spricht von einer Gemeinschaftsschule, Pilot ist die Staudinger Gesamtschule. Die Niveaus G, M und E mit der Fachschaft Mathematik abgleichen.

---

## 7. Fachliche Befunde zu Spec B (Schreibwerkstatt)

1. **Geräte.** Klasse 7 hat keine Schul-iPads. Das passt zum geplanten Pilot (ein Schüler, ein Erwachsener, Upload mit einem Gerät zu Hause). Für den Einsatz im Unterricht braucht es später eine Gerätelösung, zum Beispiel ein Gerät der Lehrkraft für den Upload.
2. **Dimension D (Richtigkeit) regelbasiert zählen.** Ein Sprachmodell zählt Fehler je 100 Wörter nicht reproduzierbar. Vorschlag:
   - ein selbst gehostetes LanguageTool (Open Source, läuft im eigenen EU-Server) auf dem bestätigten Transkript, unsichere Stellen `[?]` ausgenommen
   - Das folgt demselben Prinzip wie Spec A: Code zählt, KI formuliert.
   - Die Übereinstimmung mit der Lehrkraft wird auf dem Golden Set gemessen (B 7.7).
3. **Schwelle von 25 % Änderungsmenge** (B 3.4). Bei Handschrift von 12-Jährigen können auch ehrliche Korrekturen von Lesefehlern diese Schwelle überschreiten. Vorschlag: in v1 nur protokollieren und auf dem Golden Set kalibrieren, dann erst als Regel scharf schalten.
4. **Bildungsplan-Bezüge sind korrekt.** Geprüft wurden 3.2.1.2 (11), (21) und die zentralen Schreibformen (begründete Stellungnahme, lineare Erörterung). Auf E nennt der Bildungsplan das Toulmin-Schema nur als Beispiel ("z. B."); die Rubrik darf es nicht als Pflicht formulieren.
5. **Offene Entscheidungen aus B 12** bleiben beim Workstream B und werden mit der Deutschlehrkraft geklärt.

---

## 8. Offene Fragen

Beantwortet am 5. Oktober 2026, festgehalten in `DECISIONS.md`:

| Frage | Antwort | Entscheidung |
|---|---|---|
| 1. Klasse 11 | eigener Baum `gymnasium/` | D-010 |
| 2. Einsatzrahmen Schreibwerkstatt v1 | nur zu Hause, keine Einwilligung nötig | D-011 |
| 3. Arbeitsblätter Trigonometrie | am iPad anzeigen, auf Papier lösen | D-012 |
| 4. Modellbetrieb | zuerst Claude über eine EU-Region | D-013 |
| 5. Specs im Repo | Repo bleibt öffentlich, Specs bleiben außerhalb | D-008 |

Folgen der Antworten:

- **Zu 2:** Die Haushaltsausnahme (Art. 2 Abs. 2 lit. c DSGVO) trägt nur, solange es um die eigene Familie geht. Die technischen Leitplanken gelten trotzdem, damit der spätere Einsatz in der Klasse ohne Umbau möglich ist.
- **Zu 3:** Für Spec A fallen QR-Code und Pflicht-Druck weg. Das Blatt bleibt in der App geöffnet, der Upload hängt direkt daran. Auf dem Papier stehen nur der kurze Blatt-Code und die Aufgabennummern, damit die Transkription die Lösungen zuordnen kann. Der Hinweis "Skizze, Rechenweg, Antwortsatz mit Einheit, Aufgabennummer an jede Lösung" wird am Bildschirm gezeigt.
- **Zu 4:** Die Konfiguration erzwingt das (Abschnitt 9).

---

## 9. Stand und nächste Schritte

Umgesetzt am 5. Oktober 2026:

- **P0 Plattform-Gerüst:**
  - pnpm-Monorepo mit `packages/core`, `privacy`, `llm`, `db` und `apps/web` (Next.js 16)
  - Login per Code mit generiertem Pseudonym und persönlichem Code; Sitzungen speichern nur einen Hash des Tokens
  - Seiten für Datenschutz (Entwurf mit Platzhaltern) und Impressum
  - Sicherheits-Header mit Content-Security-Policy ohne Drittanbieter
  - Löschjob mit Fristen, Export und Löschung je Pseudonym
  - `generateStructured` mit Prompt-Versionen, Schemaprüfung, Identitätsprüfung, Protokoll ohne Inhalte; Bedrock nur in der EU, direkte API nur in der Entwicklung
  - Entfernen von Bild-Metadaten (EXIF, GPS)
  - CI mit Tests, Typecheck, Build und einer Prüfung auf lange Gedankenstriche
- **A0:** Fachlogik Trigonometrie in `modules/gesamtschule/klasse-10/mathematik-trigonometrie/domain/` (122 Tests), siehe Modul-README und Modul-DECISIONS. Offene Punkte für Spec A:
  - Spec 6.3 zeigt F1 mit `partially_correct`, die Regel "falscher Wert ergibt `incorrect`" widerspricht dem. Umgesetzt ist `incorrect`.
  - Der Fehlerkatalog überschneidet sich (F2 und F3, F3 und F8, F2 und F6). Einige Hinweistexte passen nur zu einer Aufgabe und haben jetzt Platzhalter.
  - F9 (rechter Winkel falsch angenommen) ist nicht erkennbar, weil die Transkription dafür keine Angaben liefert.
  - Der Startbestand aus Spec 4.2 erfüllt die Mindestzahl je Lektion (Spec 14 Nr. 3) noch nicht; das folgt in A2.
- **B0:** Fachlogik Schreibwerkstatt in `modules/gesamtschule/klasse-07/deutsch-schreibwerkstatt/` (134 Tests), siehe Modul-README und Modul-DECISIONS. Sterne steuern nichts; die Planfreigabe prüft Code nach Spec 7.2. Offene Punkte für Spec B:
  - Für Stufe 1 und 2 gibt es keine passende Rubrik; Rubrik 7.1 und die 80-Wörter-Regel passen dort nicht.
  - Planungsbogen-Kriterien (7.2) und Prompts P1/P2 passen nicht zur Absatz-Schablone auf Stufe 2.
  - Die Ansicht für Erwachsene braucht genau eine Schreibaktion: den E-Pfad freischalten (D-006 gegen "nur Lesezugang" in Spec B).
  - Der verdeckte Themenpool der Boss-Mission passt nicht in ein öffentliches Repo; die fünf Themen sind Platzhalter.
  - Für "keine Wiederholung in 10 Ziehungen" braucht jede Station mindestens 14 freigegebene Übungen; vorhanden sind 14 insgesamt.
  - Alle Inhalte sind `approved: false`, bis sie freigegeben sind.

Umgesetzt am 7. Oktober 2026:

- **Schreibwerkstatt, Spielschicht:** Die Fortschrittskarte ist ein Garten mit Gartenhaus, bewertet nach dem Octalysis-Modell. Der Garten welkt ohne Übung, stirbt aber nie, ruht in Ferien und an Wochenenden und liest keine KI-Ausgabe. Siehe `modules/gesamtschule/klasse-07/deutsch-schreibwerkstatt/docs/spielschicht.md` und Modul-DECISIONS SW-29 bis SW-36. Die Schreibwerkstatt wird ab jetzt auf einem eigenen Branch bis B7 gebaut; Änderungen an der Plattform kommen dort als eigene Commits mit dem Präfix `platform:`.
- **Schreibwerkstatt, B1:** Mission mit getipptem Text von Auftrag bis Abschluss, mit Eingangsfilter, P2, P4, P5 (Mock in Tests), Belohnungen und Fortsetzen nach Neuladen; Modul-DECISIONS SW-37 bis SW-44.

Als Nächstes:

1. **P1:** Foto-Pipeline im Browser (Neukodierung, Skalierung, mehrseitig), S3-Speicher in der EU, Upload-Route mit Metadaten-Prüfung, Transkriptions-Bestätigung als gemeinsame Komponente.
2. **A1:** Lektion 4 als Durchstich auf der Plattform, mit Arbeitsblatt am iPad (D-012).
3. **B1:** Mission m-04-01 mit getipptem Text.
4. **P2:** Ansicht für Lehrkraft und Eltern (Lesecode), PWA-Manifest und Offline, Container für die App.

---

## 10. Marktvergleich: Kiddom

Stand: 5. Oktober 2026. Grundlage sind die Website kiddom.co und Pressemitteilungen des Anbieters (Quellen in 10.7). Das Produkt wurde nicht selbst getestet.

### 10.1 Kurzprofil

- Kiddom ist eine US-Plattform für digitale Lehrwerke vom Kindergarten bis Klasse 12. Schulbezirke lizenzieren darüber Lehrwerke wie Illustrative Mathematics, EL Education oder OpenSciEd. Kiddom legt eine KI-Schicht darüber ("Learning Intelligence Technology").
- Nutzergruppen: Lehrkräfte, Schülerinnen und Schüler, Familien, Schul- und Bezirksleitung.
- Leitidee: "Digital forward. Human first." Die KI schlägt vor, die Lehrkraft entscheidet ("it never moves without the teacher", "No grade without you").
- Alle KI-Funktionen sind nur für Lehrkräfte zugänglich. Schülerdaten gehen nach Angabe des Anbieters anonymisiert an das Modell und werden nicht zum Training verwendet.
- Als Produkt für die Staudinger Gesamtschule keine Option:
  - Die Lehrwerke folgen US-Standards (Common Core, NGSS).
  - Die Oberfläche ist englisch und spanisch.
  - Die Datenschutzerklärung der Website nennt weder die DSGVO noch einen Speicherort in der EU.
- Als Vorbild für Abläufe ist Kiddom wertvoll, besonders für "Papier zuerst" und für die Rolle der Lehrkraft.

### 10.2 Funktionen im Überblick

| Funktion | Was sie tut | Bezug zu Denkraum |
|---|---|---|
| Atlas | Wertet die kurze Lernkontrolle am Stundenende aus (drei Aufgaben, "Cool-down"). Zeigt Fehlvorstellungen je Klasse und je Schülerin oder Schüler, schlägt Gruppen vor (auf Kurs, wiederholen, fördern, erweitern) und erzeugt Einstiegsaufgaben für die nächste Stunde. Die Lehrkraft verschiebt Gruppen, gibt weitere Versuche frei und korrigiert von Hand. Mathematik, Klassen 3 bis 8, ab Herbst 2026. | Fehlvorstellungen erkennt bei uns schon `verify()` mit dem Fehlerkatalog F1 bis F13, ohne Sprachmodell. Es fehlt die Auswertung je Klasse. |
| Paper Score | Die Lehrkraft fotografiert oder scannt Papierarbeiten als Stapel. Das System liest die Handschrift, bewertet nur geschlossene Formate (Auswahl, Lücke, Zahl), markiert unsichere Lesungen, statt zu raten, und zeigt das Original neben dem Ergebnis. Nichts wird ohne Freigabe der Lehrkraft übernommen; offene Antworten bewertet die Lehrkraft. | Entspricht der Foto-Pipeline (P1), aber den Upload macht die Lehrkraft, nicht die Lernenden. |
| Spotlight | Die Lehrkraft fotografiert während der Stunde eine Lösung auf Papier und zeigt sie ohne Namen am Beamer zur Besprechung. | neu |
| Kiddom Assistant | Nur für Lehrkräfte, direkt in der Lektion. Feste Aktionen: Aktivität erzeugen, in Teilschritte zerlegen, übersetzen, Lektion kürzen. Antworten nur aus dem lizenzierten Lehrwerk, ohne Internet. Ergebnisse landen als Entwurf und erreichen Lernende erst nach Vorschau und Zuweisung. | Muster für spätere Werkzeuge für Lehrkräfte |
| KI-Bewertung, KI-Feedback, Übungsgenerator | Die KI bewertet offene Antworten, schlägt Punkte und Rückmeldungen vor und erzeugt differenzierte Übungen. | Bewertung durch KI widerspricht D-006. Unser Generator arbeitet deterministisch. |
| KODA | Datenfragen der Bezirksleitung in natürlicher Sprache ("Welche 4. Klassen haben Probleme mit Brüchen?") | ohne Bedeutung für den Pilot |
| Cadence | Passt den Stoffverteilungsplan an Ferien und Ausfälle an. | Lektionen schaltet bei uns die Lehrkraft frei (D-017). |
| Bilingual View und Barrierefreiheit | Aufgaben englisch und spanisch nebeneinander; Vorlesen, auch von Formeln; Screenreader und Tastatur (WCAG 2.1 AA); Werkzeuge wie Taschenrechner und Geodreieck. | teilweise übernehmen |
| Ansicht für Lernende und Familien | Listen "Zu erledigen" und "Abgegeben", Kommentare an der einzelnen Aufgabe, Fortschritt an Lernzielen. Abgabe getippt, gezeichnet, als Audio, Video oder auf Papier. Familien sehen Aufgaben, Noten und Fortschritt. | weitgehend geplant (P2), aber ohne Noten |

### 10.3 Was Denkraum übernehmen kann

Alle Punkte sind Vorschläge. Was angenommen wird, kommt als Entscheidung in `DECISIONS.md`.

**K1. Fehlerbild der Klasse** (nach Atlas)
- Die Ansicht für Lehrkräfte zeigt je Lektion und Aufgabe, wie oft welcher Fehlertyp (F1 bis F13) vorkam und bei welchen Pseudonymen.
- Die Daten entstehen schon heute in `verify()`. Kein Sprachmodell nötig.
- Phase P2 (Ansicht für Lehrkräfte). Aufwand klein.

**K2. Kurze Lernkontrolle am Ende jeder Lektion** (nach Atlas, "Cool-down")
- Zwei oder drei Aufgaben als festes Element jeder Lektion. Sie liefern die Daten für K1, K3 und K4.
- Mit der Fachschaft Mathematik abstimmen; die Aufgaben kommen aus der Aufgabenbank.
- Phase A2. Aufwand klein, vor allem Inhalt.

**K3. Einstiegsaufgabe zum häufigsten Fehler** (nach Atlas)
- Für die nächste Stunde wählt der Code aus der Aufgabenbank eine Aufgabe, deren `expected_misconceptions` den häufigsten Fehlertyp der Klasse enthält, mit neuen Zahlen aus dem Generator. Die Lehrkraft entscheidet, ob sie sie einsetzt.
- Kein Sprachmodell nötig; die Mehrdeutigkeitsprüfung des Generators gilt weiter.
- Voraussetzung: Aufgabenbank (A2). Phase A3. Aufwand mittel.

**K4. Gruppenvorschlag mit Freigabe durch die Lehrkraft** (nach Atlas)
- Der Code ordnet nach festen Regeln zu, zum Beispiel "weiter", "üben: F2" oder "Erweiterung (E)". Die Lehrkraft verschiebt Lernende und bestätigt.
- KI-Verordnung: Gruppen, die den Lernprozess steuern, fallen unter Anhang III Nr. 3 lit. b. Deshalb nur ein Vorschlag per Code; die Entscheidung trifft die Lehrkraft, und die Einschätzung nach Art. 6 Abs. 3 wird dokumentiert. Die offene Frage zum Profiling (Abschnitt 5.3) betrifft diesen Punkt direkt.
- Erweitert die Aktionen des Lehrkraft-Codes (D-017). Phase A3. Aufwand mittel.

**K5. Korrektur durch die Lehrkraft** (nach Atlas)
- Die Lehrkraft kann das Ergebnis von `verify()` überstimmen und einen weiteren Versuch freigeben. Jede Korrektur wird mit kurzer Begründung protokolliert.
- Das stärkt die menschliche Aufsicht (Art. 14 KI-Verordnung) und D-006. Gehäufte Korrekturen zeigen Lücken im Fehlerkatalog, zum Beispiel bei F9.
- Erweitert die Aktionen des Lehrkraft-Codes (D-017). Phase P2. Aufwand klein bis mittel.

**K6. Unsichere Stellen markieren, Original daneben** (nach Paper Score)
- Die Transkription markiert unsichere Lesungen (`[?]` wie in Spec B), statt zu raten. Im Bestätigungsschritt steht das Foto neben dem Transkript, die markierten Stellen sind hervorgehoben.
- Gehört in die gemeinsame Bestätigungskomponente beider Module.
- Phase P1. Aufwand klein.

**K7. Stapel-Upload durch die Lehrkraft** (nach Paper Score)
- Klasse 7 hat keine Schulgeräte (Abschnitt 7, Punkt 1). Die Lehrkraft fotografiert die Blätter der Klasse mit einem Gerät; die Zuordnung läuft über den Blatt-Code auf dem Papier (D-024). Das Transkript bestätigen die Lernenden später zu Hause oder die Lehrkraft.
- Auch ein Rückfallweg für Klasse 10, wenn iPads fehlen.
- Erst relevant, wenn die Schreibwerkstatt über den Pilot zu Hause hinausgeht (D-011). Dann ist zu klären, wie der Blatt-Code ohne Namen auf dem Papier eindeutig auf ein Pseudonym verweist; heute hängt die Zuordnung am Blatt, das in der App geöffnet ist (D-012).
- Phase nach B7. Aufwand mittel bis groß.

**K8. Lösungswege besprechen** (nach Spotlight)
- Die Lehrkraft wählt zwei oder drei Lösungen mit unterschiedlichen Fehlertypen und zeigt sie am Beamer, zum Beispiel einen richtigen Weg neben "Gegenkathete und Ankathete vertauscht".
- Anders als bei Kiddom wird das bestätigte Transkript gezeigt, nicht das Foto: Mitschülerinnen und Mitschüler erkennen Handschrift auch ohne Namen.
- Gezeigt werden nur Lösungen, die die Schülerin oder der Schüler zum Teilen freigegeben hat (Leitplanken, Abschnitt 4).
- Phase A3. Aufwand mittel.

**K9. Vorlesen** (nach der Barrierefreiheit bei Kiddom)
- Aufgabentexte, Hinweise und Rückmeldungen liest die Sprachausgabe des Geräts vor (Web Speech API).
- Nur Stimmen, die auf dem Gerät laufen (`localService`). Manche Stimmen in Chrome schicken den Text an Server von Google; das widerspräche den Leitplanken, Abschnitt 5.
- Formeln brauchen eine sprechbare Fassung ("Sinus von Alpha").
- Hilft schwächeren Leserinnen und Lesern, besonders in Klasse 7. Ziel für die ganze App: BITV 2.0 und WCAG 2.1 AA.
- Phase P2. Aufwand klein bis mittel.

**K10. Zweisprachige Aufgabentexte** (nach Bilingual View)
- Mathematik-Aufgaben zusätzlich in den häufigsten Herkunftssprachen der Klasse, neben dem deutschen Text.
- Übersetzt wird vorab und von Menschen geprüft, nicht live durch die KI.
- Nicht für die Schreibwerkstatt, deren Ziel das Schreiben auf Deutsch ist; dort höchstens für Hilfskarten.
- Mit der Schule klären, welche Sprachen gebraucht werden. Phase später. Aufwand mittel.

**K11. Kompetenzansicht nach Bildungsplan** (nach "Fortschritt an Lernzielen")
- Die Aufgaben der Trigonometrie tragen schon die Codes der Teilkompetenzen (A0). Lernende sehen je Teilkompetenz, was sie schon gezeigt haben, als Ich-kann-Sätze.
- Formativ, ohne Stufen oder Prozente, damit es nicht wie eine Note wirkt (Abschnitt 5.3). Für die Schreibwerkstatt gilt D-020: kein Sternverlauf.
- Teil der Fortschrittskarte in `packages/game`. Phase A3. Aufwand klein bis mittel.

**K12. Sachaufgaben entwerfen, für Lehrkräfte** (nach Kiddom Assistant)
- Feste Aktionen statt Chat, zum Beispiel "neue Sachaufgabe zu Lektion 6 entwerfen".
- Die KI entwirft nur den Sachkontext für ein vorhandenes Aufgaben-Template. Werte und Musterlösung berechnet der Code, einschließlich Mehrdeutigkeitsprüfung. Die Lehrkraft gibt frei.
- Im Prompt stehen nur Lektion, Template und Beispiele, keine Schülerdaten.
- Phase nach A2. Aufwand mittel.

**K13. "Wartet auf Sie"** (nach den Kiddom-Daten zur Rückmeldezeit)
- Die Ansicht für Erwachsene zeigt offene Aufgaben mit ihrem Alter: Freigabe von Niveau E, angefragte Korrekturen und weitere Versuche.
- Kiddom berichtet bessere Ergebnisse, wenn Lehrkräfte innerhalb von drei Tagen zurückmelden. Das sind Herstellerangaben ohne veröffentlichte Methodik. Die Richtung passt aber zu unserem Ablauf, in dem Menschen freigeben.
- Phase P2. Aufwand klein.

**K14. Freigabe von KI-Rückmeldungen vor der Anzeige** (Option, nach Kiddom Assistant)
- Kiddom zeigt Lernenden keine KI-Ausgaben. Denkraum tut das, aber nur geprüft und gekennzeichnet.
- Für den Einsatz der Schreibwerkstatt in der Klasse könnte eine Gruppe einstellen, dass KI-Rückmeldungen erst nach Durchsicht durch die Lehrkraft erscheinen.
- Das kostet Zeit der Lehrkraft und verzögert die Rückmeldung. Im Pilot zu Hause aus; für die Klasse mit der Deutschlehrkraft und im Schutzkonzept klären.
- Phase später. Aufwand mittel.

### 10.4 Was Denkraum nicht übernimmt

- **KI-Bewertung offener Antworten** (KI-Punkte, KI-Notenvorschläge): widerspricht D-006 und der Vorgabe des Kultusministeriums (Abschnitt 5.3).
- **Notenbuch und Noten für Familien:** keine Noten (Grundsatz 3 im README).
- **KODA, freie Datenfragen in natürlicher Sprache:** ein offener Chat über personenbezogene Daten. Widerspricht der Datenminimierung und "kein offener Chat"; für einen Pilot ohne Nutzen.
- **Abgaben als Audio oder Video:** Stimme und Bild der Kinder sind zusätzliche personenbezogene Daten. Vorerst nicht.
- **Taschenrechner in der App für die Trigonometrie:** Er würde F1 (Rechner nicht auf DEG) verdecken. Der Umgang mit dem eigenen Rechner gehört zum Lernziel (Lektion 3).
- **Cadence:** Lektionen schaltet die Lehrkraft frei (D-017). Eine automatische Stoffverteilung bringt im Pilot keinen Nutzen.
- **Werbe-Cookies und Dienste wie Meta oder HubSpot**, die die Datenschutzerklärung der Kiddom-Website nennt: ausgeschlossen durch die Leitplanken, Abschnitt 5.

### 10.5 Was Denkraum schon anders löst

- **KI für Lernende:** Kiddom hält alle KI-Funktionen von Lernenden fern. Denkraum zeigt KI-formulierte Rückmeldungen, aber schemageprüft, gekennzeichnet, ohne Chat und ohne Entscheidung (Leitplanken, Abschnitt 3).
- **Fehlvorstellungen:** Kiddom erkennt sie mit KI. Denkraum erkennt sie deterministisch über Musterlösungen mit Fehlwegen; das ist nachprüfbar und getestet.
- **Individuelle Zahlen:** Der Generator erzeugt für jede Schülerin und jeden Schüler eigene Werte und verwirft mehrdeutige.
- **Inhalte:** eigene Inhalte nach dem Bildungsplan Baden-Württemberg, offen unter Apache 2.0, statt lizenzierter Lehrwerke.
- **Hosting:** in Deutschland (D-016), Modellaufrufe nur in der EU (D-013).

### 10.6 Einordnung in die Phasen

| Phase | Vorschläge |
|---|---|
| P1 | K6 |
| P2 | K1, K5, K9, K13 |
| A2 | K2 |
| A3 | K3, K4, K8, K11 |
| später | K7, K10, K12, K14 |

Vor dem Bau zu entscheiden:
- K2: mit der Fachschaft Mathematik
- K4: Einschätzung nach KI-Verordnung, Frage zum Profiling
- K7: Einsatz der Schreibwerkstatt in der Klasse
- K10: welche Sprachen
- K14: mit der Deutschlehrkraft und im Schutzkonzept

### 10.7 Quellen

Abgerufen am 5. Oktober 2026:

- Startseite: https://www.kiddom.co/
- Atlas: https://www.kiddom.co/atlas
- Paper Score: https://www.kiddom.co/paper-score
- Spotlight: https://www.kiddom.co/spotlight
- Kiddom Assistant: https://www.kiddom.co/kiddom-assistant
- KODA: https://www.kiddom.co/koda
- Ansicht für Lernende: https://www.kiddom.co/student-experience
- Ansicht für Lehrkräfte: https://www.kiddom.co/teachers
- KI-Grundsätze: https://www.kiddom.co/kiddomai
- Datenschutzerklärung der Website: https://www.kiddom.co/privacy
- Neuerungen zum Schuljahr 2026/27: https://www.kiddom.co/insights/back-to-school-2026
- Pressemitteilung zu Atlas, 20. Februar 2026: https://www.businesswire.com/news/home/20260220676382/en/Kiddom-Launches-Atlas-the-First-AI-Powered-Instructional-Technology-Layered-on-High-Quality-Instructional-Materials

Wirkungsangaben des Anbieters, zum Beispiel "bis zu 18 % Zuwachs" mit Atlas, haben keine veröffentlichte Methodik und dienen hier nicht als Beleg.
