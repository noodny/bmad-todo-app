# syntax=docker/dockerfile:1.7

# ─── Stage 1: deps (shared by build + dev) ───────────────────────────────────
# Toolchain for native better-sqlite3 compile if no prebuilt is available.
FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: build (TS → JS, prune devDeps) ─────────────────────────────────
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
 && npm prune --omit=dev

# ─── Stage 3: dev (tsx watch + dev deps available) ───────────────────────────
# Used by the `dev` compose profile with src bind-mounted on top of /app/src.
FROM deps AS dev
COPY tsconfig.json ./
COPY src ./src
ENV NODE_ENV=development \
    PORT=3000 \
    DB_PATH=/data/tasks.db \
    SERVE_STATIC=false
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ─── Stage 4: runtime (production) ───────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/tasks.db \
    SERVE_STATIC=false

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist          ./dist
COPY --from=build --chown=node:node /app/package.json  ./package.json

# SQLite data lives outside the image — declared as a volume mount point.
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]

USER node
EXPOSE 3000

# Liveness via dedicated /health endpoint (no DB I/O — won't flap on slow disk).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
