# Mathematik Klasse 10: Trigonometrie-Einstieg

Workstream A. Status: Planung.

## Inhalt

Interaktive Lektionen zur Trigonometrie im rechtwinkligen Dreieck mit Einstieg über ähnliche Dreiecke.

So läuft eine Lektion ab:
1. Die Schülerinnen und Schüler lösen Papieraufgaben mit individuellen Zahlen.
2. Sie fotografieren die Lösung und laden sie hoch.
3. Sie bekommen formatives Feedback, keine Note. Richtig oder falsch entscheidet Code, nicht das Sprachmodell.

Die Lektionen bauen aufeinander auf:
- Lektionen 1 bis 7, davon Lektion 7 nur auf E-Niveau
- danach ein Abschlusstest
- Niveaus G, M und E

## Spezifikation

"Umsetzungs-Prompt: Modul Trigonometrie-Einstieg, Mathematik Klasse 10" (Stand 5. Oktober 2026). Sie liegt noch nicht im Repo, weil das Repository öffentlich ist (DECISIONS.md, D-008). Nach der Freigabe kommt sie als `SPEC.md` hierher.

## Anpassungen an die gemeinsame Plattform

Siehe [Umsetzungsplan](../../../../docs/umsetzungsplan.md), Abschnitte 3 und 6.

- Drizzle, Paket `llm` (Tier `vision` für die Transkription, `light` für den Feedbacktext), Prompts als versionierte Dateien.
- Foto-Pipeline, Druck und Login kommen aus der Plattform.
- Der Parameter-Generator verwirft Seeds, bei denen ein Fehlweg innerhalb der Toleranz der richtigen Lösung liegt. Beispiele: α = 45° bei Sinus und Kosinus vertauscht, oder F5 bei bestimmten Winkeln.
- F5 (zu früh gerundet) wird über die transkribierten Zwischenwerte erkannt.
- Tagging: Teilkompetenz 7-8-9_03 (17) (Ähnlichkeitssätze) hat kein G-Niveau.

## Erster Schritt (A0)

Reine Fachlogik in `domain/`, nur mit Vitest:
- `solutions.ts`, `verify.ts`
- Fehlerkatalog F1 bis F13
- Parameter-Generator mit Mehrdeutigkeitsprüfung
- Task-Schema mit zod
- alle Werte aus Spec A 4.2 als Tests

Die Werte sind bereits nachgerechnet, siehe Umsetzungsplan Abschnitt 6.
