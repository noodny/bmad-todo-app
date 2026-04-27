import TaskInput from "@/components/TaskInput";
import TaskList from "@/components/TaskList";
import { useTasks } from "@/hooks/useTasks";

function App() {
  const { tasks, isLoading, createTask, toggleTask, deleteTask } = useTasks();

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
