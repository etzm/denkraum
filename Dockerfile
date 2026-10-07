# syntax=docker/dockerfile:1.7
# Denkraum web app. Build from the repository root:
#   docker compose -f infra/docker-compose.prod.yml build
# Stages: build (workspace and Next.js build), tools (admin scripts), app (small runtime image).

FROM node:22-bookworm-slim AS build
ENV NEXT_TELEMETRY_DISABLED=1 PNPM_HOME=/pnpm PATH=/pnpm:$PATH
WORKDIR /repo
COPY . .
# An extra CA certificate can be passed as a build secret (only needed behind a TLS-inspecting proxy).
RUN --mount=type=secret,id=ca,required=false \
    --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    sh -c 'if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
      corepack enable && pnpm install --frozen-lockfile && pnpm --filter @denkraum/web build'

# Full workspace for one-off admin commands (create a group, run the deletion job).
FROM build AS tools
ENV NODE_ENV=production DATABASE_MIGRATIONS_DIR=/repo/packages/db/drizzle
CMD ["node", "apps/web/scripts/retention.ts"]

FROM node:22-bookworm-slim AS app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    DATABASE_MIGRATIONS_DIR=/app/migrations BLOB_STORE=fs BLOB_DIR=/data/blobs
WORKDIR /app
RUN useradd --system --uid 10001 --no-create-home denkraum && mkdir -p /data/blobs && chown denkraum /data/blobs
COPY --from=build --chown=denkraum /repo/apps/web/.next/standalone ./
COPY --from=build --chown=denkraum /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=denkraum /repo/packages/db/drizzle ./migrations
USER denkraum
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
