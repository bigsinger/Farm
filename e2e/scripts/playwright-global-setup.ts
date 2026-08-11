import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TEST_RESULTS_ROOT, WEB_APP_ROOT } from "../lib/harness.js";

export default async function globalSetup(): Promise<void> {
  await mkdir(TEST_RESULTS_ROOT, { recursive: true });
  await writeFile(join(TEST_RESULTS_ROOT, "server-processes.jsonl"), "", { encoding: "utf8", mode: 0o600 });
  const result = spawnSync("pnpm", ["build"], {
    cwd: WEB_APP_ROOT,
    env: { ...process.env, NO_PROXY: "localhost,127.0.0.1,::1", no_proxy: "localhost,127.0.0.1,::1" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const record = {
    schema_version: "agent-farm.web-build.v1",
    command: "pnpm build",
    cwd: WEB_APP_ROOT,
    started_by: "playwright.globalSetup",
    completed_at: new Date().toISOString(),
    exit_code: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
  };
  await writeFile(join(TEST_RESULTS_ROOT, "web-app-build.json"), `${JSON.stringify(record, null, 2)}\n`);
  if (result.status !== 0) {
    throw new Error(`web-app build failed before server startup (exit ${result.status ?? result.signal})\n${result.stdout}\n${result.stderr}`);
  }
}
