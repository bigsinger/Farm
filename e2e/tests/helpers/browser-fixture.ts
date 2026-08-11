import { test as base, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ApiClient } from "../../lib/api.js";
import { createHarness, type IsolatedHarness } from "../../lib/harness.js";

interface BrowserFixtures {
  harness: IsolatedHarness;
  api: ApiClient;
  appPage: Page;
}

export const test = base.extend<BrowserFixtures>({
  harness: async ({}, use, testInfo) => {
    const harness = await createHarness(`ui-${testInfo.project.name}-${testInfo.title}`);
    await harness.startServer({ AGENT_FARM_E2E: "1" });
    try {
      await use(harness);
    } finally {
      if (harness.server) {
        await Promise.all([
          writeFile(join(harness.artifactDir, "server.stdout.log"), harness.server.stdout()),
          writeFile(join(harness.artifactDir, "server.stderr.log"), harness.server.stderr()),
        ]);
        if (testInfo.status !== testInfo.expectedStatus) {
          await testInfo.attach("server-stdout", { body: Buffer.from(harness.server.stdout()), contentType: "text/plain" });
          await testInfo.attach("server-stderr", { body: Buffer.from(harness.server.stderr()), contentType: "text/plain" });
        }
      }
      const proof = await harness.cleanup();
      await testInfo.attach("cleanup-proof", {
        body: Buffer.from(`${JSON.stringify(proof, null, 2)}\n`),
        contentType: "application/json",
      });
      const failed = Object.entries(proof)
        .filter(([key]) => key !== "checkedAt")
        .filter(([, value]) => value !== true)
        .map(([key]) => key);
      if (failed.length > 0) throw new Error(`Cleanup proof failed: ${failed.join(", ")}`);
    }
  },

  api: async ({ harness }, use) => {
    if (!harness.server) throw new Error("Server fixture is not running");
    await use(new ApiClient(harness.server.baseUrl));
  },

  appPage: async ({ page, harness }, use) => {
    if (!harness.server) throw new Error("Server fixture is not running");
    await page.goto(`${harness.server.baseUrl}/web/`);
    await use(page);
  },
});

export { expect };
