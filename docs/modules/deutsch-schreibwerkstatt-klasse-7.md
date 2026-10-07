# Schreibwerkstatt: Implementierungsplan

Modul für TeachingAssistant AI Lehrer. Fach Deutsch, Klasse 7, Gemeinschaftsschule (Pilot: Staudinger-Gesamtschule Freiburg), Niveau M mit Aufstieg nach E.
Stand: 5. Oktober 2026, Version 0.1.

---

## 0. Hinweise für Claude Code

- Dieses Dokument ist die Spezifikation. Umsetzung in den Phasen aus Abschnitt 11, in dieser Reihenfolge. Jede Phase endet mit der dort genannten Definition of Done und mit Tests.
- Vor jeder Phase: Plan-Modus, betroffene Dateien nennen, dann umsetzen. Nicht mehrere Phasen in einem Durchgang.
- Code, Bezeichner, Commits und Kommentare auf Englisch. Alle Texte, die Schüler, Eltern oder Lehrkräfte sehen, auf Deutsch: Du-Form für Schüler, Sie-Form für Erwachsene. Keine Gedankenstriche (em dash) in UI-Texten und Prompts. Deutsche Umlaute korrekt (ä, ö, ü, ß).
- Prompts liegen als versionierte Markdown-Dateien unter `prompts/` (Abschnitt 7.3). Jede Änderung ist ein Versionssprung, nie stilles Editieren. Die verwendete Promptversion wird mit jedem Feedback gespeichert.
- Spielregeln (Abschnitt 3) als reine Funktionen in `lib/game/rules.ts` mit Unit-Tests. Keine Spielregel im UI-Code.
- Alles, was ein Schüler erzeugt (Bild, Transkript, Text, Feedback), wird gespeichert und nie überschrieben. Revisionen sind neue Datensätze.
- Die Datenschutzregeln aus 7.6 sind harte Anforderungen.
- Wenn im Repo bereits ein Stack existiert, diesen verwenden; Abschnitt 9 ist der Vorschlag für den Fall, dass noch nichts steht.

---

## 1. Ziel, Zielgruppe, Nicht-Ziele

### 1.1 Ziel

Ein Schüler der Klasse 7 lernt, einen argumentierenden Text zu planen, zu schreiben und zu überarbeiten: zuerst die begründete Stellungnahme (Niveau M), dann die lineare Erörterung mit Gegenargument (Niveau E). Das Modul trainiert zwei Dinge zugleich:

1. Strukturiertes Denken: erst planen, dann schreiben. Wer keinen freigegebenen Plan hat, kann den Text nicht beginnen.
2. Besseres Formulieren: sprachliche Routinen (Textprozeduren) für Einleitung, Behauptung, Begründung, Beispiel, Überleitung, Schluss, statt Umgangssprache und unverbundener Sätze.

Der Schüler arbeitet gemischt: Planen und Schreiben auf Papier (Foto-Upload), Feedback, Mikroübungen und Fortschritt am Bildschirm. Klassenarbeiten sind handschriftlich; das Modul endet deshalb in einer handschriftlichen Prüfungssimulation.

### 1.2 Bildungsplan-Bezug

Bildungsplan 2016 Baden-Württemberg, Sekundarstufe I, Deutsch, Klassen 7/8/9 (Gemeinschaftsschule arbeitet mit den Niveaus G, M, E).

| Kompetenz | Niveau M | Niveau E | Im Modul |
|---|---|---|---|
| 3.2.1.2 (11) | Struktur eines einfachen Arguments untersuchen (Behauptung, Begründung, Beleg) | Struktur eines einfachen Arguments analysieren (vereinfachtes Toulmin-Schema: Behauptung, Begründung, Schlussregel) | Stufen 1 bis 3; E-Bonus "Schlussregel" in Stufe 6 |
| 3.2.1.2 (21) | Standpunkt des Verfassers bestimmen und bewerten | Thesen problematisieren und erörtern | Stufe 6 (Gegenargument, Erörterung) |
| 3.2.1.2 Zentrale Schreibformen | argumentierend: begründete Stellungnahme, lineare Erörterung, auch in adressatenbezogenen Formen | gleich | Missionstypen (Abschnitt 10.1) |
| 2.2 Schreiben (prozessbezogen) | Schreibplan erstellen; Thesen formulieren; Argumente mit plausibler Begründung formulieren und durch Belege, Beispiele stützen; Argumente zu einer Argumentationskette verknüpfen und gewichten; Gegenargumente formulieren, prüfen und einbeziehen; Schlussfolgerungen ziehen und begründet Stellung nehmen; Texte in angemessenem Zeitrahmen auch handschriftlich gut lesbar anfertigen; Texte inhaltlich und sprachlich überarbeiten | | Missionsablauf (Abschnitt 4), Rubrik (7.1), Boss-Mission |

Quellen in Abschnitt 13.

### 1.3 Nicht-Ziele (Version 1)

- Kein eigenes Rechtschreibmodul. Rechtschreibung ist eine Rubrikdimension, mehr nicht.
- Keine literarischen Schreibformen (Inhaltsangabe, Charakterisierung) in v1. Das Schema ist dafür vorbereitet (Feld `schreibform`), Inhalte folgen in v2.
- Kein vollständiges Lehrer-Dashboard, keine Klassenverwaltung. In v1: ein Schüler, ein Erwachsener mit Lesezugang.
- Kein Offline-Betrieb.
- Kein offener Chat. Der Schüler kann der KI keine freien Fragen stellen; jede KI-Interaktion ist an einen Schritt im Missionsablauf gebunden.

---

## 2. Didaktisches Design

### 2.1 Prinzipien

1. Phasen hart trennen (Planen, Formulieren, Überarbeiten). Jede Phase hat eine eigene Abgabe und ein eigenes Feedback.
2. SRSD-Logik (Self-Regulated Strategy Development): Strategie explizit machen (Merkhilfe), vormachen (Beispieltext auf Stufe 1 und 2), gestützt üben (Hilfskarten, Satzanfänge), Stützen abbauen (ab Stufe 4 keine Satzanfänge mehr), Selbstkontrolle (Checkliste vor dem KI-Feedback).
3. Textprozeduren statt Grammatikregeln: das Modul vermittelt Formulierungsroutinen pro Textteil (Abschnitt 10.2).
4. Die KI schreibt nie für den Schüler. Sie spiegelt, prüft gegen Kriterien, fragt, markiert und gibt genau eine Überarbeitungsaufgabe.
5. Feedback ist kurz, konkret und zitiert den eigenen Text des Schülers. Format "zwei Stärken, ein nächster Schritt". Keine Noten.
6. Papier für Planen und Schreiben, Bildschirm für Feedback, Mikroübungen und Fortschritt. Ausnahme: Stufe 1 und Stufe 5 (Überarbeiten) arbeiten mit Tastatur, weil dort einzelne Sätze bearbeitet werden.

### 2.2 Das Zielschema (begründete Stellungnahme, Niveau M)

```
Einleitung      Thema und Anlass nennen, eigenen Standpunkt (These) formulieren
Hauptteil       3 Argumente, jedes nach B-B-B:
                  Behauptung (Was behaupte ich?)
                  Begründung (Warum stimmt das?)
                  Beispiel oder Beleg (Woran sieht man das?)
                Reihenfolge: vom schwächsten zum stärksten Argument
                Jedes Argument ein eigener Absatz mit Überleitung
Schluss         Fazit, das den Standpunkt wiederholt, plus Appell oder Ausblick
                Kein neues Argument im Schluss
```

Erweiterung für Niveau E (lineare Erörterung mit Gegenargument):

```
Hauptteil zusätzlich   1 Gegenargument der anderen Seite nennen und entkräften
Schlussregel           Für das stärkste Argument beantworten: "Warum folgt aus der Begründung die Behauptung?"
Sprache                Überleitungen zwischen Absätzen, sachlicher Stil, Adressat direkt angesprochen
```

Merkhilfen, die überall im UI auftauchen:

- Vor dem Schreiben drei Fragen: Was meine ich? Warum? Woran sieht man das?
- B-B-B für jedes Argument.
- E-S-H-S für den Aufbau: Einleitung, Standpunkt, Hauptteil, Schluss.

### 2.3 Stufen (Skill-Leiter)

| Stufe | Name | Lernziel | Denkwerkzeug | Medium | Bildungsplan |
|---|---|---|---|---|---|
| 1 | Vom Gedanken zum Satz | eine klare Behauptung in einem Satz; Satz mit "weil" begründen | Warum-Kette (Behauptung, warum?, warum?) | Tastatur | 3.2.1.2 (11) M |
| 2 | Vom Satz zum Absatz | ein vollständiges B-B-B-Argument als Absatz | Absatz-Schablone (3 Kästen) | Papier, ein Absatz | 3.2.1.2 (11) M |
| 3 | Vom Absatz zum Plan | Standpunkt plus 3 Argumente planen, Reihenfolge begründen | Planungsbogen, Reihenfolge-Karten | Papier (Plan), Tastatur (Text) | 2.2 Schreibplan, Argumente gewichten |
| 4 | Der ganze Text | Stellungnahme mit Einleitung, 3 Argumenten, Schluss | Planungsbogen, Checkliste | Papier (Plan und Text) | Schreibform Stellungnahme M |
| 5 | Überarbeiten wie ein Profi | Verknüpfungen, Satzanfänge variieren, Wiederholungen tilgen, Umgangssprache ersetzen | Textlupe (markierter eigener Text) | Tastatur | 2.2 Texte überarbeiten |
| 6 (E) | Die andere Seite | Gegenargument nennen und entkräften, Schlussregel, lineare Erörterung | Pro/Contra-Tabelle, Toulmin-Frage | Papier | 3.2.1.2 (11) E, (21) E |
| Boss | Klassenarbeit | kompletter Text unter Zeitdruck ohne Hilfen | keines | Papier, 45 Minuten | 2.2 "in angemessenem Zeitrahmen handschriftlich" |

Jede Stufe hat 2 bis 3 Missionen und 1 bis 2 Mikroübungs-Stationen davor. Stufe 1 und 2 haben zusätzlich eine Vormach-Station: ein kurzer Beispieltext, in dem der Schüler die Teile (These, B-B-B) markiert, bevor er selbst schreibt.

### 2.4 Niveau-Logik (M als Basis, E als Aufstieg)

- Jeder Schüler startet auf M. Die Rubrik (7.1) bewertet M-Kriterien. E-Kriterien werden als "Bonus" angezeigt, aber nicht bewertet.
- E-Pfad freigeschaltet, wenn zwei Missionen der Stufe 4 in Folge mit mindestens 10 von 12 Sternen und ohne Dimension unter 2 abgeschlossen wurden. Dann: Stufe 6 sichtbar, E-Bonuskriterien werden bewertet (zusätzliche Sterne), Hilfskarte HK-07 (Gegenargument) wird angeboten.
- Der E-Pfad ist additiv. Ein Schüler, der auf M bleibt, hat trotzdem einen vollständigen Weg bis zur Boss-Mission.
- Niveau wird pro Schüler als Flag `niveau_e_enabled` gespeichert; die Lehrkraft oder der Erwachsene mit Lesezugang kann es in v1 nicht manuell setzen (v2).

---

## 3. Spielmechanik

### 3.1 Elemente

| Element | Bedeutung | Quelle |
|---|---|---|
| Sterne | 0 bis 3 je Rubrikdimension, maximal 12 je Mission | KI-Textfeedback, nach Überarbeitung aktualisiert |
| XP | Erfahrungspunkte für die Fortschrittskarte | Missionen, Mikroübungen, Streak |
| Schlüssel | Währung für Freischaltungen | Mikroübungen (1 Schlüssel je bestandener Station) |
| Hilfskarten | Satzanfänge, Beispielgliederung, Verknüpfungswörter | Kauf mit Schlüsseln oder Stufenaufstieg |
| Joker | zweiter KI-Feedback-Durchgang ohne Sternabzug | Kauf mit 2 Schlüsseln |
| Streak | Tage in Folge mit mindestens einer abgeschlossenen Station | Aktivität |
| Abzeichen | sichtbare Meilensteine | Regeln in 3.3 |
| Fortschrittskarte | Pfad mit Stationen, aktuelle Position, nächste Freischaltung | alles oben |

### 3.2 Unlock-Regeln (in `lib/game/rules.ts`, reine Funktionen)

| Regel | Bedingung |
|---|---|
| Mission startbar | vorhergehende Mikroübungs-Station bestanden (mindestens 1 Schlüssel vorhanden) und vorherige Mission der Stufe abgeschlossen |
| Mission abgeschlossen | Textfeedback erhalten, Überarbeitungsaufgabe erledigt (revision_check `fulfilled = true`) |
| Mission bestanden | mindestens 8 von 12 Sternen, keine Dimension bei 0 |
| Nächste Stufe | 2 Missionen der aktuellen Stufe bestanden |
| E-Pfad | siehe 2.4 |
| Hilfskarte freischalten | 1 Schlüssel; Karten der Stufe sind nach Stufenaufstieg kostenlos |
| Joker | 2 Schlüssel; maximal 1 Joker je Mission |
| Boss-Mission startbar | Stufe 5 abgeschlossen (M) oder Stufe 6 abgeschlossen (E) |
| Boss bestanden | mindestens 9 von 12 Sternen; auf E zusätzlich Gegenargument vorhanden |
| XP | Mission bestanden 100, abgeschlossen aber nicht bestanden 40, Mikroübung 15, Überarbeitung erledigt 20, Streak-Tag 10 |

### 3.3 Abzeichen

| Abzeichen | Regel |
|---|---|
| Planer | 3 Pläne beim ersten Versuch freigegeben |
| Behauptungs-Profi | 10 Behauptungen mit Begründung in Mikroübungen oder Missionen |
| Beispiel-Jäger | 3 Missionen, in denen jedes Argument ein Beispiel hat |
| Verknüpfer | Sprache-Dimension 3 Sterne in 2 Missionen |
| Überarbeiter | 5 Überarbeitungsaufgaben erledigt |
| Die andere Seite | erste Mission mit entkräftetem Gegenargument (E) |
| Durchhalter | Streak von 7 Tagen |

### 3.4 Gegen Ausnutzen

- Sterne gibt es nur für Uploads mit bestätigter Transkription (Abschnitt 6.4). Beim Bestätigen darf der Schüler Lesefehler korrigieren; die Änderungsmenge gegenüber dem Rohtranskript wird gespeichert (Zeichenabstand). Liegt sie über 25 Prozent, wird die Mission mit Hinweis "Bitte Foto neu aufnehmen" zurückgesetzt, Original bleibt gespeichert.
- Mikroübungen ziehen aus einem Pool; dieselbe Aufgabe erscheint frühestens nach 10 anderen wieder.
- Joker begrenzt (3.2). Ein Mission-Neustart ist jederzeit möglich, setzt aber die Sterne dieser Mission auf den besseren der beiden Durchgänge, nicht auf die Summe.
- Timer in der Boss-Mission läuft serverseitig.

### 3.5 Taktung

- Mission: 30 bis 40 Minuten, Boss 45 Minuten plus Upload.
- Mikroübungs-Station: 3 bis 5 Minuten.
- Empfohlener Rhythmus (im UI angezeigt): 2 Missionen und 3 Stationen pro Woche. Der Streak zählt Tage, nicht Minuten, damit kurze Sitzungen belohnt werden.

---

## 4. Missionsablauf (State Machine)

Zustände in `lib/mission/state.ts`. Übergänge nur über Guards, nie direkt aus dem UI.

| Zustand | Der Schüler sieht | Der Schüler tut | Das System tut | Übergang |
|---|---|---|---|---|
| `briefing` | Auftrag mit Adressat, Operator, Checkliste der Erfolgskriterien, Timer-Hinweis, Button "Planungsbogen drucken" | liest, druckt Bogen (oder nutzt Tastaturformular auf Stufe 1/3) | erzeugt Planungsbogen-PDF mit Missionscode | "Ich habe den Auftrag verstanden" |
| `planning` | Timer (7 min, weich), Erinnerung an die drei Fragen, Upload-Button | plant auf Papier, fotografiert | nichts | Upload abgeschlossen |
| `plan_uploaded` | "Ich lese deinen Plan", Spinner | wartet | Transkription (Prompt P1), Schema-Validierung | Transkript da |
| `plan_confirm` | Foto links, editierbare Felder rechts | prüft, korrigiert Lesefehler, bestätigt | speichert Roh- und bestätigtes Transkript, Änderungsmenge | bestätigt |
| `plan_feedback` | Spiegelung, Ampel der 5 Plankriterien, eine Frage | liest, antwortet auf die Frage im Textfeld (optional) | Plan-Review (Prompt P2) | `approved` true: weiter; false: `plan_revise` |
| `plan_revise` | Hinweis, was fehlt; Upload-Button für ergänzten Bogen | ergänzt auf Papier, fotografiert neu | zählt Runden (max 2), dann Freigabe mit Vermerk | zurück zu `plan_uploaded` oder nach 2 Runden `plan_approved` |
| `plan_approved` | "Plan freigegeben", Schreibbogen drucken, Hilfskarten der Stufe (falls freigeschaltet) | druckt, beginnt zu schreiben | erzeugt Schreibbogen-PDF | "Ich fange an zu schreiben" |
| `writing` | Timer (15 bis 20 min, weich; Boss: hart), Plan als Miniaturansicht, Upload-Button | schreibt auf Papier (oder tippt, Stufe 1, 3, 5) | nichts | Upload abgeschlossen (mehrseitig) |
| `text_uploaded` | Spinner | wartet | Transkription (Prompt P3) | Transkript da |
| `text_confirm` | Foto und Transkript nebeneinander | korrigiert Lesefehler, bestätigt | speichert, Änderungsmenge | bestätigt |
| `self_check` | eigener Text, Checkliste der Stufe, Markierwerkzeug | markiert These und Beispiele im eigenen Text, hakt Checkliste ab | speichert Selbsteinschätzung | abgeschickt |
| `ai_feedback` | Textlupe (markierte Teile), 4 Rubrikdimensionen mit Sternen, zwei Stärken, ein nächster Schritt, Überarbeitungsaufgabe | liest | Textfeedback (Prompt P4), vergleicht mit Selbsteinschätzung und zeigt Abweichungen | "Zur Überarbeitung" |
| `revision` | Überarbeitungsaufgabe, der betroffene Satz oder Absatz, passende Hilfskarte, Eingabefeld (Tastatur) oder Upload (Papier) | überarbeitet genau diese Stelle | Revision-Check (Prompt P5) | `fulfilled` true: weiter; false: ein zweiter Versuch, danach weiter mit Vermerk |
| `completed` | Sterne, XP, Schlüssel, Abzeichen, nächste Station | | aktualisiert Progress über `rules.ts` | Fortschrittskarte |

Weitere Regeln:

- Jeder Zustand ist wiederaufnehmbar; der Schüler kann die App schließen und später weitermachen.
- Timer sind weich (Hinweis, kein Abbruch), außer in der Boss-Mission.
- Stufe 1 und Stufe 5 überspringen `planning` bis `plan_approved` (keine Planphase, direkt kurze Schreibaufgabe mit Tastatur).
- Stufe 2 nutzt die Absatz-Schablone statt des Planungsbogens.
- Auf Stufe 3 wird der Plan auf Papier erstellt, der Text getippt (Fokus Plan).
- Ab Stufe 4 Plan und Text auf Papier.

---

## 5. Mikroübungen

Deterministisch, ohne LLM zur Laufzeit. Inhalte als JSON-Seeds, erzeugt über die Content-Pipeline (Claude Batch, Abschnitt 7.5) und von einer Deutschlehrkraft freigegeben.

| Typ | Aufgabe | Antwortformat |
|---|---|---|
| `sort_paragraphs` | Absätze eines kurzen Beispieltexts in die richtige Reihenfolge bringen | Drag and Drop, Reihenfolge |
| `pick_thesis` | Welche These passt zu diesen drei Argumenten? | Single Choice |
| `fill_connector` | Verknüpfungswort einsetzen ("Außerdem", "Deshalb", "Zwar ... doch") | Single Choice je Lücke |
| `rank_arguments` | Welches Argument ist das stärkste, und in welcher Reihenfolge? | Reihenfolge |
| `complete_bbb` | Was fehlt in diesem Argument: Behauptung, Begründung oder Beispiel? | Single Choice |
| `sentence_upgrade` | Umgangssprachlichen Satz durch sachliche Variante ersetzen | Single Choice |
| `mark_parts` (Vormach-Station) | In einem Beispieltext These, Behauptung, Begründung, Beispiel markieren | Mehrfachauswahl von Textspannen |

Schema (vereinfacht):

```json
{
  "id": "ex-0001",
  "type": "fill_connector",
  "stufe": 2,
  "niveau": "M",
  "prompt": "Setze das passende Verknüpfungswort ein.",
  "payload": {
    "text": "Handys lenken ab. ___ sollten sie in der Pause erlaubt sein, weil ...",
    "options": ["Trotzdem", "Deshalb", "Zum Beispiel"],
    "correct": 0
  },
  "explanation": "'Trotzdem' zeigt einen Gegensatz zwischen beiden Sätzen.",
  "tags": ["verknuepfung", "gegensatz"]
}
```

Bewertung clientseitig, Ergebnis serverseitig gespeichert. Eine Station besteht aus 4 Aufgaben; bestanden bei 3 von 4, Schlüssel wird gutgeschrieben. Nicht bestanden: Erklärungen anzeigen, neue Ziehung aus dem Pool.

---

## 6. Handschrift-Pipeline

### 6.1 Aufnahme

- PWA, `<input type="file" accept="image/*" capture="environment">`, mehrseitig.
- Clientseitig: EXIF-Rotation anwenden, lange Kante auf 2000 px skalieren, JPEG Qualität 0,8, Vorschau mit Hinweis "Blatt ganz im Bild, gutes Licht, von oben".
- Jede Seite wird einzeln hochgeladen, mit Seitennummer; Reihenfolge änderbar.

### 6.2 Druckvorlagen (vom System erzeugt, PDF, A4)

- Planungsbogen: Kopfzeile mit Missionscode (6 Zeichen) und Stufe, kein Namensfeld. Kästen: THEMA, MEIN STANDPUNKT, ARGUMENT 1 bis 3 (je Behauptung, Begründung, Beispiel), REIHENFOLGE (1 bis 3), SCHLUSS. Auf E zusätzlich GEGENARGUMENT (Einwand, Entkräftung).
- Absatz-Schablone (Stufe 2): drei Kästen B-B-B, darunter Linien für den Absatz.
- Schreibbogen: Linien, Rand, Kopfzeile mit Missionscode und Seitennummer.
- Boss-Bogen: Planungsbogen und zwei Schreibbögen in einem PDF.

Die Kästen erhöhen die Zuverlässigkeit der Transkription erheblich und sind die Struktur, die der Schüler verinnerlichen soll.

### 6.3 Transkription

- Vision-Modell mit strukturierter Ausgabe (Prompts P1, P3).
- Regel Nummer eins: wörtlich abschreiben, Fehler erhalten. Die Rechtschreibdimension der Rubrik braucht den Originalzustand.
- Unleserliches als `[?]`, Vermutungen als `[wort?]`.
- Ergebnis: Felder (Plan) oder Absätze (Text), plus `legibility` 0 bis 1 und Liste unsicherer Stellen.
- Bei `legibility` unter 0,5: Hinweis "Foto bitte neu aufnehmen" vor dem Bestätigungsschritt.

### 6.4 Bestätigung

- Foto und Transkript nebeneinander, Transkript editierbar, unsichere Stellen hervorgehoben.
- Der Schüler bestätigt mit "Ja, das steht da".
- Gespeichert werden Rohtranskript, bestätigtes Transkript, Änderungsmenge (siehe 3.4).
- Der Bestätigungsschritt ist selbst ein Lernmoment: der Schüler sieht seinen handschriftlichen Text getippt.

### 6.5 Speicherung

- Originalbilder in einem S3-kompatiblen Speicher in der EU, privater Bucket, signierte URLs mit kurzer Laufzeit.
- Aufbewahrung konfigurierbar (`IMAGE_RETENTION_DAYS`, Standard 180). Transkripte bleiben, Bilder werden durch einen Job gelöscht.
- Jede Datei ist einem `MissionRun` zugeordnet; keine Dateien ohne Zuordnung.

### 6.6 Fallbacks

- Tastatureingabe ist auf jeder Stufe als Notfallweg möglich (Flag `typed_fallback` am Upload, zählt als abgeschlossen, Mission wird aber mit Vermerk "getippt" gespeichert und bringt auf Stufe 4 und 6 maximal 10 Sterne).
- Transkription schlägt fehl: einmal erneut versuchen, dann Tastatur anbieten, Bild bleibt gespeichert.

---

## 7. KI-Feedback

### 7.1 Rubrik Stellungnahme, Klasse 7, Niveau M (0 bis 3 Sterne je Dimension)

**A Aufbau**
- 0: keine erkennbare Gliederung
- 1: Teile vorhanden, aber vermischt oder ohne Absätze
- 2: Einleitung, Hauptteil, Schluss erkennbar, Absätze gesetzt
- 3: wie 2, Einleitung nennt Thema und Standpunkt, Schluss zieht Fazit ohne neues Argument

**B Argumentation**
- 0: nur Meinung, keine Begründung
- 1: Behauptungen mit Begründung, aber ohne oder mit unpassenden Beispielen
- 2: mindestens 2 vollständige B-B-B-Argumente
- 3: 3 vollständige Argumente, Reihenfolge erkennbar begründet (stärkstes zuletzt), alle passen zum Standpunkt

**C Sprache und Formulierung**
- 0: Sätze unverbunden, überwiegend Umgangssprache
- 1: einige Verknüpfungswörter, viele Wiederholungen oder gleiche Satzanfänge
- 2: Argumente mit Textprozeduren eingeleitet, verschiedene Satzanfänge, überwiegend sachlich
- 3: flüssig, sachlich, Überleitungen zwischen Absätzen, Adressat angesprochen

**D Richtigkeit** (Rechtschreibung, Zeichensetzung, Grammatik; Fehler je 100 Wörter, aus dem bestätigten Transkript)
- 0: mehr als 8 Fehler, Verständnis gestört
- 1: 5 bis 8 Fehler
- 2: 2 bis 4 Fehler
- 3: 0 bis 1 Fehler

**E-Bonus** (nur bewertet, wenn `niveau_e_enabled`): bis zu 3 Zusatzsterne: Gegenargument genannt (1), Gegenargument entkräftet (1), Schlussregel für das stärkste Argument erkennbar (1).

Mindestlänge: unter 80 Wörtern wird nicht bewertet (`too_short`), der Schüler bekommt die Aufforderung, den Text zu vervollständigen.

### 7.2 Plan-Ampel (5 Kriterien, Prompt P2)

| Kriterium | grün | gelb | rot |
|---|---|---|---|
| P1 Standpunkt | klar formuliert | erkennbar, aber vage | fehlt |
| P2 Anzahl Argumente | 3 | 2 | 0 bis 1 |
| P3 Vollständigkeit | jedes Argument mit Begründung und Beispiel | Begründungen da, Beispiele fehlen teils | nur Stichwörter ohne Begründung |
| P4 Reihenfolge | markiert und sinnvoll | markiert | fehlt |
| P5 Schlussidee | notiert | angedeutet | fehlt |

Freigabe (`approved = true`): P1 grün oder gelb, und mindestens 2 Argumente mit Begründung. Alles andere: eine Revisionsrunde, maximal zwei.

### 7.3 Prompt-Dateien

Ablage: `prompts/<name>.v<N>.md`, Frontmatter mit `name`, `version`, `model_tier` (`vision`, `hard`, `light`), `output_schema` (Dateiname unter `schemas/`).

**P1 `plan_transcribe` (vision)**

```
Du bist ein Transkriptionsassistent. Du erhältst Fotos eines handschriftlichen Planungsbogens
eines Schülers der Klasse 7. Der Bogen hat beschriftete Kästen: THEMA, MEIN STANDPUNKT,
ARGUMENT 1, ARGUMENT 2, ARGUMENT 3 (jeweils mit Behauptung, Begründung, Beispiel),
REIHENFOLGE, SCHLUSS, auf manchen Bögen GEGENARGUMENT (Einwand, Entkräftung).

Aufgabe: Übertrage den Inhalt jedes Kastens wörtlich in das JSON-Schema.

Regeln:
1. Schreibe genau das, was dort steht, auch Rechtschreib- und Grammatikfehler. Korrigiere nichts.
2. Unleserliche Stellen markierst du mit [?]. Wenn du ein Wort nur vermutest, schreibst du es
   so: [wort?].
3. Leere Kästen gibst du als leeren String aus.
4. Durchgestrichenes lässt du weg.
5. Pfeile, Nummern und Stichworte überträgst du als Text (zum Beispiel "1.", "->").
6. Du bewertest nichts, fügst nichts hinzu und beantwortest keine Fragen, die auf dem Blatt stehen.
7. Gib legibility als Zahl zwischen 0 und 1 an (1 = alles sicher lesbar).

Antworte ausschließlich mit JSON nach dem Schema.
```

**P2 `plan_review` (light, bei Unsicherheit hard)**

```
Du bist Schreibcoach für einen Schüler der Klasse 7 an einer Gemeinschaftsschule, Niveau M.
Du bekommst den Schreibauftrag (Thema, Adressat, Operator) und den transkribierten Plan
des Schülers. Deine Aufgabe: Prüfe, ob der Plan tragfähig ist, bevor der Schüler schreibt.

Was du tust:
1. Spiegeln: Fasse in höchstens zwei Sätzen zusammen, was du als Standpunkt und Argumente
   verstanden hast. Beginne mit "So habe ich deinen Plan verstanden:".
2. Prüfen: Bewerte die fünf Plankriterien P1 bis P5 (Schema) mit gruen, gelb oder rot.
3. Eine Frage: Stelle genau eine Frage, die den Plan besser macht. Bevorzugt zur Reihenfolge
   oder zu einem fehlenden Beispiel. Keine Liste von Fragen.
4. Entscheiden: approved = true, wenn P1 nicht rot ist und mindestens zwei Argumente eine
   Begründung haben.

Was du nie tust:
- Du schreibst keine Argumente, Beispiele, Thesen oder Sätze für den Schüler, auch nicht
  als "zum Beispiel könntest du".
- Du schlägst kein anderes Thema vor.
- Du vergibst keine Note und lobst nicht pauschal ("super Plan").

Sprache: Deutsch, Du-Form, kurze Sätze, einfache Wörter. Spiegelung und Frage zusammen
höchstens 80 Wörter. Keine Gedankenstriche.

Antworte ausschließlich mit JSON nach dem Schema.
```

**P3 `text_transcribe` (vision)**

```
Du bist ein Transkriptionsassistent. Du erhältst Fotos eines handschriftlichen Textes
eines Schülers der Klasse 7, möglicherweise mehrere Seiten in Reihenfolge.

Aufgabe: Übertrage den Text wörtlich.

Regeln:
1. Schreibe genau das, was dort steht, auch Rechtschreib-, Zeichensetzungs- und
   Grammatikfehler. Korrigiere nichts, ergänze nichts.
2. Erhalte Absätze: Eine Leerzeile oder ein eingerückter Zeilenbeginn im Original wird
   zu einem neuen Element in paragraphs.
3. Unleserliche Stellen markierst du mit [?], Vermutungen als [wort?].
4. Durchgestrichenes lässt du weg. Nachträglich Eingefügtes (Pfeile, Sternchen) setzt du
   an die markierte Stelle.
5. Du bewertest nichts.
6. Gib legibility als Zahl zwischen 0 und 1 an und zähle die Wörter (word_count).

Antworte ausschließlich mit JSON nach dem Schema.
```

**P4 `text_review` (hard)**

```
Du bist Schreibcoach für einen Schüler der Klasse 7 an einer Gemeinschaftsschule, Niveau M
{{#if niveau_e_enabled}}mit Bonuskriterien auf Niveau E{{/if}}.
Du bekommst: den Schreibauftrag, den freigegebenen Plan, den bestätigten Text des Schülers
(Absätze), die Selbsteinschätzung des Schülers (Checkliste und markierte Stellen) und die
Rubrik mit Beschreibungen für 0 bis 3 Sterne je Dimension.

Was du tust, in dieser Reihenfolge:
1. Textlupe: Finde im Text die These, und für jedes Argument Behauptung, Begründung und
   Beispiel. Gib jede Stelle als wörtliches Zitat aus dem Text (exakter Teilstring) an.
   Was fehlt, lässt du leer.
2. Bewerten: Vergib je Dimension A bis D 0 bis 3 Sterne streng nach den Beschreibungen.
   Zähle für D die Fehler je 100 Wörter.
   {{#if niveau_e_enabled}}Bewerte zusätzlich die E-Bonuskriterien.{{/if}}
3. Zwei Stärken: Nenne zwei konkrete Stärken und zitiere dafür je eine Stelle aus dem Text.
4. Ein nächster Schritt: Nenne die eine Sache, die den Text am meisten verbessern würde.
5. Eine Überarbeitungsaufgabe: Wähle einen Satz oder Absatz (Zitat), formuliere eine
   konkrete Aufgabe für genau diese Stelle, und nenne die passende Hilfskarte (help_card_id
   aus der Liste). Die Aufgabe muss in 5 Minuten erledigbar sein.
6. Abgleich: Wenn die Selbsteinschätzung von deiner Bewertung abweicht, nenne das in einem
   Satz, ohne zu tadeln.

Was du nie tust:
- Du schreibst den Text oder Teile davon nicht neu, auch nicht als Vorschlag. Du zeigst
  höchstens einen Satzanfang von einer Hilfskarte.
- Du listest nicht alle Fehler auf. Rechtschreibung erwähnst du nur als Zahl und mit
  höchstens zwei Beispielwörtern.
- Keine Note, kein pauschales Lob, keine Floskeln.

Sprache: Deutsch, Du-Form, kurze Sätze, einfache Wörter. Alle für den Schüler sichtbaren
Felder zusammen höchstens 140 Wörter. Keine Gedankenstriche.

Wenn der Text unter 80 Wörtern hat oder nicht zum Auftrag passt, setze das Flag und gib
statt der Bewertung einen Satz, was fehlt.

Antworte ausschließlich mit JSON nach dem Schema.
```

**P5 `revision_check` (light)**

```
Du bist Schreibcoach für einen Schüler der Klasse 7. Du bekommst eine Überarbeitungsaufgabe,
die ursprüngliche Stelle (Zitat) und die überarbeitete Fassung des Schülers.

Entscheide, ob die Aufgabe erfüllt ist (fulfilled true oder false). Erfüllt heißt: Die
geforderte Änderung ist vorhanden und der Sinn ist erhalten. Kleinere neue Fehler sind
kein Grund für false.

Gib einen Satz Feedback (höchstens 25 Wörter), Du-Form, Deutsch, keine Gedankenstriche.
Bei false: sage, was genau noch fehlt, ohne die Lösung vorzugeben.

Antworte ausschließlich mit JSON nach dem Schema.
```

### 7.4 Ausgabeschemata (als zod unter `schemas/`)

```ts
// schemas/planTranscript.ts
type PlanTranscript = {
  thema: string;
  standpunkt: string;
  argumente: { behauptung: string; begruendung: string; beispiel: string }[]; // length 3
  reihenfolge: string;
  schluss: string;
  gegenargument?: { einwand: string; entkraeftung: string };
  legibility: number; // 0..1
  uncertain: string[];
};

// schemas/planReview.ts
type PlanReview = {
  mirror: string;                       // "So habe ich deinen Plan verstanden: ..."
  criteria: { P1: Ampel; P2: Ampel; P3: Ampel; P4: Ampel; P5: Ampel }; // "gruen" | "gelb" | "rot"
  question: string;
  approved: boolean;
  missing: string[];                    // kurze Stichworte für plan_revise
};

// schemas/textTranscript.ts
type TextTranscript = {
  paragraphs: string[];
  word_count: number;
  legibility: number;
  uncertain: string[];
};

// schemas/textReview.ts
type TextReview = {
  lens: {
    these: string;                      // exaktes Zitat oder ""
    argumente: { behauptung: string; begruendung: string; beispiel: string }[];
    gegenargument?: { einwand: string; entkraeftung: string };
  };
  scores: { aufbau: 0|1|2|3; argumentation: 0|1|2|3; sprache: 0|1|2|3; richtigkeit: 0|1|2|3 };
  e_bonus?: { gegenargument_genannt: boolean; gegenargument_entkraeftet: boolean; schlussregel: boolean };
  error_density: number;                // Fehler je 100 Wörter
  strengths: { text: string; quote: string }[]; // length 2
  next_step: string;
  revision_task: { instruction: string; target_quote: string; help_card_id: string };
  self_check_note: string;              // "" wenn keine Abweichung
  flags: { too_short: boolean; off_topic: boolean; inappropriate: boolean };
};

// schemas/revisionCheck.ts
type RevisionCheck = { fulfilled: boolean; feedback: string };
```

Alle Zitate (`quote`, `target_quote`, `lens.*`) müssen exakte Teilstrings des bestätigten Transkripts sein. Der Server prüft das; bei Nichttreffer wird das Feedback einmal neu angefordert, dann ohne Markierung angezeigt.

### 7.5 Modell-Routing

Konform mit der Architektur-Empfehlung des Projekts (OpenAI-kompatibles Gateway, Standard auf EU-gehosteten offenen Gewichten, harte Turns auf Claude Sonnet über EU-Endpunkt):

| Aufruf | Tier | Begründung |
|---|---|---|
| P1, P3 Transkription | `vision` (Claude Sonnet über EU-Endpunkt; später lokales VLM, sobald Genauigkeit auf dem Golden Set ausreicht) | Handschrift eines 12-Jährigen ist der schwierigste Schritt |
| P2 Plan-Review | `light` (EU open weights), Eskalation auf `hard`, wenn Schema-Validierung oder Zitatprüfung fehlschlägt | kurz, kriteriengeleitet |
| P4 Text-Review | `hard` | Aufsatzfeedback ist im Projekt als harter Turn definiert |
| P5 Revision-Check | `light` | binäre Entscheidung |
| Content-Pipeline (Mikroübungen, Beispieltexte, Missionsentwürfe) | Claude Batch, offline, Freigabe durch Lehrkraft | kein Schülerbezug, halber Preis |

Konfiguration über Umgebungsvariablen `MODEL_VISION`, `MODEL_HARD`, `MODEL_LIGHT`, `LLM_GATEWAY_URL`. Der Client-Code spricht nur das Gateway.

### 7.6 Datenschutz und Jugendschutz (hart)

- Keine Klarnamen im System. Schüler erhalten einen Zugangscode und wählen einen Spitznamen. Druckvorlagen haben kein Namensfeld; der Auftrag sagt ausdrücklich: "Schreib deinen Namen nicht auf das Blatt."
- In Prompts stehen nur Auftrag, Plan, Text, Rubrik. Nie Spitzname, Code, Geräte- oder Standortdaten.
- Bilder und Transkripte nur in EU-Speicher; Modellaufrufe mit Schülertext nur über EU-Endpunkte.
- Aufbewahrung der Bilder begrenzt (6.5).
- Eingangsfilter: Vor P2 und P4 läuft eine leichte Prüfung auf ungeeignete Inhalte (Flag `inappropriate`); bei Treffer kein Feedback, Hinweis an den Erwachsenen mit Lesezugang.
- Missionsthemen kommen aus einem kuratierten Pool (10.1); der Schüler kann kein freies Thema eingeben.
- Alle KI-Ausgaben werden vor Anzeige gegen das Schema geprüft; Freitextfelder werden auf Länge begrenzt.
- Das Elternschreiben und die Datenschutzunterlagen aus dem Projektbericht (AVV, DSFA) gelten auch für dieses Modul; dieses Dokument ersetzt sie nicht.

### 7.7 Qualitätssicherung

- Golden Set: 20 handgeschriebene Pläne und 20 Texte (Testschreiber, keine echten Schüler), mit Referenztranskript und Lehrkraft-Sternen. Liegt unter `eval/golden/`.
- Metriken: Zeichenfehlerrate der Transkription nach Bestätigung; Übereinstimmung der Sterne mit der Lehrkraft (Abweichung höchstens 1 Stern je Dimension in 90 Prozent der Fälle); Anteil der Feedbacks, die Text für den Schüler schreiben (Ziel 0, geprüft per Regex auf Phrasen wie "Du könntest schreiben" und per Längenregel).
- Skript `pnpm eval` führt das Golden Set gegen die aktuellen Promptversionen aus und schreibt einen Bericht nach `eval/reports/`.
- Tracing optional über Langfuse (EU), nur mit pseudonymen IDs.

---

## 8. Datenmodell (Prisma-Stil)

```prisma
model Student {
  id               String   @id @default(cuid())
  accessCode       String   @unique
  nickname         String
  niveauEEnabled   Boolean  @default(false)
  createdAt        DateTime @default(now())
  progress         Progress?
  runs             MissionRun[]
  exerciseAttempts ExerciseAttempt[]
  unlocks          Unlock[]
  viewers          ViewerLink[]
}

model ViewerLink {           // Erwachsener mit Lesezugang (Elternteil, Lehrkraft)
  id         String  @id @default(cuid())
  studentId  String
  code       String  @unique
  role       String  // "parent" | "teacher"
  createdAt  DateTime @default(now())
}

model MissionTemplate {
  id           String  @id          // "m-04-01"
  stufe        Int
  order        Int
  niveau       String  // "M" | "E"
  schreibform  String  // "stellungnahme" | "eroerterung_linear"
  title        String
  prompt       String  // Auftrag
  adressat     String
  operator     String
  timeboxPlan  Int     // Minuten
  timeboxWrite Int
  checklist    Json    // string[]
  rubricId     String
  helpCardIds  String[]
  requiresExerciseStationId String?
  bossMode     Boolean @default(false)
}

model MissionRun {
  id          String   @id @default(cuid())
  studentId   String
  templateId  String
  state       String   // siehe Abschnitt 4
  startedAt   DateTime @default(now())
  completedAt DateTime?
  planRounds  Int      @default(0)
  jokerUsed   Boolean  @default(false)
  typedFallback Boolean @default(false)
  starsAufbau Int?
  starsArgumentation Int?
  starsSprache Int?
  starsRichtigkeit Int?
  starsBonus  Int?
  uploads     Upload[]
  feedbacks   Feedback[]
  selfCheck   Json?
}

model Upload {
  id            String   @id @default(cuid())
  runId         String
  kind          String   // "plan" | "text" | "revision"
  round         Int      @default(1)
  imageKeys     String[] // S3 keys, Seitenreihenfolge
  transcriptRaw Json?
  transcriptConfirmed Json?
  editDistanceRatio Float?
  legibility    Float?
  typed         Boolean  @default(false)
  createdAt     DateTime @default(now())
}

model Feedback {
  id            String   @id @default(cuid())
  runId         String
  uploadId      String
  kind          String   // "plan_review" | "text_review" | "revision_check"
  promptName    String
  promptVersion String
  modelId       String
  payload       Json     // validiertes Schema-Objekt
  createdAt     DateTime @default(now())
}

model Exercise {
  id          String @id
  type        String
  stufe       Int
  niveau      String
  payload     Json
  explanation String
  tags        String[]
  approved    Boolean @default(false)   // Freigabe Lehrkraft
}

model ExerciseStation {
  id          String @id   // "st-02-01"
  stufe       Int
  order       Int
  exerciseTypes String[]   // woraus gezogen wird
  size        Int @default(4)
  passThreshold Int @default(3)
}

model ExerciseAttempt {
  id         String   @id @default(cuid())
  studentId  String
  stationId  String
  exerciseIds String[]
  results    Json     // boolean[]
  passed     Boolean
  createdAt  DateTime @default(now())
}

model HelpCard {
  id        String @id   // "HK-01"
  title     String
  stufe     Int
  content   Json   // { intro: string, phrases: string[] }
  cost      Int    @default(1)
}

model Unlock {
  id         String @id @default(cuid())
  studentId  String
  helpCardId String
  createdAt  DateTime @default(now())
}

model Progress {
  studentId     String @id
  xp            Int    @default(0)
  keys          Int    @default(0)
  currentStufe  Int    @default(1)
  streakDays    Int    @default(0)
  lastActiveDay DateTime?
  badges        String[]
}
```

---

## 9. Architektur und Stack (Vorschlag, falls das Repo noch leer ist)

- Next.js (App Router, TypeScript), mobile-first, PWA-Manifest; Serwist-Caching erst in v2.
- Prisma mit PostgreSQL (Docker Compose für lokal).
- S3-kompatibler Objektspeicher in der EU (zum Beispiel Hetzner Object Storage oder Scaleway), lokal MinIO.
- LLM-Aufrufe über ein OpenAI-kompatibles Gateway (LiteLLM), im Code über das Vercel AI SDK mit `generateObject` und zod-Schemas. Provider austauschbar über Umgebungsvariablen (7.5).
- PDF-Druckvorlagen serverseitig mit `@react-pdf/renderer`.
- Auth v1: Zugangscode für Schüler (Cookie-Session), Lesecode für Erwachsene. LTI und VIDIS kommen mit der Schulanbindung, nicht in v1.
- Tests: Vitest (Regeln, State Machine, Schema-Validierung, Zitatprüfung), Playwright (ein kompletter Missionsdurchlauf mit getipptem Text und mit Beispielfotos).
- Verzeichnisstruktur:

```
app/                 Routen (student/, viewer/, api/)
lib/game/rules.ts    Unlock-, Sterne-, XP-Regeln (rein)
lib/mission/state.ts State Machine und Guards
lib/llm/             Gateway-Client, Routing, Schemaprüfung, Zitatprüfung
lib/pdf/             Druckvorlagen
prompts/             versionierte Prompts
schemas/             zod-Schemas
content/             Seeds: missions.json, help_cards.json, exercises/*.json, checklists.json
eval/                Golden Set und Berichte
```

---

## 10. Content-Paket v1

### 10.1 Missionen (Klasse 7, Lebenswelt, immer mit Adressat)

| ID | Stufe | Thema | Adressat | Form |
|---|---|---|---|---|
| m-01-01 | 1 | "Hausaufgaben am Wochenende: ja oder nein?" Eine Behauptung mit "weil" | Klassenlehrkraft | ein Satz, dann zwei Sätze |
| m-01-02 | 1 | "Längere Pausen" | Schulleitung | drei Behauptungen, je begründet |
| m-02-01 | 2 | "Ein Haustier für die Klasse" | Elternabend | ein B-B-B-Absatz |
| m-02-02 | 2 | "Mehr Sport statt einer Deutschstunde" | Schulleitung | ein B-B-B-Absatz |
| m-03-01 | 3 | "Klassenfahrt: Meer oder Berge?" | Klassenlehrkraft | Plan mit 3 Argumenten, Text getippt |
| m-03-02 | 3 | "Handys in der Pause erlauben?" | Schulleitung | Plan mit 3 Argumenten, Text getippt |
| m-04-01 | 4 | "Brauchen wir eine längere Mittagspause?" | Schulkonferenz | Stellungnahme, Papier |
| m-04-02 | 4 | "Taschengeld: Sollten Kinder ab 12 selbst entscheiden, wofür?" | Eltern | Stellungnahme, Papier |
| m-04-03 | 4 | "Schuluniform an unserer Schule?" | SMV | Stellungnahme, Papier |
| m-05-01 | 5 | Überarbeitung des eigenen Textes aus m-04-01 | | Tastatur, Textlupe |
| m-05-02 | 5 | Überarbeitung eines gegebenen schwachen Beispieltexts | | Tastatur |
| m-06-01 | 6 (E) | "Sollten Jugendliche unter 14 Social Media nutzen dürfen?" | Leserbrief an die Lokalzeitung | lineare Erörterung mit Gegenargument |
| m-06-02 | 6 (E) | "Noten abschaffen?" | Schulkonferenz | lineare Erörterung mit Gegenargument |
| boss-01 | Boss | Thema aus verdecktem Pool (5 Themen, Freigabe durch Lehrkraft) | wechselnd | 45 Minuten, Papier, keine Hilfen |

Alle Themen vor dem Pilot von der Deutschlehrkraft der Klasse freigeben lassen; Pool als `content/missions.json`.

### 10.2 Hilfskarten (Textprozeduren)

| ID | Stufe | Inhalt (Auszug) |
|---|---|---|
| HK-01 Einleitung | 3 | "Zurzeit wird viel darüber diskutiert, ob ...", "An unserer Schule stellt sich die Frage, ob ...", "Ich bin der Meinung, dass ..." |
| HK-02 Behauptung | 1 | "Ein wichtiger Grund dafür ist ...", "Außerdem spricht dafür, dass ...", "Das stärkste Argument ist ..." |
| HK-03 Begründung | 1 | "..., weil ...", "Das liegt daran, dass ...", "Dadurch ..." |
| HK-04 Beispiel | 2 | "Ein Beispiel dafür ist ...", "Das zeigt sich, wenn ...", "In unserer Klasse ..." |
| HK-05 Verknüpfung und Reihenfolge | 3 | "Zunächst", "Außerdem", "Darüber hinaus", "Vor allem aber", "Schließlich" |
| HK-06 Schluss | 4 | "Aus diesen Gründen ...", "Deshalb fordere ich ...", "Zusammenfassend lässt sich sagen ..." |
| HK-07 Gegenargument (E) | 6 | "Manche meinen zwar, dass ..., doch ...", "Dagegen lässt sich einwenden, dass ...", "Dieser Einwand überzeugt nicht, weil ..." |
| HK-08 Sachlich statt umgangssprachlich | 5 | "voll gut" wird zu "sehr sinnvoll", "krass viele" wird zu "sehr viele", "halt" streichen |
| HK-09 Beispielgliederung | 4 | Musterplan einer Stellungnahme (ohne Inhalt, nur Struktur) |

### 10.3 Checklisten (Selbstkontrolle, `content/checklists.json`)

Stufe 4 (Beispiel):
- Meine Einleitung nennt das Thema und meinen Standpunkt.
- Jedes Argument hat Behauptung, Begründung und Beispiel.
- Mein stärkstes Argument steht am Ende des Hauptteils.
- Jedes Argument ist ein eigener Absatz.
- Ich habe Verknüpfungswörter benutzt.
- Mein Schluss fasst zusammen und bringt kein neues Argument.
- Ich habe den Adressaten angesprochen.

Stufe 6 ergänzt: "Ich habe ein Gegenargument genannt und entkräftet."

### 10.4 Mikroübungs-Seeds

Erstausstattung: 8 Aufgaben je Typ für Stufe 1 bis 3, 6 je Typ für Stufe 4 bis 6, insgesamt rund 90. Erzeugung über die Content-Pipeline mit einem Generierungsprompt, der das Schema aus Abschnitt 5 und die Themen aus 10.1 nutzt; Freigabeflag `approved` wird nur von Hand gesetzt. Beispieltexte für `sort_paragraphs` und `mark_parts`: 6 kurze Stellungnahmen (120 bis 180 Wörter) auf Klasse-7-Niveau, davon 2 absichtlich schwach (für Stufe 5).

---

## 11. Umsetzungsphasen mit Definition of Done

Aufwand in Sitzungen mit Claude Code, grob.

### Phase 0: Grundgerüst (1 Sitzung)
- Projekt, Prisma-Schema (Abschnitt 8), Docker Compose (Postgres, MinIO), Umgebungsvariablen, Gateway-Client mit Tier-Routing, `prompts/` und `schemas/` angelegt, Seeds aus `content/` laden, Zugangscode-Login, mobile Grundlayout, deutsche UI-Strings in `i18n/de.json`.
- DoD: `pnpm dev` startet; `pnpm seed` legt einen Teststudent, alle Missionen, Hilfskarten und Checklisten an; Login mit Code funktioniert auf dem Handy; Unit-Test für `rules.ts` mit den Regeln aus 3.2 (noch ohne UI) grün.

### Phase 1: Missionskern mit getipptem Text (2 bis 3 Sitzungen)
- State Machine (Abschnitt 4) komplett, aber `planning` und `writing` über Tastaturformulare (Felder identisch zum Planungsbogen).
- P2, P4, P5 angebunden, Schemaprüfung, Zitatprüfung, Textlupe-Anzeige, Selbstkontrolle, Überarbeitung, Sterne.
- DoD: Ein kompletter Durchlauf von m-04-01 auf dem Handy; alle Feedbacks validieren gegen Schema; 10 Testdurchläufe mit einem Beispieltext erzeugen kein Feedback, das Text für den Schüler schreibt (Regex- und Längenprüfung im Test); jeder Zustand ist nach Neuladen wiederaufnehmbar.

### Phase 2: Handschrift (2 bis 3 Sitzungen)
- Kamera-Upload mehrseitig, clientseitige Skalierung, S3-Ablage, P1 und P3, Bestätigungsschritt, Änderungsmenge, Druckvorlagen als PDF (Planungsbogen, Absatz-Schablone, Schreibbogen).
- DoD: 5 Beispielfotos (handgeschrieben, mit absichtlich eingebauten Rechtschreibfehlern) werden transkribiert, Fehler bleiben erhalten (Test vergleicht gegen Referenz), unleserliche Stellen erscheinen als `[?]`; der Bestätigungsschritt speichert Roh- und bestätigtes Transkript; Druckvorlagen tragen Missionscode und kein Namensfeld; Bilder liegen nur im privaten Bucket.

### Phase 3: Spielschicht (1 bis 2 Sitzungen)
- Progress, Sterne, XP, Schlüssel, Unlock-Regeln, Abzeichen, Streak, Hilfskarten-Freischaltung, Joker, Fortschrittskarte als Pfad.
- DoD: Alle Regeln aus 3.2 und 3.3 als Unit-Tests; Fortschrittskarte zeigt Position und nächste Freischaltung; Hilfskarten sind im Schreibzustand abrufbar, wenn freigeschaltet, sonst nicht.

### Phase 4: Mikroübungen (1 bis 2 Sitzungen)
- Sieben Typen rendern und bewerten, Stationen, Pool-Ziehung, Seeds laden, Generierungsskript für die Content-Pipeline (Batch), Freigabeflag.
- DoD: Jede Übungsart hat mindestens 5 freigegebene Aufgaben; Bewertungstests je Typ; Station vergibt Schlüssel nur bei 3 von 4; keine Wiederholung innerhalb von 10 Ziehungen.

### Phase 5: Stufen und Niveau-Aufstieg (1 bis 2 Sitzungen)
- Inhalte aller Stufen, Vormach-Stationen (`mark_parts`), Stufe 1 und 5 ohne Planphase, Stufe 3 mit Papierplan und getipptem Text, E-Pfad-Logik, E-Bonus in der Rubrik, HK-07, Boss-Mission mit hartem Timer und Boss-Bogen.
- DoD: Ein Schüler kann von Stufe 1 bis Boss durchlaufen (Playwright, getippter Pfad); E-Pfad schaltet nach der Regel aus 2.4 frei und nicht früher; Boss-Timer läuft serverseitig weiter, wenn die App geschlossen wird.

### Phase 6: Lesezugang und Portfolio (1 Sitzung)
- Erwachsenenansicht per Lesecode: Zeitstrahl aller Missionen mit Bild, Transkript, Feedback, Sterne je Dimension über die Zeit (einfaches Liniendiagramm), Hinweise bei `inappropriate`-Flags, PDF-Export einer Mission für die Lehrkraft.
- DoD: Lesecode öffnet nur diesen Schüler; kein Schreibzugriff; Export enthält Auftrag, Plan, Text, Sterne, nicht den Rohprompt.

### Phase 7: Qualität und Betrieb (laufend, erste Iteration 1 Sitzung)
- Golden Set und `pnpm eval`, Promptversionierung durchgesetzt, Aufbewahrungsjob für Bilder, Eingangsfilter, Langfuse optional, Fehlerseiten in Schülersprache.
- DoD: Eval-Bericht mit den Metriken aus 7.7; Aufbewahrungsjob löscht Testbilder nach Ablauf; Filter blockt zwei Testfälle.

---

## 12. Offene Entscheidungen (vor Phase 1 klären)

1. Themenpool (10.1) mit der Deutschlehrkraft der Klasse abstimmen, insbesondere die Boss-Themen und die zwei E-Themen.
2. Hosting für den Pilot: EU-VPS plus Objektspeicher reicht für einen Schüler; Entscheidung für Betreiber und EU-Endpunkt der Vision-Aufrufe.
3. Stufe 3: Text getippt (Vorschlag) oder bereits auf Papier?
4. Soll die Erwachsenenansicht das Rohtranskript zeigen oder nur das bestätigte?
5. Boss-Dauer: 45 Minuten (Vorschlag, eine Schulstunde) oder 90 Minuten wie eine Doppelstunde?
6. Soll der Schüler die Frage aus dem Plan-Feedback (P2) beantworten müssen, bevor er schreiben darf, oder bleibt sie optional (Vorschlag: optional in v1, Antwort wird gespeichert)?

---

## 13. Quellen

- Bildungsplan 2016 Baden-Württemberg, Sekundarstufe I, Deutsch, 3.2 Klassen 7/8/9, 3.2.1.2 Sach- und Gebrauchstexte (Niveaus G, M, E; Argumentstruktur (11), Standpunkt und Thesen (21), zentrale Schreibformen): https://www.bildungsplaene-bw.de/,Lde/BP2016BW_ALLG_SEK1_D_IK_7-8-9_01_02
- Bildungsplan 2016 Baden-Württemberg, Sekundarstufe I, Deutsch, prozessbezogene Kompetenzen 2.2 Schreiben (auf derselben Seite eingeblendet): https://www.bildungsplaene-bw.de/,Lde/BP2016BW_ALLG_SEK1_D_PK
- Übersicht 3.2 Klassen 7/8/9: https://www.bildungsplaene-bw.de/,Lde/BP2016BW_ALLG_SEK1_D_IK_7-8-9
- Projektbericht "AI learning app Staudinger Gesamtschule research report 2026-10-04" (Architektur, Modell-Routing, Datenschutzpaket), im Projektordner.
