# syntax=docker/dockerfile:1

# Soarfulness — container image.
#
# Mirrors the self-hosted deploy (.github/workflows/deploy.yml and
# soarfulness.service) so the container behaves like
# soarfulness.app.spacify.se:
#   - dependencies come from bun.lock (`bun install --frozen-lockfile`), the
#     lockfile CI and the deploy use; there is no package-lock.json here.
#   - the app builds with `bun run build:prod` (Nitro's "standard" preset).
#     This is a server-rendered TanStack Start app, not a static site, so it
#     needs a server process, not just a static file server.
#   - serve.mjs runs under Bun: it serves the built client assets with the
#     right content types and cache headers, falls back to the SSR handler,
#     and adds the robots / AI-bot blocking the live site has.
#
# Targets:
#   runtime (default)  production image, `docker compose up app`
#   dev                Vite dev server with hot reload, `docker compose up dev`

ARG NODE_VERSION=22
ARG BUN_VERSION=1

FROM oven/bun:${BUN_VERSION}-slim AS bun

# ---- dependencies -------------------------------------------------------
# Node is installed alongside Bun on purpose (as in CI): vite and the build
# scripts run on Node, Bun only installs packages and runs scripts.
FROM node:${NODE_VERSION}-bookworm-slim AS deps
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# ---- dev server (hot reload) -------------------------------------------
# The source is bind-mounted over /app by docker-compose.yml; node_modules
# stays the one installed above (anonymous volume).
FROM deps AS dev
ENV NODE_ENV=development
EXPOSE 8080
CMD ["bun", "run", "dev", "--host", "0.0.0.0", "--port", "8080"]

# ---- build ---------------------------------------------------------------
FROM deps AS build
COPY . .

# Optional: bakes in the Lovable Google Analytics measurement ID at build
# time (it's read via import.meta.env, so it must be present during the
# vite build, not just at container runtime). Leave unset to ship without it.
ARG VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY=""
ENV VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY=${VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY}

RUN bun run build:prod

# ---- runtime -------------------------------------------------------------
FROM oven/bun:${BUN_VERSION}-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=build --chown=bun:bun /app/.output ./.output
COPY --chown=bun:bun serve.mjs ./
USER bun

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["bun", "serve.mjs"]
