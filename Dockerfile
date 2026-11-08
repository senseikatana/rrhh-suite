# syntax=docker/dockerfile:1

# ---------- build ----------
FROM oven/bun:1-debian AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV MIGRATIONS_PATH=/app/migrations

RUN groupadd -r rrhh && useradd -r -g rrhh rrhh \
  && mkdir -p /app/data/attachments \
  && chown -R rrhh:rrhh /app

COPY --from=builder --chown=rrhh:rrhh /app/.output ./.output
COPY --from=builder --chown=rrhh:rrhh /app/server/database/migrations ./migrations

USER rrhh
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/me').then(()=>process.exit(0)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
