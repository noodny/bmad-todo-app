import type { FastifyInstance } from "fastify";
import { listTasks, createTask, updateTask, deleteTask } from "../db.js";

// Task shape duplicated locally per AR23 — do NOT import from db.ts.
// Cross-package / cross-module shape coupling is rejected; ~10 lines of
// duplication is the cheaper trade for a frozen-post-MVP product.
interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

// crypto.randomUUID() emits lowercase UUID v4. Reject uppercase strictly.
const UUID_V4 =
  "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

const createBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "text"],
  properties: {
    id: { type: "string", pattern: UUID_V4 },
    text: { type: "string", minLength: 1, maxLength: 200 },
  },
} as const;

const patchBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["completed"],
  properties: {
    completed: { type: "boolean" },
  },
} as const;

const idParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: { type: "string", pattern: UUID_V4 },
  },
} as const;

export default async function tasksRoutes(app: FastifyInstance): Promise<void> {
  app.get("/tasks", async (): Promise<Task[]> => listTasks());

  app.post<{ Body: { id: string; text: string } }>(
    "/tasks",
    { schema: { body: createBodySchema } },
    async (req, reply) => {
      const task = createTask(req.body);
      reply.code(201);
      return task;
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { completed: boolean };
  }>(
    "/tasks/:id",
    { schema: { params: idParamsSchema, body: patchBodySchema } },
    async (req, reply) => {
      const task = updateTask(req.params.id, {
        completed: req.body.completed,
      });
      if (!task) {
        reply.code(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Task not found",
        });
        return;
      }
      return task;
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/tasks/:id",
    { schema: { params: idParamsSchema } },
    async (req, reply) => {
      deleteTask(req.params.id);
      reply.code(204);
      return;
    },
  );
}
