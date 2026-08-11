import { afterEach, beforeEach } from "node:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHarness, type CleanupProof, type IsolatedHarness } from "../../lib/harness.js";

export interface IntegrationContext {
  harness: IsolatedHarness;
  cleanupProof?: CleanupProof;
}

export function isolatedIntegration(label: string): IntegrationContext {
  const context = {} as IntegrationContext;
  beforeEach(async () => {
    context.harness = await createHarness(label);
  });
  afterEach(async () => {
    if (!context.harness) return;
    if (context.harness.server) {
      await Promise.all([
        writeFile(join(context.harness.artifactDir, "server.stdout.log"), context.harness.server.stdout()),
        writeFile(join(context.harness.artifactDir, "server.stderr.log"), context.harness.server.stderr()),
      ]);
    }
    context.cleanupProof = await context.harness.cleanup();
    const failed = Object.entries(context.cleanupProof)
      .filter(([key]) => key !== "checkedAt")
      .filter(([, value]) => value !== true)
      .map(([key]) => key);
    if (failed.length > 0) throw new Error(`Cleanup proof failed: ${failed.join(", ")}`);
  });
  return context;
}
