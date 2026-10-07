# Umsetzungs-Prompt: Modul „Trigonometrie-Einstieg, Mathematik Klasse 10“

Projekt: TeachingAssistant AI Lehrer. Zielgruppe für den Prompt: Coding-Agent (Claude Code). Stand: 5. Oktober 2026.

---

## 0. Rolle und Auftrag

Du bist ein Senior Full-Stack-Entwickler mit Erfahrung in Lern-Apps, Mathematikdidaktik und LLM-Integration. Baue ein lauffähiges, mobil optimiertes Web-Modul (PWA) für Mathematik Klasse 10 zum Thema Trigonometrie im rechtwinkligen Dreieck mit Einstieg über die Ähnlichkeit von Dreiecken.

Das Modul ist der erste fachliche Baustein der App „TeachingAssistant AI Lehrer“. Baue es so, dass weitere Module (andere Themen, Fächer, Klassenstufen) später auf derselben Engine laufen: Lektionen, Aufgabenbank, Arbeitsblatt-Generator, Foto-Upload, Transkription, Verifikation, Feedback, Fortschritt.

Kern-Idee: Die App erklärt das Thema interaktiv. Die Schülerin oder der Schüler löst die Aufgaben auf Papier (Skizze, Rechenweg, Antwortsatz), fotografiert die Lösung mit dem Handy, lädt sie hoch und bekommt formatives Feedback (keine Note). Richtig gelöste Aufgaben schalten die nächste Lektion frei.

Arbeite in Phasen (Abschnitt 15), kläre echte Unklarheiten vorab mit mir und dokumentiere alle anderen Entscheidungen in `DECISIONS.md`.

---

## 1. Kontext und Rahmenbedingungen

- Zielgruppe: Klasse 10 an einer Gemeinschaftsschule in Baden-Württemberg. Drei Niveaus G, M und E sitzen im selben Klassenraum.
- Geräte: Smartphone (Foto-Upload, Lektionen), iPad, PC (Lektionen, Arbeitsblatt drucken). Mobile first, 375 px Breite muss sauber funktionieren.
- Sprache: Deutsch, Du-Form, Fachsprache des Bildungsplans BW 2016. Korrekte Umlaute in allen UI-Texten. Dezimalkomma in der Anzeige, Dezimalpunkt intern.
- Bildungsplan-Bezug (jede Aufgabe wird damit getaggt):
  - `BP2016BW_ALLG_SEK1_M_IK_7-8-9_03 (16)(17)(18)`: Ähnlichkeit, Ähnlichkeitssätze, Strahlensätze (Wiederholung als Einstieg)
  - `BP2016BW_ALLG_SEK1_M_IK_7-8-9_03 (21)`: Satz des Pythagoras (Wiederholung, Kontrollrechnung)
  - `BP2016BW_ALLG_SEK1_M_IK_10_03 (1)`: Streckenlängen und Winkelweiten mit Sinus, Kosinus, Tangens bestimmen. G-Niveau: nur Sinus und Tangens. M- und E-Niveau: Sinus, Kosinus, Tangens.
  - `BP2016BW_ALLG_SEK1_M_IK_10_03 (2)`: nur E-Niveau: sin²α + cos²α = 1, sin(90° - α) = cos α, tan α = sin α / cos α herleiten.
- Schulrechtliche Vorgaben: KI darf keine Noten vergeben und keine wesentlichen schulischen Entscheidungen treffen (Vorgabe Kultusministerium BW). Pseudonyme statt Klarnamen. Fotos von Handschrift sind personenbezogene Daten und werden nach Frist gelöscht. EU-Hosting.
- Modellstrategie: Start mit Claude (Anthropic SDK, Vision für die Fotos). Alle Modellaufrufe laufen hinter einer Provider-Abstraktion, damit später ein EU-gehostetes oder lokales Open-Weight-Modell (z. B. Qwen3-VL über eine OpenAI-kompatible API, vLLM, LiteLLM) ohne Änderung der Fachlogik eingesetzt werden kann.

---

## 2. Pädagogisches Konzept (verbindlich)

1. Ablauf pro Lektion: kurze Erklärung mit interaktivem Element, dann ein vollständig durchgerechnetes Beispiel, dann Papieraufgaben, Foto, Feedback, Freischaltung. Zwei Lückenaufgaben am Bildschirm (ausgeblendete Schritte ergänzen) stehen als freiwilliges Zwischentraining zur Verfügung, sind aber kein Pflichtschritt vor dem Arbeitsblatt (Abschnitt 5.3).
2. Keine offene Chat-Oberfläche. Interaktion läuft über Aufgaben, Hinweise und den Foto-Upload.
3. Endergebnisse werden nicht verraten. Feedback nennt den Fehlertyp in Schülersprache und gibt genau einen nächsten Schritt. Erst nach dem zweiten fehlerhaften Versuch kann ein vollständiger Lösungsweg angesehen werden. Das wird protokolliert.
4. Das Sprachmodell bekommt immer die verifizierte Musterlösung, alle Zwischenwerte und den Fehlerkatalog (Abschnitt 6.4). Es bewertet nie frei.
5. Jede Richtig/Falsch-Entscheidung trifft Code (numerischer Vergleich mit Toleranz, Gegenrechnen typischer Fehler). Das Sprachmodell transkribiert und formuliert, es entscheidet nicht.
6. Niveau-Differenzierung: Jede Papieraufgabe existiert in G, M und E. Das Niveau wird beim Start gewählt oder von der Lehrkraft gesetzt und kann pro Aufgabe gewechselt werden.
7. Jede Aufgabe ist parametrisiert (Seed pro Schüler und Versuch). Nachbarn haben unterschiedliche Zahlen, Wiederholung mit neuen Werten ist jederzeit möglich.
8. Interleaving: Ab Lektion 3 enthält jedes Arbeitsblatt eine Aufgabe aus einer früheren Lektion.
9. Skizze ist Pflicht bei allen Aufgaben mit `requires_sketch: true`. Eine fehlende Skizze ist ein eigener Fehlertyp (F11), kein Grund für „falsch“.

---

## 3. Fachinhalt: Lektionen

### Lektion 1: Ähnliche Dreiecke (Wiederholung und Einstieg)
- Lernziele: Ähnlichkeit erkennen (gleiche Winkel, gleiche Seitenverhältnisse), Streckfaktor k, Strahlensätze anwenden, Satz des Pythagoras wiederholen.
- Interaktiv: Zwei rechtwinklige Dreiecke mit demselben Winkel α, Schieberegler für den Streckfaktor. Anzeige: Die Verhältnisse Gegenkathete/Hypotenuse, Ankathete/Hypotenuse, Gegenkathete/Ankathete bleiben konstant, obwohl sich alle Seitenlängen ändern.
- Kernsatz, der am Ende steht: In ähnlichen rechtwinkligen Dreiecken hängen die Seitenverhältnisse nur vom Winkel ab. Das ist die Brücke zur Trigonometrie.

### Lektion 2: Bezeichnungen im rechtwinkligen Dreieck
- Hypotenuse (gegenüber dem rechten Winkel, längste Seite), Gegenkathete und Ankathete bezogen auf einen Winkel.
- Interaktiv: Winkel α oder β antippen, die Seiten färben sich um und werden neu beschriftet.
- Hier wird dem häufigsten Fehler vorgebeugt: Katheten werden absolut statt relativ zum betrachteten Winkel benannt.

### Lektion 3: Sinus, Kosinus, Tangens als Seitenverhältnisse
- Definitionen: sin α = Gegenkathete/Hypotenuse, cos α = Ankathete/Hypotenuse, tan α = Gegenkathete/Ankathete. Eine Merkhilfe anbieten (z. B. GAGA HühnerHof AG).
- Taschenrechner: Pflicht-Check „Steht dein Rechner auf DEG? Was zeigt er für sin 30°?“ Erwartet 0,5. Bei ungefähr -0,988 Hinweis auf Bogenmaß (RAD).
- Werte-Tabelle für 30°, 45°, 60° erarbeiten: G/M lesen ab und prüfen am Rechner, E leitet die Werte über gleichseitiges Dreieck und Quadrat her.
- G-Niveau: nur Sinus und Tangens, Kosinus wird nur erwähnt.

### Lektion 4: Seitenlängen berechnen
- Gegeben Winkel und eine Seite, gesucht eine andere Seite.
- Verfahren als Checkliste: Skizze, Seiten relativ zum Winkel benennen, passendes Verhältnis wählen, Gleichung aufstellen, umstellen, berechnen, erst am Ende runden (2 Dezimalen oder sinnvoll), Antwortsatz mit Einheit.
- Kontrolle mit dem Satz des Pythagoras.

### Lektion 5: Winkel berechnen
- Umkehrfunktionen sin⁻¹, cos⁻¹, tan⁻¹ (auch arcsin usw. erwähnen). Taschenrechner-Tasten SHIFT oder 2nd.
- Typische Fehler, die hier angesprochen werden: 1/sin statt sin⁻¹, Verhältnis vertauscht.
- Winkelsumme als Kontrolle: α + β = 90°.

### Lektion 6: Anwendungen
- Höhen über Erhebungswinkel (Turm, Baum, mit und ohne Augenhöhe), Leiter an der Wand, Rampe und Steigung in Prozent und in Grad (12 % sind nicht 12°), Schattenlänge, Luftlinie und Höhenunterschied beim Wandern, Dachneigung.
- Modellieren: aus einem Text eine Skizze mit rechtwinkligem Dreieck erstellen. Skizze ist Pflichtbestandteil der Papierlösung.

### Lektion 7 (nur E): Trigonometrische Beziehungen
- sin²α + cos²α = 1 aus dem Satz des Pythagoras herleiten, sin(90° - α) = cos α aus der Benennung der Katheten, tan α = sin α / cos α aus den Definitionen.
- Ausblick in zwei Sätzen auf die Sinusfunktion von 0° bis 360° (Leitidee Funktionaler Zusammenhang, nicht Inhalt dieses Moduls).

### Abschlusstest
- Sechs Papieraufgaben quer über die Lektionen, Niveau wählbar, ohne Hinweise während der Bearbeitung, Feedback erst nach Upload aller Aufgaben.

---

## 4. Aufgabenbank

### 4.1 Schema (`content/tasks/*.json`, mit zod validiert)

```json
{
  "id": "L4-A2",
  "lesson": 4,
  "type": "paper",
  "bildungsplan": ["BP2016BW_ALLG_SEK1_M_IK_10_03(1)"],
  "levels": {
    "G": { "text": "...", "sought": ["a"], "steps": ["..."] },
    "M": { "text": "...", "sought": ["a", "b"], "steps": ["..."] },
    "E": { "text": "...", "sought": ["a", "b"], "steps": ["..."], "extra": "Kontrolle mit Pythagoras begründen" }
  },
  "parameters": {
    "c": { "min": 6, "max": 12, "step": 0.5, "unit": "cm" },
    "alpha": { "min": 25, "max": 65, "step": 1, "unit": "°" }
  },
  "solution_fn": "L4-A2",
  "requires_sketch": true,
  "tolerance": { "relative": 0.01, "absolute_angle_deg": 0.5 },
  "expected_misconceptions": ["F1", "F2", "F3", "F6", "F7"],
  "hints": ["Welche Seite liegt α gegenüber?", "Welches Verhältnis enthält c und die gesuchte Seite?", "Multipliziere beide Seiten mit c."],
  "interleaving_of": null
}
```

- `type` ist einer von `worked_example`, `faded`, `quick_check`, `paper`.
- Aufgabentexte sind Templates mit Platzhaltern (`{{c}}`, `{{alpha}}`). Beim Erzeugen eines Arbeitsblatts werden Zahlen aus dem Seed gezogen. Wähle Parameterbereiche so, dass sinnvolle Rundung möglich ist und keine entarteten Dreiecke entstehen.
- `lib/solutions.ts` berechnet aus den Parametern die Musterlösung mit allen Zwischenwerten (z. B. `sin_alpha`, `a`, `b`, `pythagoras_check`) und zusätzlich die Ergebnisse typischer Fehlwege (RAD-Modus, vertauschte Katheten, falsches Verhältnis, Umstellfehler). Diese Werte gehen an die Verifikation und an die Feedback-Engine.
- Mindestumfang: pro Lektion 1 Beispiel, 2 Lückenaufgaben (für den Schüler optional, Abschnitt 5.3), 4 Papieraufgaben (jede in G, M, E), dazu 6 Abschlussaufgaben. Insgesamt rund 30 Papieraufgaben-Templates.

### 4.2 Beispielaufgaben mit Lösungen (Startbestand, als Tests hinterlegen)

Alle Werte nachrechnen und in `solutions.test.ts` festschreiben.

Lektion 1
- L1-A1 (G/M/E): Dreieck 1 hat die Katheten 3 cm und 4 cm und die Hypotenuse 5 cm. Dreieck 2 ist ähnlich mit Streckfaktor k = 2,5. Bestimme die Seiten von Dreieck 2 und zeige, dass das Verhältnis kurze Kathete zu Hypotenuse in beiden Dreiecken gleich ist. Lösung: 7,5 cm, 10 cm, 12,5 cm; 3/5 = 7,5/12,5 = 0,6.
- L1-A2 (G/M/E, Strahlensatz): Ein 1,5 m hoher Stab wirft einen 2 m langen Schatten. Ein Baum wirft zur gleichen Zeit einen 12 m langen Schatten. Wie hoch ist der Baum? Lösung: h = 1,5/2 · 12 = 9 m. E-Zusatz: Begründe mit einem Ähnlichkeitssatz, warum die beiden Dreiecke ähnlich sind (rechter Winkel und gleicher Sonnenwinkel).

Lektion 3
- L3-A1 (G/M/E): Gib ohne Taschenrechner an: sin 30°, tan 45°; M/E zusätzlich cos 60°, sin 45°. Lösung: 0,5; 1; 0,5; ungefähr 0,7071.
- L3-A2 (quick_check): Berechne sin 30° mit deinem Taschenrechner. Erwartet 0,5. Bei ungefähr -0,988 Hinweis F1 (RAD-Modus).

Lektion 4
- L4-A2 (Template, M/E): Im rechtwinkligen Dreieck ABC mit γ = 90° gilt c = {{c}} cm und α = {{alpha}}°. Berechne a und b und kontrolliere mit Pythagoras. Beispielwerte c = 8 cm, α = 35°: a = 8 · sin 35° ≈ 4,59 cm; b = 8 · cos 35° ≈ 6,55 cm; Kontrolle 4,59² + 6,55² ≈ 64,0. G-Variante: nur a gesucht (Sinus). RAD-Fehlweg: a ≈ -3,43 cm, also eine negative Länge, eindeutiges Signal für F1.
- L4-A3 (faded, G/M/E): c = 10 cm, β = 50°, gesucht b (Gegenkathete von β). sin β = b/c, also b = c · sin β = 10 · sin 50° ≈ 7,66 cm. Je Niveau sind unterschiedlich viele Schritte ausgeblendet (G: nur das Ergebnis, M: Umstellung und Ergebnis, E: Ansatz, Umstellung und Ergebnis).

Lektion 5
- L5-A1 (M/E): Die Katheten sind a = 3 cm und b = 5 cm. Berechne α (gegenüber von a) und β. Lösung: tan α = 3/5 = 0,6, also α ≈ 30,96° ≈ 31,0°; β = 90° - α ≈ 59,0°. Fehlweg F2: tan⁻¹(5/3) ≈ 59,04° für α (Katheten vertauscht).
- L5-A2 (G): Hypotenuse 10 cm, Gegenkathete 6 cm. Berechne α. Lösung: sin α = 0,6, also α ≈ 36,87°.

Lektion 6
- L6-A1 (G/M/E, Turm): Du stehst 50 m vom Fuß eines Turms entfernt und siehst die Spitze unter einem Erhebungswinkel von 32°. Deine Augenhöhe beträgt 1,60 m. Wie hoch ist der Turm? Lösung: h = 50 · tan 32° + 1,6 ≈ 31,24 + 1,6 ≈ 32,8 m. G-Variante ohne Augenhöhe (≈ 31,2 m).
- L6-A2 (M/E, Leiter): Eine 4 m lange Leiter steht 1,2 m von der Wand entfernt. Unter welchem Winkel steht sie zum Boden und wie hoch reicht sie? Lösung: cos α = 1,2/4 = 0,3, also α ≈ 72,5°; Höhe = 4 · sin 72,5° ≈ 3,82 m; Kontrolle √(16 - 1,44) ≈ 3,82 m.
- L6-A3 (M/E, Steigung): Eine Straße hat 12 % Steigung. Welchem Steigungswinkel entspricht das? Lösung: tan α = 0,12, also α ≈ 6,8°. Fehlweg F12: 12 % als 12° gelesen.

Lektion 7 (E)
- L7-A1: Leite sin²α + cos²α = 1 aus dem Satz des Pythagoras her. Erwartete Schritte: a² + b² = c², durch c² teilen, (a/c)² + (b/c)² = 1, Definitionen einsetzen. Bewertung über eine Schritt-Checkliste (Schritt vorhanden oder nicht), kein numerischer Vergleich.

---

## 5. Nutzerfluss (Screens)

1. Start: Klassencode und selbst gewähltes Pseudonym (kein Klarname). Niveau-Wahl G/M/E mit kurzer Erklärung. Fortschrittskarte mit Lektionen 1 bis 7 (gesperrt, offen, geschafft) und Punktestand.
2. Lektion: Erklärung in kurzen Abschnitten (max. zwei Bildschirmseiten pro Abschnitt), interaktives Element, Beispiel mit Schritt-für-Schritt-Aufklappen.
3. Digitaler Check (optional): zwei Lückenaufgaben mit Eingabefeldern, sofortige Prüfung, Hinweis bei Fehler. Der Check ist freiwillig. Am Ende der Lektion stehen zwei Buttons: „Erst kurz üben“ (Lückenaufgaben) und „Direkt zum Arbeitsblatt“. Das Arbeitsblatt ist in beiden Fällen sofort frei. Die Lehrkraft kann den Check pro Klasse auf Pflicht stellen (`Class.quickcheck_required`, Standard `false`). Nur im Pflichtmodus gilt: Arbeitsblatt frei nach zwei richtigen Lückenaufgaben, nach drei Fehlversuchen trotzdem frei, markiert als „mit Hilfe“.
4. Arbeitsblatt: vier Papieraufgaben mit individuellen Zahlen, Blatt-ID und QR-Code (Zuordnung beim Upload), Druckansicht A4 und Bildschirmansicht. Hinweiskasten: „Skizze, Rechenweg, Antwortsatz mit Einheit. Schreibe die Aufgabennummer an jede Lösung.“
5. Foto-Upload: Kamera direkt im Browser (`<input type="file" accept="image/*" capture="environment" multiple>`), mehrere Fotos möglich (eine Seite pro Foto), Vorschau, Drehen, Neuaufnahme. Clientseitig: EXIF-Rotation anwenden, auf maximal 1600 px längste Seite skalieren, JPEG Qualität 0,8, Ziel unter 500 KB pro Foto. Fortschrittsanzeige, Offline-Hinweis. Hinweis vor dem Upload: nur das Blatt fotografieren, keine Gesichter, keine Namen.
6. Transkriptions-Check „Habe ich dich richtig gelesen?“: Die App zeigt pro Aufgabe, was sie erkannt hat (Ansatz, Zwischenwerte, Endergebnis, Skizze ja/nein) in bearbeitbaren Feldern. Die Schülerin oder der Schüler bestätigt oder korrigiert. Erst dann wird bewertet. Bei niedriger Erkennungssicherheit Bitte um neues Foto mit Tipps (Tageslicht, senkrecht von oben, ganze Seite, kein Schatten).
7. Feedback: pro Aufgabe Status (richtig, fast, nochmal), ein konkreter Hinweis, Fehlertyp in Schülersprache, Buttons „Nochmal mit neuen Zahlen“ oder „Nächste Aufgabe“. Nach dem zweiten Fehlversuch zusätzlich „Lösungsweg ansehen“.
8. Freischaltung: Lektion gilt als geschafft bei mindestens 3 von 4 Papieraufgaben richtig im ersten oder zweiten Versuch. Punkte und Abzeichen (Abschnitt 7).
9. Lehrkraft-Ansicht (Abschnitt 12).

---

## 6. Foto-Pipeline und Feedback-Engine

### 6.1 Ablauf (serverseitig)

1. `POST /api/submissions` nimmt Blatt-ID, Fotos, Aufgaben-IDs und Seed an, speichert die Bilder im S3-kompatiblen EU-Objektspeicher und legt `Submission(status=uploaded)` an.
2. Transkription: Das Vision-Modell liest die Fotos und gibt strukturiertes JSON zurück (Schema 6.2). In diesem Schritt wird nichts bewertet. Prompt siehe 6.5.
3. Bestätigung: Die Transkription wird angezeigt (Screen 6) und ggf. korrigiert. Die bestätigte Fassung ist die Grundlage der Bewertung.
4. Verifikation (Code, kein LLM): `lib/verify.ts` vergleicht Endergebnisse und Zwischenwerte mit der Musterlösung aus `lib/solutions.ts` (Toleranz relativ 1 %, bei Winkeln 0,5°, Rundungsvarianten akzeptieren), prüft Einheit, Antwortsatz und Skizze, und erkennt Fehlermuster durch Gegenrechnen: RAD-Modus (Ergebnis passt zu `sin(alpha_in_rad)`), vertauschte Katheten (Ergebnis passt zum vertauschten Verhältnis), falsches Verhältnis (cos statt sin usw.), Umstellfehler (Ergebnis = sin α / c), Prozent-als-Grad usw. Ergebnis ist ein `VerificationResult` mit `status`, `matched_misconceptions`, `evidence`.
5. Feedbacktext: Das Sprachmodell formuliert aus `VerificationResult`, Musterlösung und Fehlerkatalog einen kurzen deutschen Text (Schema 6.3). Es darf nur Fehlertypen nennen, die die Verifikation gefunden hat, und keine Endergebnisse verraten (außer im freigeschalteten Lösungsweg).
6. Speichern, Punkte vergeben, Fortschritt aktualisieren, Fotos nach Frist löschen (Standard 14 Tage, die Transkription bleibt).

### 6.2 Transkriptions-Schema (JSON, zod)

```json
{
  "sheet_id": "...",
  "tasks": [
    {
      "task_id": "L4-A2",
      "found": true,
      "sketch_present": true,
      "sketch_labels_ok": "ok",
      "approach": "sin(35°) = a/8",
      "intermediate_values": [{ "label": "sin 35°", "value": 0.5736 }],
      "final_answers": [
        { "quantity": "a", "value": 4.59, "unit": "cm" },
        { "quantity": "b", "value": 6.55, "unit": "cm" }
      ],
      "answer_sentence_present": true,
      "transcription_confidence": 0.92,
      "raw_text": "zeilenweise Abschrift"
    }
  ],
  "unreadable_regions": [],
  "photo_quality_issue": null
}
```

`sketch_labels_ok` ist `ok`, `wrong` oder `unclear`. `photo_quality_issue` ist `null`, `blur`, `dark`, `cut_off` oder `glare`. Unleserliche Zahlen werden als `null` eingetragen und senken `transcription_confidence`.

### 6.3 Feedback-Schema

```json
{
  "task_id": "L4-A2",
  "status": "partially_correct",
  "headline": "Fast! Dein Ansatz stimmt.",
  "hint": "Prüfe, ob dein Taschenrechner auf DEG steht. Rechne sin 30° nach, es muss 0,5 herauskommen.",
  "misconception_codes": ["F1"],
  "praise": "Skizze und Beschriftung sind vollständig.",
  "next_action": "retry_same_numbers"
}
```

`status` ist `correct`, `partially_correct`, `incorrect` oder `not_found`. `next_action` ist `retry_same_numbers`, `retry_new_numbers`, `next_task` oder `show_solution_available`. Regeln: maximal drei Sätze pro Feld, Du-Form, Lob nur für etwas, das tatsächlich richtig ist, kein Endergebnis, keine Note, keine Punktzahl im Text.

### 6.4 Fehlerkatalog

| Code | Fehler | Erkennung in `verify.ts` | Hinweistext (Vorlage) |
|---|---|---|---|
| F1 | Taschenrechner im RAD- oder GRAD-Modus statt DEG | Ergebnis passt zur Rechnung im Bogenmaß; negative Längen | „Stell deinen Rechner auf DEG und prüfe mit sin 30° = 0,5.“ |
| F2 | Gegenkathete und Ankathete vertauscht | Ergebnis passt zum vertauschten Verhältnis | „Welche Seite liegt dem Winkel gegenüber? Markiere sie farbig in deiner Skizze.“ |
| F3 | Falsches Verhältnis gewählt (z. B. sin statt tan) | Ergebnis passt zu einem anderen Verhältnis | „Welche zwei Seiten kennst du oder suchst du? Wähle das Verhältnis, das genau diese beiden enthält.“ |
| F4 | Umkehrfunktion falsch (α = sin(0,6) oder 1/sin) | Ergebnis passt zu sin(x) oder 1/x statt sin⁻¹(x) | „Du suchst den Winkel, also brauchst du sin⁻¹ (SHIFT + sin).“ |
| F5 | Zu früh gerundet | Ergebnis passt zur Rechnung mit gerundetem Zwischenwert | „Runde erst am Ende.“ |
| F6 | Gleichung falsch umgestellt (a = sin α / c) | Ergebnis passt zu sin α / c | „Multipliziere beide Seiten mit c.“ |
| F7 | Einheit oder Antwortsatz fehlt | Transkription | „Schreibe das Ergebnis mit Einheit in einen Antwortsatz.“ |
| F8 | Hypotenuse falsch identifiziert | Ergebnis passt zu einer Rechnung mit einer Kathete als Hypotenuse | „Die Hypotenuse liegt dem rechten Winkel gegenüber und ist die längste Seite.“ |
| F9 | Rechter Winkel angenommen, wo keiner ist | Nur bei Anwendungsaufgaben, über Skizzenprüfung | „Wo genau ist in deiner Skizze der rechte Winkel? Prüfe, ob er wirklich dort liegt.“ |
| F10 | Strahlensatz mit Teilstrecke statt Gesamtstrecke | Ergebnis passt zum falschen Verhältnis | „Vergleiche Gesamtstrecke mit Gesamtstrecke oder Teilstrecke mit Teilstrecke.“ |
| F11 | Skizze fehlt oder ist unbeschriftet | Transkription | „Zeichne eine Skizze und beschrifte Winkel und Seiten, dann wird der Ansatz leichter.“ |
| F12 | Prozent-Steigung mit Grad verwechselt | Ergebnis passt zu α = Prozentzahl | „12 % Steigung heißt 12 m hoch auf 100 m waagerecht. Welches Verhältnis ist das?“ |
| F13 | Rechenfehler ohne Konzeptfehler | Ansatz und Zwischenwerte richtig, Endergebnis außerhalb der Toleranz, kein anderes Muster passt | „Dein Ansatz stimmt. Rechne den letzten Schritt noch einmal nach.“ |

### 6.5 System-Prompt Transkription

„Du bist ein sorgfältiger Leser handschriftlicher Mathematiklösungen von Schülerinnen und Schülern der 10. Klasse (deutsche Schreibweise, Dezimalkomma). Du bekommst Fotos eines Arbeitsblatts mit den Aufgabennummern {{task_ids}} und zu jeder Aufgabe den Aufgabentext. Deine einzige Aufgabe ist die Transkription in das vorgegebene JSON-Schema: Welche Aufgabe wurde bearbeitet, ist eine Skizze vorhanden und beschriftet, welcher Ansatz steht da, welche Zwischenwerte, welche Endergebnisse mit Einheit, ist ein Antwortsatz vorhanden. Bewerte nichts, korrigiere nichts, ergänze keine Werte, die nicht auf dem Foto stehen. Unleserliche Zahlen trägst du als null ein und senkst transcription_confidence. Dezimalkomma wird in Zahlenfeldern als Dezimalpunkt übernommen. Antworte nur mit JSON.“

### 6.6 System-Prompt Feedbacktext

„Du formulierst Rückmeldungen für eine Schülerin oder einen Schüler der 10. Klasse in der Du-Form: freundlich, knapp, konkret. Du erhältst die Aufgabe, die verifizierte Musterlösung mit Zwischenwerten, die bestätigte Transkription der Schülerlösung und das Ergebnis der automatischen Prüfung mit erkannten Fehlertypen und Hinweistexten aus dem Fehlerkatalog. Regeln: Nenne nur Fehlertypen, die die Prüfung erkannt hat. Verrate nie das Endergebnis und keine Zwischenwerte, die noch nicht in der Schülerlösung stehen. Gib genau einen nächsten Schritt. Lobe nur, was tatsächlich richtig ist. Vergib keine Note und keine Punkte. Antworte nur mit JSON nach dem Feedback-Schema.“

### 6.7 Provider-Abstraktion

`lib/llm/provider.ts` mit Interface `{ transcribe(images, context): Promise<Transcription>; writeFeedback(input): Promise<Feedback> }`.

Implementierungen:
- `anthropic.ts`: Start mit Claude Sonnet 5.5 (Vision), strukturierte Ausgabe über JSON-Schema/zod, bei Schema-Fehler ein Retry mit Fehlermeldung im Prompt.
- `openai-compatible.ts`: für vLLM, LiteLLM, Qwen3-VL, dieselben Prompts, dieselben Schemas.
- `mock.ts`: deterministische Antworten aus `fixtures/`, damit CI ohne API-Key läuft.

Auswahl über `LLM_PROVIDER`, Endpunkt über `LLM_BASE_URL`. Alle Aufrufe mit Timeout, maximal zwei Retries, Logging von Modell, Tokens, Latenz und Kosten pro Aufruf. Optional Langfuse-Tracing über `LANGFUSE_*`.

---

## 7. Spiel- und Fortschrittslogik

- Punkte: Lückenaufgabe richtig 5. Papieraufgabe richtig im ersten Versuch 20, im zweiten Versuch 10, nach angesehenem Lösungsweg 0, die Aufgabe gilt aber als bearbeitet. Vollständige Skizze +3. Taschenrechner-Check fehlerfrei +5 (einmalig).
- Level: Eine Lektion ist ein Level. Lektion n+1 wird frei bei 3 von 4 Papieraufgaben richtig. Die Lehrkraft kann Freischaltungen überschreiben.
- Abzeichen: „Winkeljäger“ (Lektion 5 geschafft), „Skizzenprofi“ (fünf vollständige Skizzen), „DEG-Checker“ (Taschenrechner-Check ohne Fehler), „Modellierer“ (Lektion 6 geschafft).
- Streak: Tage mit mindestens einer bearbeiteten Aufgabe, nur als Anzeige, ohne Verlust-Framing.
- Keine Ranglisten zwischen Schülern.

---

## 8. Technischer Stack

- Next.js (App Router), TypeScript, Tailwind. PWA mit Manifest und Serwist/Workbox: Lektionsinhalte offline verfügbar, Upload nur online.
- Formeln: KaTeX. Interaktive Dreiecke: eigene SVG-Komponenten, kein GeoGebra-Embed im MVP.
- Validierung: zod für alle Schemas (Tasks, Transkription, Feedback, API).
- Datenbank: PostgreSQL mit Drizzle ORM. Lokal darf SQLite genutzt werden, Migrations für Postgres sind Pflicht.
- Dateispeicher: S3-kompatibel (MinIO lokal, EU-Bucket in Produktion), signierte URLs, Löschjob.
- LLM: Anthropic SDK hinter dem Provider-Interface, OpenAI-kompatibler Client als zweite Implementierung, Mock als dritte.
- Auth MVP: Klassencode plus Pseudonym mit Session-Cookie. Lehrkraft-Login per E-Mail-Magic-Link. So bauen, dass LTI 1.3 und VIDIS später angeschlossen werden können (es werden keine Schülerdaten außer Pseudonym gespeichert).
- Tests: Vitest (Solutions, Verify, Fehlermuster, Schemas), Playwright (Hauptfluss mit Fixture-Fotos).
- Deployment: Docker Compose (app, postgres, minio), `.env.example`, README mit Start in fünf Minuten.

Repo-Struktur (Vorschlag):

```
app/                  Routen: start, lektion/[n], arbeitsblatt/[id], upload/[id], feedback/[id], lehrkraft
components/           Triangle.tsx, FadedExample.tsx, PhotoUploader.tsx, TranscriptionReview.tsx, FeedbackCard.tsx
content/lessons/      Lektionstexte (MDX, Deutsch)
content/tasks/        Aufgaben-JSON pro Lektion
lib/solutions.ts      Musterlösungen und Fehlwege aus Parametern
lib/verify.ts         Verifikation und Fehlermuster
lib/llm/              provider.ts, anthropic.ts, openai-compatible.ts, mock.ts, prompts/
lib/game.ts           Punkte, Level, Abzeichen
db/                   Drizzle-Schema, Migrations
fixtures/photos/      Testfotos: richtig, RAD-Fehler, vertauschte Katheten, unleserlich
tests/
DECISIONS.md
README.md
```

---

## 9. Datenmodell (Kern)

- `Class(id, code, name, teacher_id, default_level, quickcheck_required)` mit `quickcheck_required` Standard `false`
- `Student(id, class_id, pseudonym, level, created_at)` ohne Klarname, ohne E-Mail
- `Teacher(id, email, name)`
- `Worksheet(id, student_id, lesson, seed, task_ids[], level, created_at, printed_at)`
- `Submission(id, worksheet_id, attempt_no, status, created_at)` mit `status` in `uploaded`, `transcribed`, `confirmed`, `verified`, `feedback_ready`, `failed`
- `Photo(id, submission_id, storage_key, width, height, delete_after)`
- `Transcription(id, submission_id, json, confidence, confirmed_json, confirmed_at)`
- `TaskResult(id, submission_id, task_id, status, misconception_codes[], points, solution_viewed, verification_json, feedback_json)`
- `Progress(student_id, lesson, status, points, badges[])` mit `status` in `locked`, `open`, `done`
- `Event(id, student_id, type, payload, created_at)` für Telemetrie (Tokens, Latenz, Kosten pro Modellaufruf, Lösungsweg-Freischaltungen)

---

## 10. API-Routen

- `POST /api/session` (Klassencode und Pseudonym, setzt Cookie)
- `GET /api/lessons/:n` (Inhalt und Freischaltstatus)
- `POST /api/quickcheck` (Lückenaufgaben prüfen)
- `POST /api/worksheets` (erzeugt Blatt mit Seed), `GET /api/worksheets/:id`, `GET /api/worksheets/:id/print`
- `POST /api/submissions` (Fotos), `GET /api/submissions/:id` (Status per Polling oder SSE)
- `POST /api/submissions/:id/confirm` (bestätigte oder korrigierte Transkription)
- `POST /api/submissions/:id/solution-view` (protokolliert Freischaltung des Lösungswegs)
- `DELETE /api/photos/:id` (sofortige Löschung auf Wunsch)
- `GET /api/teacher/classes/:id/overview`

---

## 11. Datenschutz und Schulregeln

- Keine Klarnamen und keine E-Mail-Adressen von Schülern, keine Werbung, kein Tracking durch Dritte.
- Fotos dienen nur der Rückmeldung. Löschung nach `PHOTO_RETENTION_DAYS` (Standard 14), sofortige Löschung per Button nach dem Feedback. Hinweis vor dem Upload: nur das Blatt fotografieren.
- Keine Noten, keine Notenprognose, keine Rangliste. Die Lehrkraft sieht formative Zusammenfassungen, keine Bewertungszahlen.
- Alle Modellaufrufe über konfigurierbare EU-Endpunkte (`LLM_BASE_URL`, `LLM_REGION`). Prompts enthalten nur die Pseudonym-ID, nie Klassenlisten.
- Protokoll der Lösungsweg-Freischaltungen und der Modellaufrufe für Transparenz gegenüber Lehrkraft und Eltern.
- Platzhalterseiten für Impressum, Datenschutzhinweis und Elterninformation anlegen.

---

## 12. Lehrkraft-Ansicht (MVP)

- Klasse anlegen, Klassencode erzeugen, Standardniveau setzen, Lückenaufgaben als Pflicht vor dem Arbeitsblatt ein- oder ausschalten (Standard aus).
- Übersicht pro Pseudonym: aktuelle Lektion, Stand (offen, geschafft), Zahl der Versuche.
- Klassenweite Auswertung: die drei häufigsten Fehlertypen mit Hinweistext für den Unterricht, z. B. „7 von 24 hatten F1 (RAD-Modus): Taschenrechner-Check im Plenum.“
- Lektion manuell freischalten, Arbeitsblatt eines Schülers als PDF öffnen.
- Fotos sind für die Lehrkraft nicht einsehbar, nur die Transkription, außer der Schüler teilt sie aktiv.

---

## 13. Nicht-funktionale Anforderungen

- Mobile first ab 375 px, Touch-Ziele mindestens 44 px, Druckansicht A4 sauber.
- Upload von drei Fotos à 500 KB in unter 10 s bei 4G. Feedback in unter 30 s, mit Statusanzeige während der Wartezeit („Ich lese deine Lösung ...“).
- WCAG 2.2 AA: Kontraste, Tastaturbedienung, Alt-Texte und aria-labels für Dreiecke und Formeln.
- Deutsche Rechtschreibung mit korrekten Umlauten in allen Texten.
- Kosten-Log pro Submission (Modell, Tokens, Dauer).

---

## 14. Tests und Definition of Done

Pflichttests:
1. `solutions.test.ts`: alle Beispielaufgaben aus 4.2 liefern die genannten Werte.
2. `verify.test.ts`: RAD-Fehler (L4-A2 mit a = -3,43) ergibt F1. Vertauschte Katheten (L5-A1 mit 59,04°) ergibt F2. 12° statt 6,8° (L6-A3) ergibt F12. Richtige Lösung mit anderer Rundung (4,6 statt 4,59) ergibt `correct`. Fehlende Einheit ergibt F7 mit `partially_correct`.
3. Schema-Tests: jede Task-JSON validiert; jede Lektion hat 1 Beispiel, 2 Lückenaufgaben, 4 Papieraufgaben in G, M, E.
4. Playwright: Start, Lektion 4, „Direkt zum Arbeitsblatt“, Upload eines Fixture-Fotos, Transkription bestätigen, Feedback, Punkte sichtbar. Zweiter Lauf mit `quickcheck_required = true`: Arbeitsblatt erst nach zwei richtigen Lückenaufgaben erreichbar.
5. Provider-Test: derselbe Durchlauf mit `LLM_PROVIDER=mock`, damit CI ohne API-Key läuft.

Fertig ist das Modul, wenn:
- alle sieben Lektionen inhaltlich befüllt sind,
- der Hauptfluss auf iPhone Safari und Android Chrome mit echter Kamera funktioniert,
- die Pflichttests grün sind,
- `docker compose up` ein lauffähiges System liefert,
- `README.md` und `DECISIONS.md` aktuell sind,
- ein Lehrkraft-Account eine Klasse mit drei Test-Pseudonymen überblicken kann.

---

## 15. Arbeitsweise

Phase 1, Gerüst: Repo, Stack, DB-Schema, Provider-Interface mit Mock, Task-Schema mit zod, Start-Screen, dann Lektion 4 als vertikaler Durchstich (Erklärung, Beispiel, Arbeitsblatt, Upload, Transkription, Verifikation, Feedback). Lückenaufgaben gehören nicht in Phase 1. Danach Demo an mich.

Phase 2, Inhalt: Lektionen 1 bis 7 mit Texten, interaktiven Dreiecken und vollständiger Aufgabenbank. Lückenaufgaben als optionales Zwischentraining inklusive Pflichtmodus-Schalter. Fehlermuster-Erkennung für alle Aufgaben. Fixtures.

Phase 3, Rahmen: Spiel-Logik, Lehrkraft-Ansicht, Datenschutz-Funktionen (Löschjob, Protokolle), PWA-Feinschliff, Tests, Docker.

Bevor du anfängst: Stelle mir maximal fünf Rückfragen zu Dingen, die den Bau wirklich verändern (z. B. Hosting-Ziel, Druck oder Bildschirm als Standard für das Arbeitsblatt, ob der Abschlusstest Teil des MVP ist). Alles andere entscheidest du selbst und hältst es in `DECISIONS.md` fest. Erfinde keine Bildungsplan-Codes. Alle Lösungen in 4.2 werden nachgerechnet und als Tests hinterlegt, bevor sie in die Aufgabenbank kommen.
