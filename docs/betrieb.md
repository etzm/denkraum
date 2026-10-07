# Betrieb

Denkraum läuft als drei Container auf demselben Server wie der Minecraft-Server: App, Postgres und (optional) Caddy für HTTPS. Stand: 7. Oktober 2026.

## Überblick

```
Internet  --443-->  Caddy  -->  App (Next.js)  -->  Postgres
                                  |
                                  +-->  Fotos: verschlüsselt im Volume "blobs" (oder S3-Bucket)
                                  +-->  Amazon Bedrock, Frankfurt (nur Modellaufrufe)
Minecraft: eigener Port (z. B. 25565), wird nicht berührt
```

| Dienst | Speichergrenze | CPU | von außen erreichbar |
|---|---|---|---|
| Postgres | 512 MB | 1 | nein (internes Netz ohne Internet) |
| App | 768 MB | 1,5 | nein (nur über Caddy, oder 127.0.0.1:3000) |
| Caddy | 128 MB | 0,5 | ja, Ports 80 und 443 |

Zusammen höchstens etwa 1,4 GB Arbeitsspeicher. Der Rest bleibt dem Minecraft-Server.

## Voraussetzungen

- Docker mit Compose-Plugin auf dem Server.
- DNS: ein A-Eintrag (und gegebenenfalls AAAA) für `denkraum.martinetzrodt.com` auf die IP des Servers.
- Ports 80 und 443 sind frei. Läuft dort schon ein Webserver, siehe "Vorhandener Reverse Proxy".
- Firewall: 80/tcp, 443/tcp und 443/udp offen, dazu die Minecraft-Ports wie bisher. Port 3000 und 5432 bleiben geschlossen (Compose bindet die App nur an 127.0.0.1).
- Der Server steht in der EU (bei Hetzner zum Beispiel in Falkenstein, Nürnberg oder Helsinki), und mit dem Anbieter besteht ein Auftragsverarbeitungsvertrag.

## Installation

```bash
git clone https://github.com/etzm/denkraum.git /opt/denkraum
cd /opt/denkraum
cp infra/env.production.example infra/.env
# infra/.env ausfüllen:
#   POSTGRES_PASSWORD      openssl rand -base64 24
#   BLOB_ENCRYPTION_KEY    openssl rand -base64 32
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY für Bedrock in eu-central-1
chmod 600 infra/.env
docker compose -f infra/docker-compose.prod.yml --profile caddy up -d --build
curl -s https://denkraum.martinetzrodt.com/api/health   # {"ok":true}
```

Caddy holt das Zertifikat beim ersten Aufruf automatisch.

## Erste Gruppe anlegen

```bash
docker compose -f infra/docker-compose.prod.yml --profile tools run --rm tools \
  node apps/web/scripts/create-group.ts --klasse 10 --label "Pilot Mathe" --ende 2027-07-31
```

Das Skript zeigt den Code für die Kinder und den Einstieg (`/klasse10`). Die Bezeichnung (`--label`) darf keinen Namen eines Kindes enthalten. Für den Pilot zu Hause: `--klasse 7 --kind individual`.

## Löschjob (täglich)

Löscht Fotos nach 14 Tagen, beendete Gruppen mit allen Daten, alte Protokolle und abgelaufene Sitzungen. Eintrag in der Crontab des Servers:

```
15 3 * * * cd /opt/denkraum && docker compose -f infra/docker-compose.prod.yml --profile tools run --rm tools >> /var/log/denkraum-retention.log 2>&1
```

## Datensicherung

Drei Dinge, getrennt aufbewahren:

1. Datenbank: `docker compose -f infra/docker-compose.prod.yml exec -T postgres pg_dump -U denkraum denkraum | gzip > denkraum-$(date +%F).sql.gz`
2. Fotos: das Volume `denkraum_blobs` (verschlüsselt; ohne Schlüssel nicht lesbar).
3. Der Schlüssel `BLOB_ENCRYPTION_KEY` aus `infra/.env`, an einem anderen Ort als die Fotos. Geht er verloren, sind die gespeicherten Fotos nicht mehr lesbar; Transkripte und Rückmeldungen in der Datenbank bleiben erhalten.

Sicherungen unterliegen denselben Fristen: Fotos höchstens 14 Tage, alles andere bis zum Ende der Gruppe. Ältere Sicherungen werden gelöscht.

## Aktualisieren

```bash
cd /opt/denkraum && git pull
docker compose -f infra/docker-compose.prod.yml --profile caddy up -d --build
```

Datenbank-Migrationen laufen beim Start der App automatisch.

## Vorhandener Reverse Proxy

Läuft auf dem Server schon nginx oder Caddy (zum Beispiel für eine Minecraft-Karte), Denkraum ohne das Profil `caddy` starten. Die App lauscht dann nur auf `127.0.0.1:3000`. Beispiel für nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name denkraum.martinetzrodt.com;
    # ssl_certificate ... (wie bei den anderen Seiten des Servers)
    access_log off;                  # keine IP-Adressen speichern
    client_max_body_size 30m;        # mehrere Fotos pro Upload
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

## KI-Modell wechseln

Nur Konfiguration in `infra/.env`, danach `docker compose ... up -d`:

- Standard: `LLM_PROVIDER=bedrock`, `AWS_REGION=eu-central-1` (Claude in Frankfurt).
- Offenes Modell auf eigenem oder EU-Server: `LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL`, `MODEL_VISION`, `MODEL_HARD`, `MODEL_LIGHT`, `LLM_ENDPOINT_IN_EU=true`.

Die App startet nicht, wenn Bedrock außerhalb der EU konfiguriert ist oder die direkte Anthropic-API in Produktion verwendet würde. Vor einem Wechsel an Kindertexten: mit dem Golden Set messen (Umsetzungsplan 5.2).

## Protokolle

- Caddy schreibt kein Zugriffsprotokoll; IP-Adressen werden nicht gespeichert.
- App-Protokolle enthalten keine Schülertexte, Fotos oder Prompt-Inhalte. Docker begrenzt sie auf 3 × 10 MB je Container.
- Jeder Modellaufruf steht ohne Inhalt in der Tabelle `llm_calls` (Modell, Promptversion, Tokens, Dauer), 12 Monate lang.

## Vor dem ersten Einsatz

- Impressum und Datenschutzhinweise ausfüllen (`apps/web/src/app/impressum`, `apps/web/src/app/datenschutz`): Anbieter, Kontakt, Verantwortliche Stelle, Region des Modellanbieters.
- Auftragsverarbeitungsverträge mit dem Server-Anbieter und mit AWS.
- Inhalte freigeben (D-022).
