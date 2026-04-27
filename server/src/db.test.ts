import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Set DB_PATH BEFORE importing db.js so the module-singleton picks up
// the test path instead of the production default.
const TEST_DB = join(tmpdir(), `bmad-test-db-${process.pid}.db`);
process.env.DB_PATH = TEST_DB;

const { listTasks, createTask, updateTask, deleteTask, closeDb } =
  await import("./db.js");

const VALID_UUID_A = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_B = "22222222-2222-4222-8222-222222222222";
const VALID_UUID_C = "33333333-3333-4333-8333-333333333333";
const NEVER_USED_UUID = "99999999-9999-4999-8999-999999999999";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("db (repository)", () => {
  beforeEach(() => {
    for (const t of listTasks()) deleteTask(t.id);
  });

  after(() => {
    closeDb();
    for (const ext of ["", "-shm", "-wal"]) {
      const f = TEST_DB + ext;
      if (existsSync(f)) unlinkSync(f);
    }
  });

  it("AC1a — listTasks() on an empty table returns []", () => {
    assert.deepStrictEqual(listTasks(), []);
  });

  it("AC1b — three tasks return in created_at ASC order", async () => {
    createTask({ id: VALID_UUID_A, text: "alpha" });
    await sleep(5);
    createTask({ id: VALID_UUID_B, text: "bravo" });
    await sleep(5);
    createTask({ id: VALID_UUID_C, text: "charlie" });

    const rows = listTasks();
    assert.equal(rows.length, 3);
    assert.deepStrictEqual(
      rows.map((t) => t.text),
      ["alpha", "bravo", "charlie"],
    );
    assert.ok(rows[0].createdAt < rows[1].createdAt);
    assert.ok(rows[1].createdAt < rows[2].createdAt);
  });

  it("AC1c — INSERT OR IGNORE: duplicate id returns original task, no second row", () => {
    const first = createTask({ id: VALID_UUID_A, text: "first" });
    const retry = createTask({ id: VALID_UUID_A, text: "RETRY-text" });

    assert.equal(listTasks().length, 1);
    assert.equal(retry.text, "first");
    assert.equal(retry.createdAt, first.createdAt);
    assert.equal(retry.id, first.id);
  });

  it("AC1d — updateTask preserves created_at exactly", () => {
    const created = createTask({ id: VALID_UUID_A, text: "alpha" });
    const updated = updateTask(VALID_UUID_A, { completed: true });

    assert.ok(updated, "updateTask should return the updated task, not null");
    assert.equal(updated!.createdAt, created.createdAt);
    assert.equal(updated!.completed, true);
    assert.equal(updated!.text, "alpha");
  });

  it("AC1e — deleteTask of a non-existent id does not throw", () => {
    assert.doesNotThrow(() => deleteTask(NEVER_USED_UUID));
  });

  it("returns task shape with camelCase keys, no created_at leakage", () => {
    const t = createTask({ id: VALID_UUID_A, text: "alpha" });
    assert.equal(typeof t.id, "string");
    assert.equal(typeof t.text, "string");
    assert.equal(typeof t.completed, "boolean");
    assert.equal(typeof t.createdAt, "number");
    assert.equal(Object.prototype.hasOwnProperty.call(t, "created_at"), false);
  });
});
