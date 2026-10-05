# Denkraum

Eine interaktive, LLM-gestützte Lern-App für Schülerinnen und Schüler, Eltern und Lehrkräfte. Offen, inklusiv, datenschutzfreundlich von Anfang an.

Pilotschule: Staudinger Gesamtschule Freiburg. Start mit den Klassen 7, 10 und 11.

## Aufbau

Eine gemeinsame Plattform (Web-App/PWA) und fachliche Module. Module sind nach Schulart und Klasse gegliedert:

```
apps/web/                           Next.js-App: Login per Code, Modul-Übersicht, Datenschutz, Impressum
packages/
  core/                             gemeinsame Typen, Modul-Manifest
  privacy/                          Pseudonyme, Codes, Fristen, Bild-Metadaten, Identitätsprüfung für Prompts
  llm/                              Modellzugriff: versionierte Prompts, Schemaprüfung, EU-Regeln, Mock
  db/                               Datenbank-Schema, Migrations, Löschjob, Export und Löschung je Pseudonym
modules/
  gesamtschule/
    klasse-07/deutsch-schreibwerkstatt/   Workstream B: argumentierendes Schreiben
    klasse-10/mathematik-trigonometrie/   Workstream A: Trigonometrie-Einstieg
  gymnasium/
    klasse-11/                            noch kein Modul
infra/                              Docker Compose (Postgres)
docs/
  umsetzungsplan.md                 Plan für beide Workstreams, Stand und nächste Schritte
  datenschutz/README.md             verbindliche Datenschutz-Leitplanken
DECISIONS.md                        plattformweite Entscheidungen
```

## Schnellstart

Voraussetzungen: Node 22.12 oder neuer, pnpm 10.

```bash
pnpm install
cp .env.example .env
pnpm seed        # legt zwei Demo-Gruppen an und zeigt ihre Codes
pnpm dev         # http://localhost:3000, Code eingeben
pnpm test        # alle Tests, ohne Datenbank-Server und ohne API-Schlüssel
```

Ohne `DATABASE_URL` läuft die Datenbank lokal als PGlite in `.data/`. Für Postgres: `docker compose -f infra/docker-compose.yml up -d` und `DATABASE_URL` in `.env` umstellen. KI-Aufrufe laufen standardmäßig gegen einen Mock (`LLM_PROVIDER=mock`).

## Geräte

- Ab Klasse 8 haben die Schülerinnen und Schüler iPads. Die App ist deshalb eine Web-App (PWA), optimiert für iPad und Smartphone.
- Klasse 7 hat keine Schulgeräte. Module für Klasse 7 arbeiten Papier zuerst; Uploads laufen über ein Gerät zu Hause.

## Grundsätze

1. Datenschutz von Anfang an: keine Klarnamen, keine Drittanbieter im Browser, Fotos mit Löschfrist, KI nur über EU-Endpunkte. Details: [docs/datenschutz/README.md](docs/datenschutz/README.md).
2. Code entscheidet, KI formuliert: Richtig/falsch, Freischaltungen und Fortschritt werden durch nachvollziehbare Regeln im Code bestimmt. Die KI transkribiert und formuliert Rückmeldungen.
3. Keine Noten, keine Ranglisten, kein offener Chat.
4. Dieses Repository ist öffentlich: Es enthält niemals Daten von Schülerinnen und Schülern.

## Status

Das Plattform-Gerüst (P0) steht. Die Fachlogik beider Module (A0, B0) ist in Arbeit. Nächste Schritte: [Umsetzungsplan, Abschnitt 9](docs/umsetzungsplan.md#9-stand-und-nächste-schritte).

## Lizenz

Apache License 2.0, siehe [LICENSE](LICENSE).
