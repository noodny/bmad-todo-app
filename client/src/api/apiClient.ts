import type { Task } from "./types";

// Native fetch only — no client library (architecture's deliberate choice
// to preserve the NFR-M1 dep cap). Same-origin in production
// (@fastify/static), Vite dev-server proxy in development.

export async function listTasks(): Promise<Task[]> {
  const res = await fetch("/api/tasks");
  if (!res.ok) throw new Error(`GET /api/tasks failed: ${res.status}`);
  return (await res.json()) as Task[];
}

export async function createTask(input: {
  id: string;
  text: string;
}): Promise<Task> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`POST /api/tasks failed: ${res.status}`);
  return (await res.json()) as Task;
}

export async function updateTask(
  id: string,
  patch: { completed: boolean },
): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH /api/tasks/${id} failed: ${res.status}`);
  return (await res.json()) as Task;
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /api/tasks/${id} failed: ${res.status}`);
}
