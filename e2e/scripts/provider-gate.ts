import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { TEST_RESULTS_ROOT } from "../lib/harness.js";
import { providerPreflight } from "../lib/provider-preflight.js";

async function main(): Promise<void> {
  const preflight = await providerPreflight();
  const proof = {
    schema_version: "agent-farm.e2e-provider-gate.v1",
    checked_at: new Date().toISOString(),
    status: preflight.status,
    blocked: preflight.status === "blocked",
    reason: preflight.reason,
    provider_preflight: preflight,
    secrets_printed: false,
  };
  await mkdir(TEST_RESULTS_ROOT, { recursive: true });
  const destination = join(TEST_RESULTS_ROOT, preflight.status === "ready" ? "provider-ready.json" : "provider-blocked.json");
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(proof, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  process.stdout.write(`${JSON.stringify(proof)}\n`);
  if (preflight.status !== "ready") process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
