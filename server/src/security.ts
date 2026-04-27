import type { FastifyInstance } from "fastify";

// Registers a global onSend hook. NOT wrapped as a Fastify plugin because
// plugin encapsulation would scope the hook to this "plugin"'s children
// only — sibling plugins (e.g. the tasks-routes plugin registered after)
// would not receive the headers. `fastify-plugin` would solve that, but
// it is a new prod dep which is forbidden per the project's 5/5 cap
// (NFR-M1, AR15). Direct mutation of the root app instance is the
// no-dep solution.
//
// Uses onSend (not onRequest) so headers land on every response,
// including 404s, error responses, and static files served by
// @fastify/static. Three headers only per spec — no @fastify/helmet.
export default function registerSecurityHeaders(app: FastifyInstance): void {
  app.addHook("onSend", async (_req, reply, payload) => {
    reply.header("Content-Security-Policy", "default-src 'self'");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "same-origin");
    return payload;
  });
}
