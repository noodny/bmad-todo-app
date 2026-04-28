import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { closeDb } from "./db.js";
import tasksRoutes from "./routes/tasks.js";
import healthRoutes from "./routes/health.js";
import registerSecurityHeaders from "./security.js";

const DEFAULT_PORT = 3000;
const portRaw = Number(process.env.PORT ?? DEFAULT_PORT);

if (Number.isNaN(portRaw) || portRaw < 0 || portRaw > 65535) {
  console.error(
    `Invalid PORT: ${process.env.PORT ?? DEFAULT_PORT}. Must be a number between 0 and 65535.`,
  );
  process.exit(1);
}
const port = portRaw;
const isProduction = process.env.NODE_ENV === "production";
// Opt-out for split-tier deploys (e.g. nginx serves SPA, this process serves API only).
const serveStatic = process.env.SERVE_STATIC !== "false";

const app = Fastify({
  logger: {
    // Explicit LOG_LEVEL wins; otherwise default by environment.
    level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  },
  // Reject unknown props + non-string coercions (Fastify defaults strip/coerce).
  ajv: {
    customOptions: {
      removeAdditional: false,
      coerceTypes: false,
    },
  },
});

// Fail-fast on uncaught/unhandled errors; setImmediate flushes pino before exit.
const fatalExit = (msg: string, payload: object) => {
  app.log.error(payload, msg);
  setImmediate(() => process.exit(1));
};
process.on("uncaughtException", (err) => fatalExit("Uncaught exception", { err }));
process.on("unhandledRejection", (reason, promise) => fatalExit("Unhandled promise rejection", { reason, promise }));

// Security headers via direct call (not register — encapsulation scopes hooks).
registerSecurityHeaders(app);

// Health endpoints intentionally live outside /api — they're for orchestrators
// (Docker/k8s probes), not API consumers. No prefix keeps them stable.
await app.register(healthRoutes);

// AR25: API routes BEFORE @fastify/static so SPA catchall doesn't shadow /api/*.
await app.register(tasksRoutes, { prefix: "/api" });

if (isProduction && serveStatic) {
  const here = dirname(fileURLToPath(import.meta.url));
  const clientDist = resolve(here, "../../client/dist");

  if (!existsSync(clientDist)) {
    app.log.error(
      `Client dist directory not found at ${clientDist}. Did you run 'npm run build'?`,
    );
    process.exit(1);
  }

  await app.register(fastifyStatic, {
    root: clientDist,
    wildcard: false,
  });
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/")) {
      reply.code(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Unknown API route",
      });
      return;
    }
    try {
      return await reply.type("text/html").sendFile("index.html");
    } catch (err) {
      app.log.error(
        `Failed to send index.html: ${(err as Error).message}`,
      );
      if (!reply.sent) {
        reply.code(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: "Failed to load SPA shell",
        });
      }
    }
  });
}

let shuttingDown = false;
const gracefulShutdown = async (sig: NodeJS.Signals) => {
  if (shuttingDown) {
    app.log.info(`Received ${sig}; shutdown already in progress, ignoring.`);
    return;
  }
  shuttingDown = true;
  app.log.info(`Received ${sig}; closing server gracefully...`);
  try {
    await app.close();
    try {
      closeDb();
    } catch (dbErr) {
      app.log.error({ err: dbErr }, "Error closing DB during shutdown");
    }
    app.log.info("Server closed successfully");
    process.exit(0);
  } catch (err) {
    app.log.error(
      `Error during graceful shutdown: ${(err as Error).message}`,
    );
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));


try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
