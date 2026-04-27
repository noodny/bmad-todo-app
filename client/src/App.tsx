import { useEffect } from "react";
import TaskInput from "@/components/TaskInput";
import TaskList from "@/components/TaskList";
import { useTasks } from "@/hooks/useTasks";

function App() {
  const { tasks, isLoading, createTask, toggleTask, deleteTask } = useTasks();

  // Story 2.1 AC5: when the list transitions to empty (e.g. user deletes the
  // last task), park focus back in the input. Idempotent — also re-fires on
  // the initial empty render, where TaskInput's mount-time autofocus already
  // owns the input, so .focus() is a harmless no-op.
  useEffect(() => {
    if (!isLoading && tasks.length === 0) {
      // SSR compatibility guard
      if (typeof document === "undefined") return;

      try {
        const inputElement = document.getElementById("task-input") as HTMLInputElement | null;
        // Type safety: verify element exists and is focusable
        if (inputElement && typeof inputElement.focus === "function") {
          // Accessibility guard: avoid stealing focus if user is actively interacting elsewhere
          const activeElement = document.activeElement;
          if (activeElement !== inputElement) {
            inputElement.focus();
          }
        }
      } catch (error) {
        // Silently handle focus failures (browser restrictions, etc.)
        console.warn("Failed to focus task input:", error);
      }
    }
  }, [tasks.length, isLoading]);

  return (
    <main className="mx-auto max-w-150 p-4 md:p-8 pt-8 md:pt-16">
      <div className="flex flex-col gap-6 md:gap-8">
        <TaskInput onSubmit={createTask} />
        <TaskList
          tasks={tasks}
          isLoading={isLoading}
          onToggle={toggleTask}
          onDelete={deleteTask}
        />
      </div>
    </main>
  );
}

export default App;
