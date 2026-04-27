import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";

// Set DB_PATH BEFORE importing tasksRoutes (which imports db.js
// transitively). Use a different filename from db.test.ts so the two
// test files don't share state if run in the same process.
const TEST_DB = join(tmpdir(), `bmad-test-routes-${process.pid}.db`);
process.env.DB_PATH = TEST_DB;

const { default: tasksRoutes } = await import("./tasks.js");
const { closeDb } = await import("../db.js");

describe("routes/tasks", () => {
  let app: FastifyInstance;

  before(async () => {
    app = Fastify({
      logger: false,
      // Match production server's ajv strictness (Story 1.3).
      ajv: {
        customOptions: { removeAdditional: false, coerceTypes: false },
      },
    });
    await app.register(tasksRoutes, { prefix: "/api" });
    await app.ready();
  });

  beforeEach(async () => {
    // Clear DB rows between tests.
    const list = await app.inject({ method: "GET", url: "/api/tasks" });
    for (const t of list.json() as { id: string }[]) {
      await app.inject({ method: "DELETE", url: `/api/tasks/${t.id}` });
    }
  });

  after(async () => {
    await app.close();
    closeDb();
    for (const ext of ["", "-shm", "-wal"]) {
      const f = TEST_DB + ext;
      if (existsSync(f)) unlinkSync(f);
    }
  });

  it("AC2a — GET /api/tasks returns 200 with a JSON array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tasks" });
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.json()));
  });

  it("AC2b — POST /api/tasks with valid body returns 201 + stored task", async () => {
    const id = crypto.randomUUID();
    const res = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { "content-type": "application/json" },
      payload: { id, text: "buy bread" },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.id, id);
    assert.equal(body.text, "buy bread");
    assert.equal(body.completed, false);
    assert.equal(typeof body.createdAt, "number");
  });

  it("AC2c — POST with text > 200 chars returns 400 (Fastify default error shape)", async () => {
    const id = crypto.randomUUID();
    const res = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { "content-type": "application/json" },
      payload: { id, text: "a".repeat(201) },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(typeof body.statusCode, "number");
    assert.equal(typeof body.error, "string");
    assert.equal(typeof body.message, "string");
  });

  it("AC2d — PATCH updates completion and returns 200 with the updated task", async () => {
    const id = crypto.randomUUID();
    await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { "content-type": "application/json" },
      payload: { id, text: "togglable" },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${id}`,
      headers: { "content-type": "application/json" },
      payload: { completed: true },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.id, id);
    assert.equal(body.completed, true);
    assert.equal(body.text, "togglable");
  });

  it("AC2e — DELETE returns 204 for both existing and non-existent ids", async () => {
    const id = crypto.randomUUID();
    await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { "content-type": "application/json" },
      payload: { id, text: "deletable" },
    });

    const existingRes = await app.inject({
      method: "DELETE",
      url: `/api/tasks/${id}`,
    });
    assert.equal(existingRes.statusCode, 204);

    const missingId = crypto.randomUUID();
    const missingRes = await app.inject({
      method: "DELETE",
      url: `/api/tasks/${missingId}`,
    });
    assert.equal(missingRes.statusCode, 204);
  });
});
