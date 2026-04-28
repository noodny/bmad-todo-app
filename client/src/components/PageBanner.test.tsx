import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageBanner } from "./PageBanner";

describe("PageBanner", () => {
  it("renders message under role=alert with assertive live region", () => {
    render(<PageBanner icon={<span data-testid="icon" />} message="Something went wrong" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders the optional action when provided", () => {
    render(
      <PageBanner
        icon={<span />}
        message="error"
        action={<button>Retry</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("omits the action node when not provided", () => {
    render(<PageBanner icon={<span />} message="info" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
