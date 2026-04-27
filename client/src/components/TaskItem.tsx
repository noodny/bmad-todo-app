import type { KeyboardEvent } from "react";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ClientTask } from "@/state/tasksReducer";

interface TaskItemProps {
  task: ClientTask;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}

function TaskItem({ task, onToggle, onDelete, onRetry }: TaskItemProps) {
  const textId = `task-${task.id}-text`;
  const isFailed = task.status === "failed";

  const handleKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    const fromChild = e.target !== e.currentTarget;
    if (fromChild && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (e.key === " ") { e.preventDefault(); onToggle(task.id, !task.completed); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); onDelete(task.id); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = e.currentTarget.nextElementSibling;
      if (next instanceof HTMLElement && next.tagName === "LI") next.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = e.currentTarget.previousElementSibling;
      if (prev instanceof HTMLElement && prev.tagName === "LI") prev.focus();
      else document.getElementById("task-input")?.focus();
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
      {isFailed && <AlertCircle role="img" aria-label="Save failed" className="size-4 m-3.5 text-destructive" />}
      <div className="p-3.5">
        <Checkbox
          checked={task.completed}
          onCheckedChange={(v) => onToggle(task.id, v === true)}
          aria-labelledby={textId}
        />
      </div>
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
      {isFailed ? (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Retry saving task: ${task.text}`}
          onClick={() => onRetry(task.id)}
        >
          Retry
        </Button>
      ) : (
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
      )}
    </li>
  );
}

export default TaskItem;
