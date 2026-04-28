# Security Review — bmad-test

**Date:** 2026-04-28
**Scope:** full-codebase pass at SHA `c0ceda0` (main) — server (`server/src/`), client (`client/src/`), infra (`docker-compose.yml`, `Dockerfile`s, `scripts/`), commit hygiene.
**Method:** parallel exploration of the three surfaces (server, client, deploy) plus targeted re-reads of the highest-risk findings to filter false positives.
**Threat model:** single-user todo app, deployed as a monolith (Fastify serves `/api/*` + the SPA from `client/dist`). No authentication. Assumed deployment posture: behind a TLS-terminating reverse proxy, not directly internet-exposed.

## Summary

| #   | Severity      | Area             | Finding                                                            | Status                 |
| --- | ------------- | ---------------- | ------------------------------------------------------------------ | ---------------------- |
| 1   | Medium        | Server / CSP     | CSP lacks `frame-ancestors` — page is iframe-able from any origin. | Open                   |
| 2   | Medium        | Server / DB      | `tasks.db` (and WAL/SHM siblings) created with mode `0644`.        | Open                   |
| 3   | Low           | Server / health  | `/health/ready` 503 response leaks raw DB error message.           | Open                   |
| 4   | Low           | Server / headers | No HSTS header in production.                                      | Open (proxy-dependent) |
| 5   | Low           | Server / headers | No `Permissions-Policy` header.                                    | Open                   |
| 6   | Informational | Server / health  | `/health` exposes process `uptimeMs`.                              | Open                   |
| 7   | Informational | Client / errors  | `ErrorBoundary` logs `info.componentStack` in production builds.   | Open                   |
| 8   | Informational | Infra / images   | Base images pinned to major version, not SHA256 digest.            | Accepted               |

**No critical or high findings.** Eight items, all Medium-or-below. Two false positives raised by the automated review were rejected after manual code re-read (see "Rejected findings" at the bottom).

---

## Findings

### 1. CSP missing `frame-ancestors` (Medium)

**Where:** [server/src/security.ts:16](server/src/security.ts#L16)

**What's wrong:** the only CSP directive is `default-src 'self'`. CSP `default-src` does **not** cover `frame-ancestors` (that's a navigation directive, not a fetch directive — it doesn't fall back to `default-src`). Without `frame-ancestors` (or the legacy `X-Frame-Options`), an attacker page on any origin can embed the SPA in an iframe.

**Attacker scenario:** clickjacking. An attacker hosts `evil.example.com` that iframes the deployed app, overlays a transparent button positioned over the "X" delete button, and tricks the user into deleting tasks they didn't intend to. The single-user model softens this (no privilege escalation possible), but data loss is still a real outcome.

**Remediation:** extend the CSP in [server/src/security.ts:16](server/src/security.ts#L16) to deny framing:

```ts
reply.header(
  "Content-Security-Policy",
  "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
);
```

`base-uri 'self'` and `form-action 'self'` are cheap belt-and-suspenders additions that don't fall back to `default-src` either.

---

### 2. Database file world-readable (Medium)

**Where:** [server/src/db.ts:31](server/src/db.ts#L31) — `new Database(dbPath)` runs under the process's default umask.

**Observed:** `ls -la server/data/tasks.db` → `-rw-r--r--` (mode `0644`). WAL/SHM siblings (`tasks.db-wal`, `tasks.db-shm`) inherit the same mode.

**What's wrong:** in any deployment where another local user, or another container in the same pod with a shared volume, can read the file path, they can dump the entire SQLite database byte-for-byte without going through the API.

**Attacker scenario:**

- Compose / k8s sidecar in the same pod with the data volume mounted reads the DB directly.
- Local-user shared host (rare for this app, but the file mode is a baseline-hygiene issue).

**Mitigations already in place:** the prod compose service runs as `node` user with `read_only: true` rootfs, `cap_drop: ALL`, and `no-new-privileges: true`. The SQLite file lives on a dedicated named volume, not the host. So the _concrete_ exposure today is "another container/pod that mounts the same volume" — narrow but real.

**Remediation:** narrow the umask before opening the DB so all files (DB, `-wal`, `-shm`) are created `0600`. In [server/src/db.ts](server/src/db.ts), before line 31:

```ts
const prevUmask = process.umask(0o077);
const db = new Database(dbPath);
process.umask(prevUmask);
```

Existing files keep their old mode; in containers the file is recreated on first start of a fresh volume, so the fix lands cleanly there. For an upgrade-in-place, add a one-shot `fs.chmodSync(dbPath, 0o600)` after open.

---

### 3. `/health/ready` leaks DB error message (Low)

**Where:** [server/src/routes/health.ts:18-25](server/src/routes/health.ts#L18-L25)

**What's wrong:** the 503 response includes `error: (err as Error).message`. Better-sqlite3 errors typically embed the absolute file path of the database, the SQLite error code, and sometimes library version info.

**Attacker scenario:** a probe of `/health/ready` while the DB is in a bad state (read-only filesystem, locked file, missing volume) returns a body like `{"status":"not_ready","db":"error","error":"SqliteError: unable to open database file: /var/lib/data/tasks.db"}`. That discloses the deploy layout to an unauthenticated probe.

**Remediation:** keep the detailed error in server logs (it's already logged via the request-error path), return a generic message to the client. Patch [server/src/routes/health.ts:23](server/src/routes/health.ts#L23):

```ts
} catch (err) {
  app.log.error({ err }, "readiness probe failed");
  reply.code(503);
  return { status: "not_ready", db: "error" };
}
```

---

### 4. No HSTS header in production (Low — proxy-dependent)

**Where:** [server/src/security.ts:14-21](server/src/security.ts#L14-L21)

**What's wrong:** if the app is deployed behind a TLS-terminating proxy (the documented posture), the proxy is the right place to set `Strict-Transport-Security`. If it's deployed without one (against best practice), the missing header is a real downgrade risk on first visit.

**Remediation:** add the header at the app, conditional on `NODE_ENV=production`. It's a no-op when set redundantly by the proxy:

```ts
if (process.env.NODE_ENV === "production") {
  reply.header(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
}
```

Skip `preload` unless this app's domain is actually being submitted to the HSTS preload list.

---

### 5. No `Permissions-Policy` header (Low)

**Where:** [server/src/security.ts:14-21](server/src/security.ts#L14-L21)

**What's wrong:** browser features the app doesn't use (camera, microphone, geolocation, payment, USB, etc.) are not explicitly disabled. If a future XSS lands, an attacker could call those APIs.

**Remediation:** add a deny-all Permissions-Policy for the features the app will never legitimately need:

```ts
reply.header(
  "Permissions-Policy",
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
);
```

---

### 6. `/health` exposes process uptime (Informational)

**Where:** [server/src/routes/health.ts:8-11](server/src/routes/health.ts#L8-L11)

**What's wrong:** a public liveness probe revealing `uptimeMs` lets an attacker fingerprint restart cadence. Combined with a known-CVE timing (e.g., "this version of better-sqlite3 was patched on date X, so an instance with uptime > N hours is unpatched"), this is a marginal aid to targeting.

**Status:** kept as Informational because it's standard practice for health endpoints and the current value is genuinely useful for operators.

**Remediation (optional):** if you want to close the marginal leak, drop `uptimeMs` from `/health` and surface uptime through Prometheus/internal-only endpoints instead.

---

### 7. ErrorBoundary logs componentStack in production (Informational)

**Where:** [client/src/ErrorBoundary.tsx:9](client/src/ErrorBoundary.tsx#L9)

**What's wrong:** `console.error("ErrorBoundary caught:", error, info.componentStack)` runs in every build, including production. The component stack reveals the internal React tree (component names, file paths from the bundle's source, prop hierarchy) to anyone with browser devtools open — or to anyone the user shares a screenshot/screen-recording with while the console is visible.

**Status:** Informational. The console is local to the user's browser; this is not a remote-exploit class issue.

**Remediation (optional):** strip the component stack in production builds:

```ts
componentDidCatch(error: Error, info: ErrorInfo) {
  if (import.meta.env.DEV) console.error("ErrorBoundary caught:", error, info.componentStack);
  else console.error("ErrorBoundary caught:", error);
}
```

---

### 8. Base images pinned by major version, not SHA (Informational — accepted)

**Where:** [server/Dockerfile:5](server/Dockerfile#L5), [client/Dockerfile:4,29](client/Dockerfile#L4)

**What's wrong:** `node:24-alpine` and `nginxinc/nginx-unprivileged:1.27-alpine` resolve to the latest matching image at build time. A compromised upstream tag (rare but possible) would propagate.

**Status:** **Accepted.** Major-version pinning is the maintainer-recommended posture — it lets security patch updates roll automatically without intervention. SHA-pinning is appropriate for air-gapped or compliance-bound deployments only. Documenting the choice here so it's not flagged again in future audits.

---

## Verified clean (no findings)

These were inspected and either correctly hardened or not applicable:

- **SQL injection (server).** Every DB call uses prepared statements with parameter binding ([server/src/db.ts:45-58](server/src/db.ts#L45-L58)). No string interpolation into SQL.
- **Input validation (server).** Every route has an AJV schema with `additionalProperties: false`, UUID-v4 regex on IDs, and length bounds on text ([server/src/routes/tasks.ts:18-44](server/src/routes/tasks.ts#L18-L44)). AJV configured with `removeAdditional: false, coerceTypes: false` ([server/src/server.ts:31-36](server/src/server.ts#L31-L36)).
- **Static-file serving (server).** `@fastify/static` registered with `wildcard: false` and a fixed root. The SPA fallback at [server/src/server.ts:82](server/src/server.ts#L82) calls `reply.sendFile("index.html")` with a **hardcoded literal** — `request.url` is used only for the `/api/` routing check, never to derive the served path. (Initial automated review flagged a path-traversal here; rejected after re-read.)
- **CORS (server).** No CORS plugin registered, no `Access-Control-Allow-Origin` set. Same-origin only — correct for the monolith deployment.
- **XSS (client).** No `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no `new Function`, no `javascript:` hrefs, no `target="_blank"` without `rel`. All user-text rendering goes through React JSX (auto-escaped).
- **Storage (client).** No `localStorage`, `sessionStorage`, `IndexedDB`, or `document.cookie` reads/writes. Nothing sensitive cached locally.
- **Network (client).** All fetch targets are hardcoded relative paths (`/api/tasks`, `/api/tasks/${id}`). No URL construction from user input. Vite dev proxy is dev-only.
- **Source maps (client).** Production build at `client/dist/assets/` contains no `.map` files (Vite default).
- **Container hardening.** Both prod services run non-root, with `read_only: true`, `cap_drop: ALL`, `no-new-privileges: true`, memory and PID limits, and HEALTHCHECKs.
- **Compose secrets.** No plaintext secrets in `docker-compose.yml`. `.env` is gitignored; only `.env.docker.example` and `.env.example` are committed and contain non-sensitive defaults.
- **`.gitignore` / `.dockerignore`.** Correctly exclude `*.db`, `*.db-*`, `.env`, `node_modules/`, `dist/`, `.git`.
- **Committed secrets.** Targeted scan for `sk_`, `ghp_`, `AKIA`, `eyJ`, `BEGIN PRIVATE KEY`, `password=` returned nothing.
- **Init scripts.** [scripts/dev.mjs](scripts/dev.mjs) uses `spawn(cmd, args, { shell: false })` with hardcoded args — no shell-injection vector.
- **CI/CD.** No GitHub Actions workflows present; nothing to harden.
- **Dependency posture.** All four prod-impacting packages (`fastify@^5.8.5`, `@fastify/static@^9.1.3`, `better-sqlite3@^12.9.0` server-side; `react@^19.2.5`, `react-dom@^19.2.5`, `radix-ui@^1.4.3`, `lucide-react@^1.11.0` client-side) are current major versions with no known unpatched advisories at review time. Lockfile present and committed.

---

## Rejected findings (recorded for future audits)

These were raised by the automated review pass and rejected after re-reading the code. Documented so the next reviewer doesn't re-flag them.

1. **"Path traversal via `setNotFoundHandler` calling `reply.sendFile('index.html')`."** Rejected — the filename argument is a hardcoded string literal. `@fastify/static`'s `sendFile` resolves it against the registered `root` (the `clientDist` absolute path) and rejects `..` traversal at the plugin layer. `request.url` is only used for the `startsWith("/api/")` routing decision, never as a path component. Even with `curl --path-as-is "/api/../../etc/passwd"`, the served file is still `index.html`.

2. **"Server binds to `0.0.0.0` instead of `127.0.0.1`."** Rejected — required for the container to be reachable from the compose network and from health probes. The prod compose definition does not publish port 3000 to the host; only the nginx frontend's port 8080 is exposed. The `0.0.0.0` bind is correct for the deployment topology.

---

## Recommended order of remediation

If you want to land the fixes incrementally:

1. **Same change to [server/src/security.ts](server/src/security.ts)** — extend CSP (`frame-ancestors`, `base-uri`, `form-action`), add HSTS in production, add `Permissions-Policy`. One file, ~5 added lines, addresses findings #1, #4, #5.
2. **[server/src/routes/health.ts](server/src/routes/health.ts)** — drop the raw error message from the 503 body. ~2 lines, addresses #3.
3. **[server/src/db.ts](server/src/db.ts)** — narrow umask before `new Database()`. ~3 lines, addresses #2.
4. _(Optional)_ — drop `uptimeMs` from `/health`, gate `info.componentStack` on `import.meta.env.DEV`. Both informational; defer if there's no other reason to touch those files.
