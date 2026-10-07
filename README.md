# Denkraum

Eine interaktive, lokale, LLM-gestützte Lernapp für Schülerinnen und Schüler, Eltern und Lehrkräfte, offen und inklusiv. Arbeitstitel in den Planungsdokumenten: TeachingAssistant AI Lehrer.

## Worum es geht

Denkraum ist ein Übungs- und Feedback-Tutor für das deutsche Schulsystem, zugeschnitten auf den Bildungsplan 2016 Baden-Württemberg mit den Niveaus G, M und E. Pilotschule ist die Staudinger-Gesamtschule in Freiburg, zunächst für die Klassen 7, 10 und 11.

Das Grundprinzip in allen Modulen:

- Die Lehrkraft gibt Aufgaben vor, es gibt keinen offenen Chat.
- Geplant und gerechnet wird auf Papier. Die Lösung wird mit dem Handy fotografiert, transkribiert, vom Schüler bestätigt und dann geprüft.
- Richtig oder falsch entscheidet Code, nicht das Sprachmodell. Das Modell transkribiert und formuliert formatives Feedback. Es vergibt keine Noten und verrät keine Endergebnisse.
- Gelöste Aufgaben schalten die nächste Lektion frei.
- Pseudonyme statt Klarnamen, EU-Hosting, Fotos werden nach Frist gelöscht. Standard sind lokale oder EU-gehostete offene Modelle, Claude wird für schwierige Schritte und die Inhaltsproduktion eingesetzt.

## Material

| Dokument | Pfad | Inhalt |
|---|---|---|
| Forschungsbericht (Englisch, Stand 4. Oktober 2026) | `docs/research/2026-10-04-ai-learning-app-staudinger-research-report.md` | Schule und Lehrpläne, Rechtsrahmen (KMK, BW, DSGVO, EU AI Act), Evidenz zu KI-Tutoren, Markt, Produktkonzept, Architektur, Geschäftsmodell, Roadmap |
| Schreibwerkstatt, Deutsch Klasse 7 | `docs/modules/deutsch-schreibwerkstatt-klasse-7.md` | Implementierungsplan: Stufenleiter vom Satz zum Erörterungstext, Spielmechanik, Missionsablauf, Handschrift-Pipeline, Prompts, Datenmodell, Umsetzungsphasen |
| Trigonometrie-Einstieg, Mathematik Klasse 10 | `docs/modules/mathematik-trigonometrie-klasse-10.md` | Umsetzungs-Prompt: sieben Lektionen, parametrisierte Aufgabenbank, Foto-Pipeline, Fehlerkatalog, Stack, Tests |
| Trigonometrie Probelauf | `prototypes/trigonometrie-probelauf/index.html` | Statische Vorschau der Lektion "Seiten berechnen mit sin, cos und tan", ohne Server, ohne KI, ohne Fotos; prüft Ergebnisse per Code mit 1 % Toleranz |

## Umsetzung

Die Module werden mit Claude Code aus den Dokumenten in `docs/modules/` gebaut, Phase für Phase, jede Phase mit Definition of Done und Tests. Konventionen aus den Modul-Dokumenten:

- Code, Bezeichner, Commits und Kommentare auf Englisch.
- Alle Texte für Schüler, Eltern und Lehrkräfte auf Deutsch: Du-Form für Schüler, Sie-Form für Erwachsene, korrekte Umlaute, keine Gedankenstriche.
- Prompts liegen versioniert als Markdown-Dateien im Repo, Spielregeln als reine Funktionen mit Unit-Tests.
- Alle Modellaufrufe laufen hinter einer Provider-Abstraktion (Anthropic SDK, OpenAI-kompatible Endpunkte, Mock für CI).

## Lizenz

Apache License 2.0, siehe `LICENSE`.
