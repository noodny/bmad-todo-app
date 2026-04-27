import TaskInput from "@/components/TaskInput";

function App() {
  const handleSubmit = (text: string) => {
    // Story 1.6 will replace this with a reducer dispatch + POST /api/tasks.
    console.log("TaskInput submitted:", text);
  };

  return (
    <main className="mx-auto max-w-150 p-4 md:p-8 pt-8 md:pt-16">
      <div className="flex flex-col gap-6 md:gap-8">
        <TaskInput onSubmit={handleSubmit} />
        {/* TaskList slot — Story 1.6 */}
        <div data-slot="task-list" />
      </div>
    </main>
  );
}

export default App;
