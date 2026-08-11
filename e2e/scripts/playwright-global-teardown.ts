import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cleanupRegisteredServerProcesses } from "../lib/process-registry.js";
import { TEST_RESULTS_ROOT } from "../lib/harness.js";

export default async function globalTeardown(): Promise<void> {
  const processCleanup = await cleanupRegisteredServerProcesses(join(TEST_RESULTS_ROOT, "server-processes.jsonl"));
  const proof = {
    schema_version: "agent-farm.browser-process-cleanup.v1",
    run_id: process.env.AGENT_FARM_E2E_RUN_ID ?? null,
    completed_at: new Date().toISOString(),
    process_cleanup: processCleanup,
  };
  await writeFile(
    join(TEST_RESULTS_ROOT, "browser-process-cleanup.json"),
    `${JSON.stringify(proof, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  if (
    processCleanup.remaining_process_groups.length > 0 ||
    processCleanup.identity_mismatch_process_groups.length > 0 ||
    processCleanup.registry_parse_errors.length > 0
  ) {
    throw new Error(`Browser server cleanup proof failed: ${JSON.stringify(processCleanup)}`);
  }
}
