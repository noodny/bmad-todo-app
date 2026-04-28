/// <reference types="vitest/config" />
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: false,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      // Component DOM tests can't safely run in worker threads with mocks of
      // module-level imports — keep them in the main thread.
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        // 70% gate per project policy.
        thresholds: { lines: 70, branches: 70, functions: 70, statements: 70 },
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/**/*.test.{ts,tsx}",
          "src/test/**",
          "src/main.tsx",
          "src/App.tsx", // pure composition — covered by Playwright e2e
          "src/components/ui/**", // shadcn-generated primitives
          "src/api/types.ts",     // type-only
          "src/index.css",
        ],
      },
    },
  }),
);
