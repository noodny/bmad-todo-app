import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Five-scenario E2E suite covering Journey 1 + the per-row error path:
 *   1. create todo
 *   2. complete todo
 *   3. delete todo
 *   4. empty state
 *   5. error handling (failed mutation → SYNC_FAIL → AlertCircle + Retry)
 */

async function clearTasks(request: APIRequestContext) {
  const res = await request.get("/api/tasks");
  const tasks = (await res.json()) as Array<{ id: string }>;
  for (const t of tasks) {
    await request.delete(`/api/tasks/${t.id}`);
  }
}

test.beforeEach(async ({ request, page }) => {
  await clearTasks(request);
  await page.goto("/");
  // Wait for the initial fetch to settle (skeletons gone).
  await expect(page.locator("ul[aria-label='Tasks']")).not.toHaveAttribute("aria-busy", "true");
});

test("create todo — Enter on input appends an <li> with the typed text", async ({ page }) => {
  const input = page.locator("#task-input");
  await expect(input).toBeFocused();
  await input.fill("buy bread");
  await input.press("Enter");

  const list = page.locator("ul[aria-label='Tasks']");
  await expect(list.locator("li").filter({ hasText: "buy bread" })).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
});

test("complete todo — clicking the checkbox applies strikethrough + opacity", async ({ page }) => {
  await page.locator("#task-input").fill("complete me");
  await page.locator("#task-input").press("Enter");

  const row = page.locator("ul[aria-label='Tasks'] li").filter({ hasText: "complete me" });
  await expect(row).toBeVisible();
  await row.locator("button[role='checkbox']").click();

  await expect(row.locator("span[id^='task-']").first()).toHaveClass(/line-through/);
  await expect(row).toHaveClass(/opacity-60/);

  // Verify it persists across reload.
  await page.reload();
  const reloadedRow = page.locator("ul[aria-label='Tasks'] li").filter({ hasText: "complete me" });
  await expect(reloadedRow.locator("button[role='checkbox']")).toHaveAttribute("aria-checked", "true");
});

test("delete todo — clicking × removes the row from the list", async ({ page }) => {
  await page.locator("#task-input").fill("remove me");
  await page.locator("#task-input").press("Enter");

  const row = page.locator("ul[aria-label='Tasks'] li").filter({ hasText: "remove me" });
  await expect(row).toBeVisible();

  await row.hover();
  await row.locator("button", { hasText: /^$/ }).filter({ has: page.locator("svg") }).click();

  await expect(page.locator("ul[aria-label='Tasks'] li").filter({ hasText: "remove me" })).toHaveCount(0);
  // Focus parks back in the input (Story 2.1 AC5).
  await expect(page.locator("#task-input")).toBeFocused();
});

test("empty state — no <li> renders below the input; placeholder is the only invitation", async ({ page }) => {
  const list = page.locator("ul[aria-label='Tasks']");
  // The <ul> with zero children has no rendered area; toBeAttached is the
  // correct semantic ("DOM presence with right ARIA"), not toBeVisible.
  await expect(list).toBeAttached();
  await expect(list).toHaveAttribute("aria-busy", "false");
  await expect(list.locator("li")).toHaveCount(0);

  const input = page.locator("#task-input");
  await expect(input).toHaveAttribute("placeholder", "Task");
  await expect(input).toBeFocused();

  // No instructional copy / illustration / onboarding modal beyond the input.
  await expect(page.getByText(/your list is empty/i)).toHaveCount(0);
  await expect(page.getByText(/add your first task/i)).toHaveCount(0);
  await expect(page.getByText(/get started/i)).toHaveCount(0);
  await expect(page.locator("[role='dialog']")).toHaveCount(0);
});

test("error handling — failed POST surfaces AlertCircle + Retry; click Retry to recover", async ({ page }) => {
  // Block POST /api/tasks → optimistic add lands then SYNC_FAIL flips status to 'failed'.
  await page.route("**/api/tasks", async (route) => {
    if (route.request().method() === "POST") {
      await route.abort("failed");
    } else {
      await route.continue();
    }
  });

  await page.locator("#task-input").fill("flaky network");
  await page.locator("#task-input").press("Enter");

  const row = page.locator("ul[aria-label='Tasks'] li").filter({ hasText: "flaky network" });
  await expect(row).toBeVisible();
  await expect(row.locator("[aria-label='Save failed']")).toBeVisible();
  await expect(row.locator("button", { hasText: "Retry" })).toBeVisible();

  // Unblock the network and click Retry → row clears to synced state.
  await page.unroute("**/api/tasks");
  await row.locator("button", { hasText: "Retry" }).click();

  await expect(row.locator("[aria-label='Save failed']")).toHaveCount(0);
  await expect(row.locator("button", { hasText: "Retry" })).toHaveCount(0);
  // Verify persistence: the task was saved server-side.
  const res = await page.request.get("/api/tasks");
  const tasks = (await res.json()) as Array<{ text: string }>;
  expect(tasks.filter((t) => t.text === "flaky network")).toHaveLength(1);
});
