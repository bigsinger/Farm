import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const e2eRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const resultsBase = join(e2eRoot, "test-results");
const suite = process.argv[2] ?? "all";
const allowed = new Set(["infrastructure", "integration", "browser", "local", "provider", "all"]);
if (!allowed.has(suite)) throw new Error(`Unknown E2E suite ${suite}`);

const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${suite}-${randomBytes(4).toString("hex")}`;
const runRoot = join(resultsBase, "runs", runId);
await mkdir(runRoot, { recursive: true });

interface StepRecord {
  name: string;
  command: string[];
  started_at: string;
  completed_at: string;
  duration_ms: number;
  exit_code: number | null;
  signal: NodeJS.Signals | null;
}

const commandSets: Record<string, Array<{ name: string; command: string[] }>> = {
  infrastructure: [{ name: "infrastructure", command: ["pnpm", "run", "_test:infrastructure"] }],
  integration: [{ name: "integration", command: ["pnpm", "run", "_test:integration"] }],
  browser: [{ name: "browser", command: ["pnpm", "run", "_test:browser"] }],
  local: [
    { name: "preflight", command: ["pnpm", "run", "preflight"] },
    { name: "typecheck", command: ["pnpm", "run", "typecheck"] },
    { name: "integration", command: ["pnpm", "run", "_test:integration"] },
    { name: "browser", command: ["pnpm", "run", "_test:browser"] },
  ],
  provider: [
    { name: "preflight", command: ["pnpm", "run", "preflight"] },
    { name: "provider", command: ["pnpm", "run", "_test:provider"] },
  ],
  all: [
    { name: "preflight", command: ["pnpm", "run", "preflight"] },
    { name: "typecheck", command: ["pnpm", "run", "typecheck"] },
    { name: "integration", command: ["pnpm", "run", "_test:integration"] },
    { name: "browser", command: ["pnpm", "run", "_test:browser"] },
    { name: "provider", command: ["pnpm", "run", "_test:provider"] },
  ],
};

const manifest = {
  schema_version: "agent-farm.e2e-suite.v1",
  run_id: runId,
  suite,
  started_at: new Date().toISOString(),
  completed_at: null as string | null,
  status: "running" as "running" | "passed" | "failed",
  run_root: runRoot,
  steps: [] as StepRecord[],
};

async function persist(): Promise<void> {
  await writeFile(join(runRoot, "suite.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(resultsBase, "latest.json"), `${JSON.stringify({
    schema_version: "agent-farm.e2e-latest.v1",
    run_id: runId,
    suite,
    status: manifest.status,
    run_root: runRoot,
    updated_at: new Date().toISOString(),
  }, null, 2)}\n`);
}

async function runStep(name: string, command: string[]): Promise<StepRecord> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const [executable, ...args] = command;
  const outcome = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    const child = spawn(executable!, args, {
      cwd: e2eRoot,
      env: {
        ...process.env,
        AGENT_FARM_E2E_RUN_ID: runId,
        NO_PROXY: "localhost,127.0.0.1,::1",
        no_proxy: "localhost,127.0.0.1,::1",
      },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  const completed = Date.now();
  return {
    name,
    command,
    started_at: startedAt,
    completed_at: new Date(completed).toISOString(),
    duration_ms: completed - started,
    exit_code: outcome.code,
    signal: outcome.signal,
  };
}

await persist();
try {
  for (const step of commandSets[suite]!) {
    const record = await runStep(step.name, step.command);
    manifest.steps.push(record);
    await persist();
    if (record.exit_code !== 0) {
      manifest.status = "failed";
      process.exitCode = record.exit_code ?? 1;
      break;
    }
  }
  if (manifest.status === "running") manifest.status = "passed";
} catch (error) {
  manifest.status = "failed";
  process.exitCode = 1;
  throw error;
} finally {
  manifest.completed_at = new Date().toISOString();
  await persist();
}

if (process.argv[1] && import.meta.url !== pathToFileURL(process.argv[1]).href) {
  throw new Error("run-suite.ts must be executed as a script");
}
