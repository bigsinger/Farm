import { test as base, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ApiClient } from "../../lib/api.js";
import { createHarness, type IsolatedHarness } from "../../lib/harness.js";
import { providerPreflight, type ProviderPreflight } from "../../lib/provider-preflight.js";

interface ProviderFixtures {
  providerPreflight: ProviderPreflight;
  providerHarness: IsolatedHarness;
  providerApi: ApiClient;
}

export const providerTest = base.extend<ProviderFixtures>({
  providerPreflight: [
    async ({}, use, testInfo) => {
      const result = await providerPreflight();
      await testInfo.attach("provider-preflight", {
        body: Buffer.from(`${JSON.stringify(result, null, 2)}\n`),
        contentType: "application/json",
      });
      testInfo.skip(result.status !== "ready", `Provider E2E blocked: ${result.reason ?? "preflight did not become ready"}`);
      await use(result);
    },
    { scope: "test" },
  ],

  providerHarness: async ({ providerPreflight: preflight }, use, testInfo) => {
    if (preflight.status !== "ready") throw new Error(`Provider fixture started while blocked: ${preflight.reason}`);
    const harness = await createHarness(`provider-${testInfo.title}`, { inheritProviderSettings: true });
    await harness.startServer({
      AGENT_FARM_RUN_PROVIDER_E2E: "1",
      AGENT_FARM_PROVIDER_MAX_TURNS: process.env.AGENT_FARM_PROVIDER_MAX_TURNS ?? "8",
      AGENT_FARM_PROVIDER_MAX_BUDGET_USD: process.env.AGENT_FARM_PROVIDER_MAX_BUDGET_USD ?? "1.50",
      AGENT_FARM_PROVIDER_TASK_TIMEOUT_MS: process.env.AGENT_FARM_PROVIDER_TASK_TIMEOUT_MS ?? "240000",
      AGENT_FARM_PROVIDER_CONCURRENCY: "2",
      AGENT_FARM_E2E: "1",
    });
    try {
      await use(harness);
    } finally {
      if (harness.server) {
        await Promise.all([
          writeFile(join(harness.artifactDir, "provider-server.stdout.log"), harness.server.stdout()),
          writeFile(join(harness.artifactDir, "provider-server.stderr.log"), harness.server.stderr()),
        ]);
        if (testInfo.status !== testInfo.expectedStatus) {
          await testInfo.attach("provider-server-stdout", { body: Buffer.from(harness.server.stdout()), contentType: "text/plain" });
          await testInfo.attach("provider-server-stderr", { body: Buffer.from(harness.server.stderr()), contentType: "text/plain" });
        }
      }
      const proof = await harness.cleanup();
      await testInfo.attach("provider-cleanup-proof", {
        body: Buffer.from(`${JSON.stringify(proof, null, 2)}\n`),
        contentType: "application/json",
      });
      const failures = Object.entries(proof)
        .filter(([key]) => key !== "checkedAt")
        .filter(([, value]) => value !== true)
        .map(([key]) => key);
      if (failures.length > 0) throw new Error(`Provider cleanup failed: ${failures.join(", ")}`);
    }
  },

  providerApi: async ({ providerHarness }, use) => {
    if (!providerHarness.server) throw new Error("Provider server did not start");
    await use(new ApiClient(providerHarness.server.baseUrl));
  },
});

export { expect };
