import type { FastifyInstance } from "fastify";
import { healthCheck } from "../db.js";

const startedAt = Date.now();

export default async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Liveness — process is responsive. Cheap, no I/O, never 5xx.
  app.get("/health", async () => ({
    status: "ok",
    uptimeMs: Date.now() - startedAt,
  }));

  // Readiness — process AND its dependencies (DB) are usable.
  app.get("/health/ready", async (_req, reply) => {
    try {
      healthCheck();
      return { status: "ready", db: "ok" };
    } catch (err) {
      reply.code(503);
      return {
        status: "not_ready",
        db: "error",
        error: (err as Error).message,
      };
    }
  });
}
