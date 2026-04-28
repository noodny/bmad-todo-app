import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import registerSecurityHeaders from "./security.js";

describe("security (response headers)", () => {
  let app: FastifyInstance;

  before(async () => {
    app = Fastify({ logger: false });
    registerSecurityHeaders(app);

    // Routes covering: 200, 404 (not-found handler), and a thrown 500.
    app.get("/ok", async () => ({ ok: true }));
    app.get("/boom", async () => {
      throw new Error("boom");
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  const expectHeaders = (headers: Record<string, string | string[] | undefined>) => {
    assert.equal(headers["content-security-policy"], "default-src 'self'");
    assert.equal(headers["x-content-type-options"], "nosniff");
    assert.equal(headers["referrer-policy"], "same-origin");
  };

  it("attaches all three headers on 2xx responses", async () => {
    const res = await app.inject({ method: "GET", url: "/ok" });
    assert.equal(res.statusCode, 200);
    expectHeaders(res.headers);
  });

  it("attaches all three headers on 404 responses", async () => {
    const res = await app.inject({ method: "GET", url: "/missing" });
    assert.equal(res.statusCode, 404);
    expectHeaders(res.headers);
  });

  it("attaches all three headers on 500 (thrown) responses", async () => {
    const res = await app.inject({ method: "GET", url: "/boom" });
    assert.equal(res.statusCode, 500);
    expectHeaders(res.headers);
  });
});
