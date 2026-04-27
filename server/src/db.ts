import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

interface TaskRow {
  id: string;
  text: string;
  completed: number;
  created_at: number;
}

const DEFAULT_DB_PATH = "./data/tasks.db";
const dbPath = resolve(process.env.DB_PATH || DEFAULT_DB_PATH);

try {
  mkdirSync(dirname(dbPath), { recursive: true });
} catch (err) {
  console.error(
    `Failed to create DB directory ${dirname(dbPath)}: ${(err as Error).message}`,
  );
  throw err;
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = FULL");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id         TEXT PRIMARY KEY,
    text       TEXT NOT NULL CHECK (length(text) <= 200),
    completed  INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
`);

const selectAllStmt = db.prepare(
  "SELECT id, text, completed, created_at FROM tasks ORDER BY created_at ASC",
);
const selectOneStmt = db.prepare(
  "SELECT id, text, completed, created_at FROM tasks WHERE id = ?",
);
const insertStmt = db.prepare(
  "INSERT OR IGNORE INTO tasks (id, text, completed, created_at) VALUES (?, ?, 0, ?)",
);
const updateStmt = db.prepare(
  "UPDATE tasks SET completed = ? WHERE id = ?",
);
const deleteStmt = db.prepare("DELETE FROM tasks WHERE id = ?");

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    text: row.text,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
  };
}

export function listTasks(): Task[] {
  const rows = selectAllStmt.all() as TaskRow[];
  return rows.map(rowToTask);
}

// INSERT OR IGNORE provides idempotency (NFR-R3); re-read inside the same
// transaction so retry callers see the *original* stored row.
const createTxn = db.transaction(
  (id: string, text: string, now: number): Task => {
    insertStmt.run(id, text, now);
    const row = selectOneStmt.get(id) as TaskRow | undefined;
    if (!row) {
      throw new Error(
        `createTask: row ${id} missing after INSERT OR IGNORE`,
      );
    }
    return rowToTask(row);
  },
);

export function createTask(input: { id: string; text: string }): Task {
  return createTxn(input.id, input.text, Date.now());
}

// Narrow signature: only `completed` is patchable (FR15 immutable createdAt + idempotency).
export function updateTask(
  id: string,
  patch: { completed: boolean },
): Task | null {
  const info = updateStmt.run(patch.completed ? 1 : 0, id);
  if (info.changes === 0) return null;
  const row = selectOneStmt.get(id) as TaskRow | undefined;
  return row ? rowToTask(row) : null;
}

// Idempotent delete — returns regardless of row existence (routes translate to 204).
export function deleteTask(id: string): void {
  deleteStmt.run(id);
}

export function closeDb(): void {
  db.close();
}
