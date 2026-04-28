import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";

// Use an isolated DB per test file (matches db.test.ts / tasks.test.ts pattern).
const TEST_DB = join(tmpdir(), `bmad-test-health-${process.pid}.db`);
process.env.DB_PATH = TEST_DB;

const { default: healthRoutes } = await import("./health.js");
const dbModule = await import("../db.js");

describe("routes/health", () => {
  let app: FastifyInstance;

  before(async () => {
    app = Fastify({ logger: false });
    await app.register(healthRoutes);
    await app.ready();
  });

  beforeEach(() => {
    // Clear so any test can rely on an empty table.
    for (const t of dbModule.listTasks()) dbModule.deleteTask(t.id);
  });

  after(async () => {
    await app.close();
    try {
      dbModule.closeDb();
    } catch {
      // Already closed by the readiness-failure test — closeDb is idempotent enough.
    }
    for (const ext of ["", "-shm", "-wal"]) {
      const f = TEST_DB + ext;
      if (existsSync(f)) unlinkSync(f);
    }
  });

  it("GET /health returns 200 with status=ok and a numeric uptime", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, "ok");
    assert.equal(typeof body.uptimeMs, "number");
    assert.ok(body.uptimeMs >= 0);
  });

  it("GET /health/ready returns 200 with db=ok when SQLite is healthy", async () => {
    const res = await app.inject({ method: "GET", url: "/health/ready" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, "ready");
    assert.equal(body.db, "ok");
  });

  it("GET /health/ready returns 503 with db=error when the DB is unusable", async () => {
    // Close the connection — subsequent prepared-statement calls throw.
    // This test runs LAST in the file so closing here doesn't break the others;
    // node:test runs `it` blocks in declaration order within a `describe`.
    dbModule.closeDb();

    const res = await app.inject({ method: "GET", url: "/health/ready" });
    assert.equal(res.statusCode, 503);
    const body = res.json();
    assert.equal(body.status, "not_ready");
    assert.equal(body.db, "error");
    assert.equal(typeof body.error, "string");
  });
});
