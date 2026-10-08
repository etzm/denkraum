# Datenschutz-Leitplanken

Verbindlich für die Plattform und alle Module. Stand: 5. Oktober 2026.

Diese Leitplanken sind technische Regeln für den Bau. Sie ersetzen nicht:

- das Verzeichnis von Verarbeitungstätigkeiten
- den Auftragsverarbeitungsvertrag
- die Datenschutz-Folgenabschätzung
- die Elterninformation und die Abstimmung mit der oder dem Datenschutzbeauftragten der Schule

Wo eine Frist oder Regel als "Vorschlag" markiert ist, wird sie mit der Schule abgestimmt.

## 1. Datenminimierung

- Keine Klarnamen, keine E-Mail-Adressen, keine Geburtsdaten von Schülerinnen und Schülern.
- Pseudonyme erzeugt das System (zum Beispiel "Blauer Falke 42"); sie werden nicht frei gewählt. Die Zuordnung zu echten Namen führt die Lehrkraft außerhalb des Systems.
- Druckvorlagen haben kein Namensfeld. Der Auftrag sagt: "Schreib deinen Namen nicht auf das Blatt."
- Keine Geräte-, Standort- oder Browserdaten über das technisch Nötige hinaus.
- Lehrkräfte melden sich mit dem Lehrkraft-Code ihrer Gruppe an, ohne E-Mail-Adresse (DECISIONS.md, D-017).

## 2. Datenkategorien und Fristen

| Kategorie | Beispiele | Frist |
|---|---|---|
| Zugang | Gruppencode, Pseudonym, Lesecode | bis Ende des Schuljahres oder Pilots (Vorschlag) |
| Fotos von Handschrift | Arbeitsblatt, Planungsbogen, Text | 14 Tage, Löschung jederzeit per Knopf; Abweichung nur begründet im Modul-Manifest |
| Inhalte | Transkripte, getippte Texte, KI-Feedback, Selbsteinschätzung | bis Ende des Schuljahres oder Pilots, vorher Export für Lehrkraft oder Eltern (Vorschlag) |
| Fortschritt | Punkte, Sterne, Abzeichen, Freischaltungen, Korrekturen der Lehrkraft mit Begründung | wie Inhalte |
| Modellaufruf-Protokoll | Modul, Modell, Promptversion, Tokens, Latenz, Kosten, ohne Inhalte | 12 Monate (Vorschlag) |
| Server-Logs | Zugriffe mit gekürzter IP-Adresse | 7 Tage (Vorschlag) |

Jede Kategorie hat einen Löschjob mit Test. "Nie überschreiben" (Versionierung) ist erlaubt, verlängert aber keine Frist.

## 3. KI-Aufrufe

- Nur über EU-Endpunkte mit Auftragsverarbeitungsvertrag. Die Daten dürfen nicht zum Training verwendet werden.
- Prompts enthalten nur Auftrag, Musterlösung, Rubrik und Schülerinhalt, nie Pseudonym, Code, Gruppen-ID, Geräte- oder Standortdaten. Durchgesetzt über Eingabetypen ohne Identitätsfelder und über einen Test, der jeden gebauten Prompt prüft.
- Jede KI-Ausgabe wird gegen ein zod-Schema geprüft, bevor sie angezeigt wird. Freitextfelder haben eine Längengrenze.
- **Code entscheidet, KI formuliert.**
  - Richtig oder falsch, Freischaltungen, Niveauwechsel und Fortschritt bestimmen nachprüfbare Regeln im Code oder ein Mensch.
  - Die KI transkribiert, spiegelt und formuliert Rückmeldungen.
  - Hintergrund: Anhang III Nr. 3 der KI-Verordnung und die Vorgabe des Kultusministeriums Baden-Württemberg, dass KI keine Noten vergibt und keine wesentlichen schulischen Entscheidungen trifft. Siehe [Umsetzungsplan, Abschnitt 5.3](../umsetzungsplan.md#53-ki-verordnung-eu-20241689-und-vorgabe-des-kultusministeriums).
- Jede KI-formulierte Rückmeldung ist sichtbar als solche gekennzeichnet (Art. 50 KI-Verordnung).
- Kein offener Chat. Jede KI-Interaktion ist an einen Schritt im Ablauf gebunden.

## 4. Fotos

- Vor dem Upload steht der Hinweis: nur das Blatt fotografieren, keine Gesichter, keine Namen.
- Der Client kodiert jedes Bild über Canvas neu und entfernt dabei EXIF-Daten, auch GPS. Der Server prüft das erneut und entfernt verbleibende Metadaten.
- Ablage in einem privaten EU-Bucket mit Verschlüsselung. Zugriff nur über signierte URLs mit kurzer Laufzeit.
- Lehrkräfte sehen Fotos nur, wenn die Schülerin oder der Schüler sie aktiv teilt; sonst nur das bestätigte Transkript. Die Ansicht für Lehrkräfte hat keinen Zugriff auf Fotos und keinen auf die KI (D-030).

## 5. Browser

- Keine Drittanbieter: keine externen Schriften, kein CDN, keine Analyse- oder Tracking-Werkzeuge, keine eingebetteten Fremdinhalte.
- Content-Security-Policy mit `default-src 'self'`.
- Nur technisch notwendige Cookies (Sitzung). Kein Cookie-Banner nötig, solange das so bleibt.

## 6. Rechte der Betroffenen

Ab Phase P0 gibt es Export und Löschung je Pseudonym (Art. 15, 17 und 20 DSGVO) als Funktion für Lehrkraft oder Administration. Später kommt das nicht mehr gut hinein.

## 7. Öffentliches Repository

Dieses Repository ist öffentlich. Niemals einchecken:

- Daten oder Arbeiten echter Schülerinnen und Schüler, auch keine anonymisierten Beispiele
- Fotos echter Handschrift, auch nicht von Testschreibern ohne ausdrückliche Freigabe
- Golden Sets und Eval-Berichte (`eval/golden/`, `eval/reports/` sind in `.gitignore`)
- Klassenlisten, Zuordnungen von Pseudonymen zu Namen
- `.env`-Dateien, API-Schlüssel, Zugangsdaten
- Unterlagen mit Kontaktdaten (zum Beispiel unterschriebene Verträge)

Test-Fixtures sind synthetisch: erzeugte Bilder oder Texte, die ausdrücklich für das Repo freigegeben sind.

## 8. Logs

- Anwendungslogs enthalten IDs, Status und Laufzeiten, nie Schülertext, Bilder oder Prompt-Inhalte.
- Tracing (zum Beispiel Langfuse) ist standardmäßig aus; wenn an, dann selbst gehostet in der EU und nur mit pseudonymen IDs.

## 9. Transparenz

- Datenschutzhinweis für Schülerinnen und Schüler in kindgerechter Sprache (Du-Form, Art. 12 DSGVO).
- Elterninformation in Sie-Form.
- Impressum und Datenschutzhinweis als Seiten in der App, ab Phase P0 als Platzhalter.

## 10. Checkliste für ein neues Modul

- [ ] Manifest nennt Schulart, Klasse, Geräte, Datenkategorien und Fristen (Abweichungen begründet).
- [ ] Prompt-Eingaben enthalten keine Identitätsfelder; der Prompt-Test ist grün.
- [ ] Alle Entscheidungen über Fortschritt oder Freischaltung sind Code-Regeln oder menschliche Entscheidungen, mit Unit-Tests.
- [ ] KI-Rückmeldungen sind gekennzeichnet und schemageprüft.
- [ ] Inhalte, die Schülerinnen und Schüler frei schreiben, laufen durch den Inhaltsfilter mit festgelegtem Meldeweg (Schutzkonzept).
- [ ] Fixtures sind synthetisch; kein echtes Schülermaterial im Repo.
- [ ] Löschjobs decken alle neuen Tabellen und Dateien ab.
