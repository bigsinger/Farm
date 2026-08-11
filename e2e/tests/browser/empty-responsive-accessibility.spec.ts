import { test, expect } from "../helpers/browser-fixture.js";

test.describe("central queue UI empty and accessibility states", () => {
  test("renders a real empty queue, seed controls, live WS and residual health", async ({ appPage }) => {
    await expect(appPage.getByTestId("ws-status")).toContainText(/实时|live/i);
    await expect(appPage.getByTestId("seed-task")).toBeVisible();
    await expect(appPage.getByTestId("plot-grid")).toContainText(/central queue is empty/i);
    await expect(appPage.getByTestId("plot-empty")).toBeVisible();
    await expect(appPage.locator('[data-testid^="task-card-"]')).toHaveCount(0);
    await expect(appPage.locator('[data-testid^="group-"]')).toHaveCount(0);
    await expect(appPage.getByTestId("inspector")).toHaveCount(0);
    await expect(appPage.getByTestId("timeline")).toHaveCount(0);
    await appPage.getByRole("button", { name: "Residual health" }).click();
    await expect(appPage.getByTestId("residual-health")).toBeVisible();
    await expect(appPage.getByTestId("residual-health")).toContainText(/还没有真实 benchmark artifact/);

    const main = appPage.getByRole("main");
    await expect(main).toBeVisible();
    await expect(appPage.getByRole("button", { name: "播种任务", exact: true }).first()).toBeEnabled();
  });

  test("seed dialog supports keyboard focus order and Escape without submitting", async ({ appPage }) => {
    const seedButton = appPage.getByTestId("seed-task");
    await seedButton.focus();
    await expect(seedButton).toBeFocused();
    await seedButton.press("Enter");

    const dialog = appPage.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    const focused = appPage.locator(":focus");
    await expect(focused).toBeVisible();
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);

    const focusable = dialog.locator('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
    const focusableCount = await focusable.count();
    expect(focusableCount).toBeGreaterThan(1);
    for (let index = 0; index < focusableCount + 1; index += 1) await appPage.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);

    await appPage.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(seedButton).toBeFocused();
    await expect(appPage.locator('[data-testid^="task-card-"]')).toHaveCount(0);
  });

  test("mobile viewport has no horizontal document overflow and dialog stays usable", async ({ appPage }) => {
    await appPage.setViewportSize({ width: 375, height: 812 });
    await appPage.reload();
    await expect(appPage.getByTestId("seed-task")).toBeVisible();
    const dimensions = await appPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    await appPage.getByTestId("seed-task").click();
    const dialog = appPage.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    expect(box!.height).toBeLessThanOrEqual(812);
  });

  test("reduced motion disables non-essential animation and transitions", async ({ page, harness }) => {
    if (!harness.server) throw new Error("Server fixture is not running");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${harness.server.baseUrl}/web/`);
    await expect(page.getByTestId("seed-task")).toBeVisible();
    const animated = page.locator("*", { hasNot: page.locator("script, style") });
    const violations = await animated.evaluateAll((elements) =>
      elements
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            tag: element.tagName,
            testid: element.getAttribute("data-testid"),
            animationDuration: style.animationDuration,
            transitionDuration: style.transitionDuration,
          };
        })
        .filter((entry) => {
          const durations = `${entry.animationDuration},${entry.transitionDuration}`
            .split(",")
            .map((value) => Number.parseFloat(value) || 0);
          return durations.some((duration) => duration > 0.01);
        }),
    );
    expect(violations).toEqual([]);
  });
});
