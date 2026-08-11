import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FarmApi } from "../../lib/farm-api.js";
import { test, expect } from "../helpers/browser-fixture.js";

test("real Git diff renders hostile filenames and lines as inert text", async ({ appPage, harness }) => {
  test.setTimeout(3 * 60_000);
  const fixture = await harness.createGitFixture();
  if (!harness.server) throw new Error("Server is not running");
  const farm = new FarmApi(harness.server.baseUrl);
  const task = await farm.seed({
    repoPath: fixture.repository,
    prompt: "Render the real task diff without executing repository-controlled HTML.",
    title: "Hostile diff rendering boundary",
    autoStart: false,
  });
  if (!task.task.worktree_path) throw new Error("Seeded task did not receive a real worktree");

  const marker = "__agentFarmDiffXss";
  const hostileFilename = `xss-<img src=x onerror=globalThis.${marker}='filename'>.txt`;
  const hostileLines = [
    `<script>globalThis.${marker}='script'</script>`,
    `<img src=x onerror="globalThis.${marker}='line-img'">`,
    `<svg onload="globalThis.${marker}='svg'"></svg>`,
    `<a href="javascript:globalThis.${marker}='link'">unsafe link text</a>`,
  ];
  await writeFile(join(task.task.worktree_path, hostileFilename), `${hostileLines.join("\n")}\n`);

  await appPage.evaluate((sentinel) => {
    (window as unknown as Record<string, unknown>)[sentinel] = "clean";
  }, marker);

  const card = appPage.getByTestId(`task-card-${task.task.id}`);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: /打开 .* inspector/ }).click();
  const inspector = appPage.getByTestId("inspector");
  await inspector.getByRole("tab", { name: "Diff 审查" }).click();
  const renderedDiff = inspector.getByTestId("diff-content");
  await expect(renderedDiff).toBeVisible({ timeout: 30_000 });
  await expect(renderedDiff).toContainText(hostileFilename);
  for (const line of hostileLines) await expect(renderedDiff).toContainText(line);

  const executableMarkup = await renderedDiff.evaluate((root) => {
    const findings: string[] = [];
    for (const element of root.querySelectorAll("*")) {
      for (const attribute of element.attributes) {
        if (/^on/i.test(attribute.name)) findings.push(`${element.tagName}.${attribute.name}`);
        if (/^(?:href|src|xlink:href|formaction)$/i.test(attribute.name) && /^\s*javascript:/i.test(attribute.value)) {
          findings.push(`${element.tagName}.${attribute.name}=${attribute.value}`);
        }
      }
      if (["SCRIPT", "IFRAME", "OBJECT", "EMBED"].includes(element.tagName)) findings.push(element.tagName);
    }
    return findings;
  });
  expect(executableMarkup).toEqual([]);
  await expect.poll(async () => await appPage.evaluate((sentinel) =>
    (window as unknown as Record<string, unknown>)[sentinel], marker)).toBe("clean");
});
