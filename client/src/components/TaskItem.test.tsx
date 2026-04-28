import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskItem from "./TaskItem";
import type { ClientTask } from "@/state/tasksReducer";

const ID = "11111111-1111-4111-8111-111111111111";
const taskFixture = (overrides: Partial<ClientTask> = {}): ClientTask => ({
  id: ID,
  text: "buy bread",
  completed: false,
  createdAt: 1,
  status: "synced",
  ...overrides,
});

describe("TaskItem", () => {
  it("renders text and a checkbox; toggling fires onToggle with the inverse value", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <TaskItem
        task={taskFixture()}
        onToggle={onToggle}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("buy bread")).toBeInTheDocument();
    const cb = screen.getByRole("checkbox");
    await user.click(cb);
    expect(onToggle).toHaveBeenCalledWith(ID, true);
  });

  it("delete button fires onDelete with the task id", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <TaskItem
        task={taskFixture()}
        onToggle={vi.fn()}
        onDelete={onDelete}
        onRetry={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Delete task/i }));
    expect(onDelete).toHaveBeenCalledWith(ID);
  });

  it("status=failed shows a Retry button instead of Delete; click fires onRetry", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <TaskItem
        task={taskFixture({ status: "failed", pendingMutation: "create" })}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.queryByRole("button", { name: /Delete task/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Retry saving task/i }));
    expect(onRetry).toHaveBeenCalledWith(ID);
  });

  it("Space on the row toggles the task without scrolling the page", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <TaskItem
        task={taskFixture()}
        onToggle={onToggle}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    const li = screen.getByRole("listitem");
    li.focus();
    await user.keyboard(" ");
    expect(onToggle).toHaveBeenCalledWith(ID, true);
  });

  it("ArrowDown moves focus to the next sibling LI", async () => {
    const user = userEvent.setup();
    render(
      <ul>
        <TaskItem
          task={taskFixture({ id: "11111111-1111-4111-8111-111111111111", text: "first" })}
          onToggle={vi.fn()}
          onDelete={vi.fn()}
          onRetry={vi.fn()}
        />
        <TaskItem
          task={taskFixture({ id: "22222222-2222-4222-8222-222222222222", text: "second" })}
          onToggle={vi.fn()}
          onDelete={vi.fn()}
          onRetry={vi.fn()}
        />
      </ul>,
    );

    const [first, second] = screen.getAllByRole("listitem");
    first.focus();
    await user.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();
  });

  it("ArrowUp moves focus to the previous sibling LI", async () => {
    const user = userEvent.setup();
    render(
      <ul>
        <TaskItem
          task={taskFixture({ id: "11111111-1111-4111-8111-111111111111", text: "first" })}
          onToggle={vi.fn()}
          onDelete={vi.fn()}
          onRetry={vi.fn()}
        />
        <TaskItem
          task={taskFixture({ id: "22222222-2222-4222-8222-222222222222", text: "second" })}
          onToggle={vi.fn()}
          onDelete={vi.fn()}
          onRetry={vi.fn()}
        />
      </ul>,
    );

    const [first, second] = screen.getAllByRole("listitem");
    second.focus();
    await user.keyboard("{ArrowUp}");
    expect(first).toHaveFocus();
  });

  it("Delete key on the row fires onDelete", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <ul>
        <TaskItem
          task={taskFixture()}
          onToggle={vi.fn()}
          onDelete={onDelete}
          onRetry={vi.fn()}
        />
      </ul>,
    );

    const li = screen.getByRole("listitem");
    li.focus();
    await user.keyboard("{Delete}");
    expect(onDelete).toHaveBeenCalledWith(ID);
  });
});
