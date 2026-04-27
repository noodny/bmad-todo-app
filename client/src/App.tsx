import { useEffect } from "react";
import { AlertCircle, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/PageBanner";
import TaskInput from "@/components/TaskInput";
import TaskList from "@/components/TaskList";
import { useTasks, LOAD_FAIL_MESSAGE } from "@/hooks/useTasks";

function App() {
  const { tasks, isLoading, loadError, online, createTask, toggleTask, deleteTask, retryInitialLoad, retryMutation } = useTasks();

  // Story 2.1 AC5: park focus in input when the list goes empty.
  useEffect(() => {
    if (!isLoading && tasks.length === 0) {
      document.getElementById("task-input")?.focus();
    }
  }, [tasks.length, isLoading]);

  return (
    <main className="mx-auto max-w-150 p-4 md:p-8 pt-8 md:pt-16">
      <div className="flex flex-col gap-6 md:gap-8">
        {loadError && (
          <PageBanner
            icon={<AlertCircle className="size-5 text-destructive" />}
            message={LOAD_FAIL_MESSAGE}
            action={
              <Button variant="outline" size="default" onClick={retryInitialLoad}>
                Retry
              </Button>
            }
          />
        )}
        {!online && (
          <PageBanner
            icon={<WifiOff className="size-5" />}
            message="Offline — changes will sync when you reconnect."
          />
        )}
        <TaskInput onSubmit={createTask} />
        <TaskList
          tasks={tasks}
          isLoading={isLoading}
          onToggle={toggleTask}
          onDelete={deleteTask}
          onRetry={retryMutation}
        />
      </div>
    </main>
  );
}

export default App;
