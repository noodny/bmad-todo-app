import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TaskList from "./TaskList";
import type { ClientTask } from "@/state/tasksReducer";

const task = (overrides: Partial<ClientTask>): ClientTask => ({
  id: "11111111-1111-4111-8111-111111111111",
  text: "buy bread",
  completed: false,
  createdAt: 1,
  status: "synced",
  ...overrides,
});

describe("TaskList", () => {
  it("renders 3 skeleton placeholders while isLoading=true", () => {
    const { container } = render(
      <TaskList
        tasks={[]}
        isLoading={true}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    const list = screen.getByRole("list");
    expect(list).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });

  it("renders a row for each task once loaded", () => {
    render(
      <TaskList
        tasks={[
          task({ id: "11111111-1111-4111-8111-111111111111", text: "alpha" }),
          task({ id: "22222222-2222-4222-8222-222222222222", text: "beta" }),
        ]}
        isLoading={false}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("hides rows whose pending mutation is delete (soft-delete UX)", () => {
    render(
      <TaskList
        tasks={[
          task({ id: "11111111-1111-4111-8111-111111111111", text: "visible" }),
          task({
            id: "22222222-2222-4222-8222-222222222222",
            text: "hidden",
            status: "pending",
            pendingMutation: "delete",
          }),
        ]}
        isLoading={false}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("visible")).toBeInTheDocument();
    expect(screen.queryByText("hidden")).toBeNull();
  });
});
