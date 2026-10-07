# Module

Module sind nach Schulart und Klasse gegliedert:

```
modules/<schulart>/klasse-<nn>/<fach>-<thema>/
```

- `schulart`: kleingeschrieben, ohne Umlaute im Pfad (`gesamtschule`, `gymnasium`)
- `klasse-<nn>`: zweistellig (`klasse-07`, `klasse-10`)
- `<fach>-<thema>`: kleingeschrieben, Wörter mit Bindestrich, Umlaute im Pfad als ae, oe, ue, ss (`deutsch-schreibwerkstatt`, `mathematik-trigonometrie`)

Jedes Modul hat denselben Aufbau, siehe [Umsetzungsplan, Abschnitt 2](../docs/umsetzungsplan.md#2-zielstruktur-des-repos). Jeder Workstream arbeitet nur in seinem Modulverzeichnis; Änderungen an der Plattform laufen als eigene PRs.

Vor dem ersten Commit in einem Modul: [Datenschutz-Leitplanken](../docs/datenschutz/README.md), Abschnitt 10.

## Übersicht

| Modul | Schulart | Klasse | Fach | Status |
|---|---|---|---|---|
| [deutsch-schreibwerkstatt](gesamtschule/klasse-07/deutsch-schreibwerkstatt/) | Gesamtschule | 7 | Deutsch | Entwicklung (Workstream B) |
| [mathematik-trigonometrie](gesamtschule/klasse-10/mathematik-trigonometrie/) | Gesamtschule | 10 | Mathematik | Planung (Workstream A) |
| [klasse-11](gymnasium/klasse-11/) | Gymnasium | 11 | offen | noch kein Modul |
