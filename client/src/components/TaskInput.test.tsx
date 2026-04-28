import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskInput from "./TaskInput";

describe("TaskInput", () => {
  it("autofocuses on mount", () => {
    render(<TaskInput onSubmit={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("submits the trimmed value on Enter and clears the field", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<TaskInput onSubmit={onSubmit} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.type(input, "  buy bread  ");
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledWith("buy bread");
    expect(input.value).toBe("");
  });

  it("does not submit empty / whitespace-only input on Enter", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<TaskInput onSubmit={onSubmit} />);

    await user.type(screen.getByRole("textbox"), "   ");
    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Shift+Enter does NOT submit", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<TaskInput onSubmit={onSubmit} />);

    await user.type(screen.getByRole("textbox"), "draft");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Escape clears the value", async () => {
    const user = userEvent.setup();
    render(<TaskInput onSubmit={vi.fn()} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    await user.type(input, "noisy draft");
    expect(input.value).toBe("noisy draft");
    await user.keyboard("{Escape}");
    expect(input.value).toBe("");
  });

  it("paste exceeding MAX_LENGTH truncates and shows the over-limit hint", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<TaskInput onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    await user.click(input);
    await user.paste("x".repeat(250));

    expect(input.value.length).toBe(200);
    expect(screen.getByRole("status")).toHaveTextContent("Up to 200 characters");
  });
});
