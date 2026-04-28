import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

const Boom = (): never => {
  throw new Error("kaboom");
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React logs the caught error to console.error — silence to keep test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">happy</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("child")).toHaveTextContent("happy");
  });

  it("renders the fallback PageBanner with a Reload action when a child throws", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /Something went wrong\. Reload the page\./,
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
