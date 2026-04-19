# syntax=docker/dockerfile:1.7
# Multi-stage build for Next.js 14 standalone output.
# Produces a small (~200MB) runtime image with only what's needed.

# -------- Stage 1: install deps --------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# If no lockfile yet, fall back to npm install (first build).
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; \
    else npm install --no-audit --no-fund; fi

# -------- Stage 2: build --------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* vars are embedded at build time by Next.js, not runtime.
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ENV NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN
# Server-side env used during static generation of /chargers (OpenChargeMap fetch).
ARG OPENCHARGEMAP_API_KEY
ENV OPENCHARGEMAP_API_KEY=$OPENCHARGEMAP_API_KEY
RUN npm run build

# -------- Stage 3: runtime --------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Create a non-root user to run the app
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone output includes only the minimum node_modules + server files.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Data files are required at runtime by server components.
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1

CMD ["node", "server.js"]
