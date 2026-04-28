import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suite for the bmad-test app.
 *
 * Course-correction note: PRD/architecture originally rejected E2E tests for v1
 * (Story 1.8 dev notes). This suite was added later by explicit project-lead
 * direction and covers the 5 happy-/sad-path Journey 1 scenarios.
 *
 * Each test runs against a fresh prod build via the `webServer` block below.
 * Requires Node ≥ 24 (better-sqlite3 ABI). Tests are hermetic: each test clears
 * the DB via the API before its scenario.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // tests share a single backend DB; serialize them
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run build && DB_PATH=./data/e2e.db npm start",
    cwd: "..",
    url: "http://127.0.0.1:3000/api/tasks",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
});
