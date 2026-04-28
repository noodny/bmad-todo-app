import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library: tear down rendered DOM between tests.
afterEach(() => {
  cleanup();
});
