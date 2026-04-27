import type { KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Task } from "@/api/types";

interface TaskItemProps {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  const textId = `task-${task.id}-text`;

  const handleKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    // Ignore keys that originated inside an interactive child (the
    // checkbox or the delete button) so their own handlers stay
    // authoritative.
    const target = e.target as HTMLElement;
    if (target !== e.currentTarget) {
      // Still handle ArrowUp/ArrowDown at the row level even if focus
      // happens to be on a child — the user's intent is to navigate
      // rows, not anything child-specific.
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    }

    if (e.key === " ") {
      e.preventDefault();
      onToggle(task.id, !task.completed);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onDelete(task.id);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = e.currentTarget.nextElementSibling;
      if (next instanceof HTMLElement && next.tagName === "LI") {
        next.focus();
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = e.currentTarget.previousElementSibling;
      if (prev instanceof HTMLElement && prev.tagName === "LI") {
        prev.focus();
      } else {
        // First row → focus TaskInput.
        document.getElementById("task-input")?.focus();
      }
      return;
    }
  };

  return (
    <li
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-row-id={task.id}
      className={cn(
        "group relative flex items-center gap-1 rounded outline-none",
        "focus-within:ring-2 focus-within:ring-ring",
        "transition-opacity duration-100 ease-out",
        task.completed && "opacity-60",
      )}
    >
      {/* 44x44 checkbox hit area */}
      <div className="p-3.5">
        <Checkbox
          checked={task.completed}
          onCheckedChange={(v) => onToggle(task.id, v === true)}
          aria-labelledby={textId}
        />
      </div>
      {/* Task text */}
      <span
        id={textId}
        title={task.text}
        className={cn(
          "flex-1 truncate",
          task.completed && "line-through",
        )}
      >
        {task.text}
      </span>
      {/* Delete X */}
      <button
        type="button"
        aria-label={`Delete task: ${task.text}`}
        onClick={() => onDelete(task.id)}
        className={cn(
          "p-3.5 opacity-0 transition-opacity duration-150 ease-out outline-none",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          "[@media(hover:none)]:opacity-60",
          "focus-visible:opacity-100",
        )}
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

export default TaskItem;
