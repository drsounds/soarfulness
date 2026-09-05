# syntax=docker/dockerfile:1

# Aquafulness — production container image.
#
# Builds the TanStack Start app with Nitro's "node-server" preset (rather
# than the Cloudflare Workers target this repo's vite config defaults to)
# so the result is a plain Node.js HTTP server that runs anywhere Docker
# does. NITRO_PRESET is read directly by nitro and takes priority over the
# vite config's Cloudflare default, so no vite.config.ts changes are needed.

ARG NODE_VERSION=22-alpine

# ---- dependencies -----------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build --------------------------------------------------------------
FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Optional: bakes in the Lovable Google Analytics measurement ID at build
# time (it's read via import.meta.env, so it must be present during the
# vite build, not just at container runtime). Leave unset to ship without it.
ARG VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY=""
ENV VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY=${VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY}

ENV NITRO_PRESET=node-server
RUN npm run build

# ---- runtime ------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.output ./.output
USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
