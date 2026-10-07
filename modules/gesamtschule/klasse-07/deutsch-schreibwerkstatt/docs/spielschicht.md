# Spielschicht: der Denkraum-Garten

Stand: 7. Oktober 2026. Entscheidungen: SW-29 bis SW-33 in [DECISIONS.md](../DECISIONS.md). Regeln: `domain/garden.ts`, Einstellungen und Texte: `content/garden.json`.

## Idee

Die Fortschrittskarte der Spec (3.1) ist ein Garten mit Gartenhaus. Jeder Text lässt eine Pflanze wachsen, jede Stufe füllt ein Beet, und das Gartenhaus wächst über das Schuljahr. Wird nicht geübt, welkt der Garten, aber er stirbt nie. Eine kurze Station macht ihn wieder frisch.

## Bewertung nach Octalysis

Grundlage ist das Octalysis-Modell von Yu-kai Chou mit acht Kernantrieben (https://yukaichou.com/gamification-examples/octalysis-gamification-framework/). Antriebe 1 bis 3 ("White Hat") geben das Gefühl, fähig und selbstbestimmt zu sein. Antriebe 6 bis 8 ("Black Hat") erzeugen Druck und werden bei Zwölfjährigen nur sparsam eingesetzt.

| Kernantrieb | In der Spec | Was der Garten ergänzt |
|---|---|---|
| 1 Bedeutung und Berufung | schwach: Aufträge mit echtem Adressaten, aber kein Rahmen für den ganzen Weg | ein Bild für das ganze Jahr: "Du legst deinen Garten an"; jeder Text ist ein Samen |
| 2 Entwicklung und Erfolg | stark: Stufen, Sterne, XP, Abzeichen, Boss | Fortschritt auf einen Blick: Pflanze je Mission, Beet je Stufe, Gartenhaus |
| 3 Kreativität und Rückmeldung | stark im Inhalt (Schreiben, Textlupe) | die Pflanze wächst mit jedem Schritt der Mission sichtbar mit |
| 4 Besitz | mittel: Schlüssel, Hilfskarten, Abzeichen | der eigene Garten; Abzeichen am Haus, Hilfskarten im Geräteschuppen |
| 5 Soziales | bewusst gering (ein Kind, ein Erwachsener, keine Ranglisten) | v1: der Erwachsene besucht den Garten in der Ansicht für Erwachsene; v2: ein Klassengarten ohne Rangliste |
| 6 Knappheit | Schlüssel, Joker, Preis der Hilfskarten | geschlossene Beete der nächsten Stufen |
| 7 Neugier | Ziehung der Übungen, verdeckter Boss-Pool | Wundersamen: die Blütenfarbe zeigt sich erst bei der Blüte; Besucher (Tiere) kommen bei Meilensteinen, ohne dass die Regeln verraten werden |
| 8 Verlustvermeidung | nur der Streak | der Garten welkt bei Pausen, mit einem kurzen Weg zurück; nichts Erreichtes geht verloren |

Ergebnis: Die Spec ist fast nur "White Hat". Das passt zu einem Lernwerkzeug und zu D-006. Der Garten ergänzt die fehlenden Antriebe 1, 4 und 7 und genau einen begrenzten "Black Hat"-Antrieb (8).

### Spielerreise (Octalysis Stufe 2)

| Phase | Was passiert |
|---|---|
| Entdecken | Erster Besuch: ein leeres Beet und der Satz "Dein erster Text wird deine erste Pflanze." |
| Einstieg | Stufe 1 hat keine Planphase und wird getippt, die erste Pflanze blüht in einer Sitzung. |
| Gerüst | Station (Schlüssel), Mission (Pflanze wächst), Überarbeitung, Blüte; nach zwei Missionen ist das Beet voll und das Haus wächst. |
| Endspiel | Boss-Mission pflanzt den Apfelbaum und setzt den Schornstein; Niveau E bringt Rosen und die Wetterfahne; ein Neustart bringt eine weitere Blüte. |

## Ebenen

| Ebene | Einheit | Wächst, wenn | Bild |
|---|---|---|---|
| Pflanze | ein Missionsdurchgang | Auftrag verstanden (gesät), Plan freigegeben (Keimling), Text bestätigt (Blätter), Selbstkontrolle abgeschickt (Knospe), Mission abgeschlossen (Blüte) | Sorte je Stufe: Gänseblümchen, Tulpe, Mohnblume, Sonnenblume, Lavendel, Rose, Boss: Apfelbaum |
| Beet | eine Stufe | offen ab Erreichen der Stufe, voll nach zwei abgeschlossenen Missionen (SW-03) | geschlossene Beete mit Zaun |
| Gartenhaus | der ganze Weg | Fundament (erste Mission), Wände (Stufe 1), Tür (2), Fenster (3), Dach (4), Gewächshaus (5), Schornstein (Boss), Wetterfahne (Stufe 6) | ein Haus, das Teil für Teil entsteht |
| Wetter | Gewohnheit | Sonnentage = laufender Streak; Wolken bei Durst, grauer Himmel, wenn der Garten ruht | Himmel |
| Besucher | Meilensteine | Schmetterling (erste Blüte), Biene (5 Blüten), Eichhörnchen (5 Stationen), Igel (Abzeichen Durchhalter), Amsel (eine Mission zweimal abgeschlossen), Eule (Boss) | Tiere im Garten |

Der Weg auf Niveau M baut das Haus bis zum Schornstein fertig. Niveau E ist ein Zusatz und keine Voraussetzung für ein fertiges Haus.

## Vitalität: welkt, stirbt nie

| Zählende Tage ohne Aktivität | Zustand | Text für das Kind |
|---|---|---|
| 0 bis 1 | frisch | Dein Garten ist frisch und grün. |
| 2 bis 3 | durstig | Dein Garten hat ein bisschen Durst. Eine Station genügt, dann ist alles wieder frisch. |
| 4 bis 7 | welk | Deine Pflanzen lassen die Blätter hängen. Eine kurze Station, und sie richten sich wieder auf. |
| ab 8 | ruht | Dein Garten ruht und wartet auf dich. Alles, was du geschafft hast, ist noch da. Eine Station weckt ihn wieder auf. |

- Aktivität ist jede beendete Stationsrunde und jeder Schritt in einer Mission.
- Samstag, Sonntag und Schulferien zählen nicht. Die Ferien kommen aus der Tabelle der KMK für Baden-Württemberg; die vier beweglichen Ferientage legt jede Schule selbst fest und werden in `content/garden.json` ergänzt.
- Nach 8 Tagen bleibt der Garten im Zustand "ruht". Er wird nie schlechter.
- Die nächste Aktivität macht ihn sofort wieder frisch.
- Pflanzen, Beete, Haus, Besucher, XP, Schlüssel und Abzeichen bleiben immer erhalten. Nur der Zustand ändert sich.

## Leitplanken

- Der Garten liest keine KI-Ausgabe: keine Sterne, kein Text-Feedback, kein Ergebnis des Revision-Checks (SW-31). Er zeigt Einsatz und Abschluss, keine Bewertung. Ein Test vergleicht den Garten nach einer Mission mit 0 und mit 12 Sternen; beide sind gleich.
- Am Gartenhaus hängen nur Abzeichen, die Code zählt (Planer, Behauptungs-Profi, Durchhalter). Abzeichen, die KI-Ausgaben lesen (SW-18), erscheinen nur in der Abzeichenliste.
- Keine Zufallsbelohnung mit Wert: Die Blütenfarbe ist ein Hash der Lauf-ID und nur Schmuck (SW-32).
- Kein "toter" Garten, keine beschämenden Texte. Jeder Text bei Durst, Welke oder Ruhe nennt den Weg zurück.
- Keine Ranglisten, kein Vergleich mit anderen Kindern in v1 (SW-33).
- Das Beet für Stufe 6 sieht ein Kind auf Niveau M nicht. Schlägt das System Niveau E vor, erscheint ein geschlossenes Beet ohne Inhalt, bis ein Erwachsener entscheidet (SW-05, SW-33).
