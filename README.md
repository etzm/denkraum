# Denkraum

Eine interaktive, LLM-gestützte Lern-App für Schülerinnen und Schüler, Eltern und Lehrkräfte. Offen, inklusiv, datenschutzfreundlich von Anfang an.

Pilotschule: Staudinger Gesamtschule Freiburg. Start mit den Klassen 7, 10 und 11.

## Aufbau

Eine gemeinsame Plattform (Web-App/PWA) und fachliche Module. Module sind nach Schulart und Klasse gegliedert:

```
modules/
  gesamtschule/
    klasse-07/
      deutsch-schreibwerkstatt/     Workstream B: argumentierendes Schreiben
    klasse-10/
      mathematik-trigonometrie/     Workstream A: Trigonometrie-Einstieg
    klasse-11/                      noch kein Modul
docs/
  umsetzungsplan.md                 Empfehlung zur Umsetzung beider Workstreams
  datenschutz/README.md             verbindliche Datenschutz-Leitplanken
DECISIONS.md                        plattformweite Entscheidungen
```

Die Plattform (`apps/`, `packages/`) entsteht in Phase P0, siehe [Umsetzungsplan](docs/umsetzungsplan.md).

## Geräte

- Ab Klasse 8 haben die Schülerinnen und Schüler iPads. Die App ist deshalb eine Web-App (PWA), optimiert für iPad und Smartphone.
- Klasse 7 hat keine Schulgeräte. Module für Klasse 7 arbeiten Papier zuerst; Uploads laufen über ein Gerät zu Hause oder das Gerät der Lehrkraft.

## Grundsätze

1. Datenschutz von Anfang an: keine Klarnamen, keine Drittanbieter im Browser, Fotos mit Löschfrist, KI nur über EU-Endpunkte. Details: [docs/datenschutz/README.md](docs/datenschutz/README.md).
2. Code entscheidet, KI formuliert: Richtig/falsch, Freischaltungen und Fortschritt werden durch nachvollziehbare Regeln im Code bestimmt. Die KI transkribiert und formuliert Rückmeldungen.
3. Keine Noten, keine Ranglisten, kein offener Chat.
4. Dieses Repository ist öffentlich: Es enthält niemals Daten von Schülerinnen und Schülern.

## Status

Struktur und Planung. Noch kein lauffähiger Code. Nächste Schritte: offene Fragen in [docs/umsetzungsplan.md](docs/umsetzungsplan.md#8-offene-fragen), dann Phase P0.

## Lizenz

Apache License 2.0, siehe [LICENSE](LICENSE).
