function App() {
  return (
    <main className="mx-auto max-w-150 p-4 md:p-8 pt-8 md:pt-16">
      <div className="flex flex-col gap-6 md:gap-8">
        {/* TaskInput slot — Story 1.5 */}
        <div data-slot="task-input" />
        {/* TaskList slot — Story 1.6 */}
        <div data-slot="task-list" />
      </div>
    </main>
  );
}

export default App;
