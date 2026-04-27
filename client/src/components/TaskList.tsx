import type { ClientTask } from "@/state/tasksReducer";
import TaskItem from "./TaskItem";

interface TaskListProps {
  tasks: ClientTask[];
  isLoading: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}

const SKELETON_ROWS = 3;

function TaskList({ tasks, isLoading, onToggle, onDelete, onRetry }: TaskListProps) {
  return (
    <ul
      role="list"
      aria-live="polite"
      aria-label="Tasks"
      aria-busy={isLoading}
      className="flex flex-col gap-2"
    >
      {isLoading
        ? Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <li
              key={`skeleton-${i}`}
              aria-hidden="true"
              className="h-11 rounded animate-pulse bg-muted"
            />
          ))
        : tasks
            .filter((t) => !(t.status === "pending" && t.pendingMutation === "delete"))
            .map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={onToggle}
                onDelete={onDelete}
                onRetry={onRetry}
              />
            ))}
    </ul>
  );
}

export default TaskList;
