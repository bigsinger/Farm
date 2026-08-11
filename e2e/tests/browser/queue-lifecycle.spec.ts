import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FarmApi } from "../../lib/farm-api.js";
import { populateLifecycleRepository } from "../../lib/repository-scenarios.js";
import { test, expect } from "../helpers/browser-fixture.js";

test("real UI seed, dependency group, overlap evidence, inspector, diff gates, WS restart and wilt", async ({ appPage, harness }) => {
  test.setTimeout(12 * 60_000);
  const fixture = await harness.createGitFixture();
  const scenario = await populateLifecycleRepository(fixture);
  if (!harness.server) throw new Error("Server is not running");
  let farm = new FarmApi(harness.server.baseUrl);

  const upstream = await farm.seed({
    repoPath: fixture.repository,
    prompt: "Upstream UI dependency task.",
    title: "Upstream UI task",
    magnetPaths: [scenario.paths.magnet],
    autoStart: false,
  });
  await expect(appPage.getByTestId(`task-card-${upstream.task.id}`)).toBeVisible({ timeout: 30_000 });

  await appPage.getByTestId("seed-task").click();
  const dialog = appPage.getByTestId("seed-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("repo-path").fill(fixture.repository);
  await dialog.getByRole("textbox", { name: /标题/ }).fill("UI dependent overlap task");
  await dialog.getByTestId("prompt").fill("Create a real central queue task through the browser form.");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("textbox", { name: "Path 1" }).fill(scenario.paths.overlapChild);
  await dialog.getByRole("textbox", { name: "Mode" }).fill("shared");
  await dialog.getByRole("textbox", { name: /路径，每行一个/ }).fill(scenario.paths.magnet);
  const createdResponse = appPage.waitForResponse((response) =>
    response.url().endsWith("/api/tasks") && response.request().method() === "POST" && response.status() === 201,
  );
  await dialog.getByTestId("plant-btn").click();
  const createdBody = await (await createdResponse).json() as { task: { id: string } };
  const taskId = createdBody.task.id;
  expect(taskId).toBeTruthy();
  await expect(dialog).toBeHidden();

  const card = appPage.getByTestId(`task-card-${taskId}`);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("UI dependent overlap task");
  await expect(card).toContainText("1 dependencies");
  await expect(card).toContainText("1 claims");
  await expect(card).toContainText(/dependency_not_harvested|provider_auth_blocked/);
  const detail = await farm.task(taskId);
  expect(detail.task.dependency_ids).toEqual([upstream.task.id]);
  expect(detail.claims).toHaveLength(1);
  expect(detail.group).not.toBeNull();
  expect(detail.overlaps.some((overlap) => overlap.evidence_type === "magnet")).toBe(true);

  const group = appPage.locator('[data-testid^="group-"]').filter({ has: card });
  await expect(group).toContainText(/explicit dependency group/);
  await expect(group).toContainText("2 tasks");

  await appPage.getByRole("button", { name: "影响 / 证据" }).click();
  await expect(appPage.getByText("实线 = 显式 dependency")).toBeVisible();
  await expect(appPage.getByText("虚线 / 警示纹 = overlap evidence")).toBeVisible();
  await expect(appPage.getByTestId("overlap-evidence")).toContainText(scenario.paths.magnet);
  await expect(appPage.getByTestId("overlap-evidence")).toContainText(/该证据不表示 dependency 或协作/);

  await writeFile(join(detail.task.worktree_path!, "src", "provider", "task-b.txt"), "real browser-observed worktree diff\n");
  await appPage.getByRole("button", { name: "Central queue" }).click();
  await card.getByRole("button", { name: /打开 .* inspector/ }).click();
  const inspector = appPage.getByTestId("inspector");
  await expect(inspector).toBeVisible();
  await expect(inspector.getByTestId("modal-prompt")).toContainText("Create a real central queue task");

  await inspector.getByRole("tab", { name: "Timeline" }).click();
  await expect(inspector.getByTestId("timeline")).toBeVisible();
  await expect(inspector.getByTestId("timeline")).toContainText(/task.seeded|任务播种|seeded/i);
  await expect(inspector.getByTestId("timeline")).toContainText(/provenance|source|seq/i);

  await inspector.getByRole("tab", { name: "Diff" }).click();
  await expect(inspector.getByTestId("diff-content")).toBeVisible({ timeout: 30_000 });
  await expect(inspector.getByTestId("diff-content")).toContainText("task-b.txt");

  await inspector.getByRole("tab", { name: "控制台", exact: true }).click();
  await expect(inspector.getByTestId("review-approve")).toBeEnabled();
  await expect(inspector.getByTestId("review-reject")).toBeEnabled();
  await expect(inspector.getByTestId("harvest")).toBeDisabled();
  await expect(inspector.getByText(/证据 checklist 尚未全部满足/)).toBeVisible();
  await inspector.getByTestId("review-reject").click();
  const rejectedReviewResponse = appPage.waitForResponse((response) =>
    response.url().endsWith(`/api/tasks/${taskId}/reviews`) && response.request().method() === "POST",
  );
  await inspector.getByRole("button", { name: "拒绝当前 digest" }).click();
  const rejectedReview = await rejectedReviewResponse;
  expect(rejectedReview.status()).toBe(409);
  expect(await rejectedReview.json()).toMatchObject({ error: { code: "review_unavailable" } });
  await expect(inspector.getByText("The task is not awaiting review.", { exact: true })).toBeVisible();
  await inspector.getByRole("button", { name: "返回检查", exact: true }).click();
  await expect(inspector.getByRole("tab", { name: "控制台", exact: true })).toBeVisible();
  await expect(inspector.getByTestId("review-reject")).toBeFocused();

  await appPage.evaluate(() => {
    const target = document.querySelector('[data-testid="ws-status"]');
    const values: string[] = [];
    (window as unknown as { __wsStates: string[] }).__wsStates = values;
    if (target) {
      values.push(target.textContent ?? "");
      new MutationObserver(() => values.push(target.textContent ?? "")).observe(target, { childList: true, subtree: true, characterData: true });
    }
  });
  await harness.stopServer();
  await expect(appPage.getByTestId("ws-status")).toContainText(/断开|disconnected/i, { timeout: 30_000 });
  const restarted = await harness.restartServer();
  farm = new FarmApi(restarted.baseUrl);
  await expect(appPage.getByTestId("ws-status")).toContainText(/实时|live/i, { timeout: 60_000 });
  const states = await appPage.evaluate(() => (window as unknown as { __wsStates: string[] }).__wsStates);
  expect(states.some((state) => /断开|disconnected/i.test(state))).toBe(true);
  expect(states.some((state) => /回放|replay/i.test(state))).toBe(true);
  expect(states.some((state) => /实时|live/i.test(state))).toBe(true);

  await expect(inspector).toBeVisible();
  await inspector.getByRole("tab", { name: "控制台", exact: true }).click();
  await inspector.getByRole("textbox", { name: /Reason/ }).fill("Real UI wilt cleanup after gate coverage.");
  await inspector.getByTestId("wilt").click();
  await inspector.getByRole("button", { name: "确认 wilt" }).click();
  await expect(inspector).toBeHidden({ timeout: 30_000 });
  await expect(appPage.getByTestId(`task-card-${taskId}`)).toContainText(/wilted|已枯萎/i);
  const wilted = await farm.task(taskId);
  expect(wilted.task.status).toBe("wilted");
  expect(wilted.timeline.some((event) => event.type === "task.wilt.succeeded")).toBe(true);
});
