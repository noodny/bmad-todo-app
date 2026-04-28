# syntax=docker/dockerfile:1.7

# ─── Stage 1: deps (shared by build + dev) ───────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: build (vite SPA bundle) ────────────────────────────────────────
FROM deps AS build
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts vitest.config.ts index.html components.json ./
COPY src ./src
RUN npm run build

# ─── Stage 3: dev (vite dev server with HMR) ─────────────────────────────────
# Used by the `dev` compose profile — bind-mount src on /app/src for hot reload.
FROM deps AS dev
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts vitest.config.ts index.html components.json ./
COPY src ./src
ENV NODE_ENV=development \
    HOST=0.0.0.0 \
    VITE_HOST=0.0.0.0
RUN chown -R node:node /app
USER node
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ─── Stage 4: runtime (nginx-unprivileged serves static SPA) ─────────────────
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Switch to root only to lay down config + assets, then drop back.
USER root
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
