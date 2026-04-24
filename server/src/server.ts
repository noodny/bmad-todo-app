import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

const DEFAULT_PORT = 3000;
const portRaw = Number(process.env.PORT ?? DEFAULT_PORT);

// Validate port is in valid range
if (Number.isNaN(portRaw) || portRaw < 0 || portRaw > 65535) {
  console.error(
    `Invalid PORT: ${process.env.PORT ?? DEFAULT_PORT}. Must be a number between 0 and 65535.`,
  );
  process.exit(1);
}
const port = portRaw;
const isProduction = process.env.NODE_ENV === "production";

const app = Fastify({
  logger: {
    level: isProduction ? "info" : "debug",
  },
});

// Placeholder API surface — the real /api/tasks CRUD handlers arrive in Story 1.3.
// MUST register before @fastify/static so the SPA catchall does not shadow /api/*.
app.get("/api/tasks", async () => {
  return [];
});

if (isProduction) {
  const here = dirname(fileURLToPath(import.meta.url));
  const clientDist = resolve(here, "../../client/dist");

  // Verify client/dist directory exists before attempting to serve
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
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      reply
        .code(404)
        .send({
          statusCode: 404,
          error: "Not Found",
          message: "Unknown API route",
        });
      return;
    }
    reply
      .type("text/html")
      .sendFile("index.html")
      .catch((err) => {
        app.log.error(`Failed to send index.html: ${err.message}`);
        reply
          .code(500)
          .send({
            statusCode: 500,
            error: "Internal Server Error",
            message: "Failed to load SPA shell",
          });
      });
  });
}

// Graceful shutdown handlers
const gracefulShutdown = async (sig) => {
  app.log.info(`Received ${sig}; closing server gracefully...`);
  try {
    await app.close();
    app.log.info("Server closed successfully");
    process.exit(0);
  } catch (err) {
    app.log.error(`Error during graceful shutdown: ${err.message}`);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  app.log.error({ reason, promise }, "Unhandled promise rejection");
});

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
