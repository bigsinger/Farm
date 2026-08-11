import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cleanupRegisteredServerProcesses } from "../lib/process-registry.js";

const here = dirname(fileURLToPath(import.meta.url));
const e2eRoot = resolve(here, "..");
const repositoryRoot = resolve(e2eRoot, "..");
const tsx = join(repositoryRoot, "server", "node_modules", ".bin", "tsx");
const integrationRoot = join(e2eRoot, "tests", "integration");
const suite = process.argv[2];
const requestedFiles = process.argv.slice(3);

const infrastructureFiles = [
  "isolation-and-git.test.ts",
  "preflight-and-benchmark.test.ts",
  "sqlite-fixture.test.ts",
  "ws-ledger.test.ts",
];

if (suite !== "infrastructure" && suite !== "integration") {
  throw new Error("run-node-tests.ts requires suite infrastructure or integration");
}

const safeRunId = (process.env.AGENT_FARM_E2E_RUN_ID?.replace(/[^a-zA-Z0-9_.-]+/g, "-") ||
  `node-${suite}-${process.pid}-${randomBytes(4).toString("hex")}`);
const resultsRoot = join(e2eRoot, "test-results", "runs", safeRunId);
const isolatedRoot = await mkdtemp(join(tmpdir(), `agent-farm-${suite}-`));
const dataDir = join(isolatedRoot, "data");
const homeDir = join(isolatedRoot, "home");
await Promise.all([
  mkdir(dataDir, { recursive: true, mode: 0o700 }),
  mkdir(homeDir, { recursive: true, mode: 0o700 }),
  mkdir(resultsRoot, { recursive: true }),
]);
const processRegistryPath = join(resultsRoot, "server-processes.jsonl");
await writeFile(processRegistryPath, "", { encoding: "utf8", mode: 0o600 });

const availableIntegrationFiles = (await readdir(integrationRoot))
  .filter((name) => name.endsWith(".test.ts"))
  .sort();
const allowedFiles = suite === "infrastructure" ? infrastructureFiles : availableIntegrationFiles;
for (const name of requestedFiles) {
  if (!/^[a-zA-Z0-9_.-]+\.test\.ts$/.test(name) || !allowedFiles.includes(name)) {
    throw new Error(`Unknown or unsafe ${suite} test file: ${name}`);
  }
}
const testFiles = requestedFiles.length > 0 ? requestedFiles : allowedFiles;
if (testFiles.length === 0) throw new Error(`No ${suite} test files found`);
const testConcurrency = Number(process.env.AGENT_FARM_E2E_NODE_CONCURRENCY ?? "2");
if (!Number.isSafeInteger(testConcurrency) || testConcurrency < 1 || testConcurrency > 8) {
  throw new Error("AGENT_FARM_E2E_NODE_CONCURRENCY must be an integer from 1 through 8");
}
const proveSuiteProcessCleanup =
  process.platform !== "win32" &&
  suite === "integration" &&
  testFiles.length === 1 &&
  testFiles[0] === "isolation-and-git.test.ts";
const cleanupFixturePath = join(resultsRoot, "suite-process-cleanup-fixture.json");

let child: ChildProcess | null = null;
let forwardedSignal: NodeJS.Signals | null = null;
let childExitCode: number | null = null;
let childSignal: NodeJS.Signals | null = null;
let cleanupError: string | null = null;
let processCleanup = await cleanupRegisteredServerProcesses(processRegistryPath, 0);
const stdoutChunks: Buffer[] = [];
const stderrChunks: Buffer[] = [];
const startedAt = new Date().toISOString();

type NodeTestSummary = {
  tests: number;
  suites: number;
  pass: number;
  fail: number;
  cancelled: number;
  skipped: number;
  todo: number;
  duration_ms: number;
};

function parseNodeTestSummary(tap: string): NodeTestSummary | null {
  const integer = (name: string): number | null => {
    const match = new RegExp(`^# ${name} (\\d+)$`, "m").exec(tap);
    return match ? Number(match[1]) : null;
  };
  const durationMatch = /^# duration_ms ([0-9]+(?:\.[0-9]+)?)$/m.exec(tap);
  const summary = {
    tests: integer("tests"),
    suites: integer("suites"),
    pass: integer("pass"),
    fail: integer("fail"),
    cancelled: integer("cancelled"),
    skipped: integer("skipped"),
    todo: integer("todo"),
    duration_ms: durationMatch ? Number(durationMatch[1]) : null,
  };
  return Object.values(summary).every((value) => value !== null && Number.isFinite(value))
    ? summary as NodeTestSummary
    : null;
}

function stopChild(signal: NodeJS.Signals): void {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (child.pid && process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall through when the process group has already exited.
    }
  }
  child.kill(signal);
}

const onSignal = (signal: NodeJS.Signals) => {
  forwardedSignal = signal;
  stopChild(signal);
};
process.once("SIGINT", onSignal);
process.once("SIGTERM", onSignal);

try {
  child = spawn(tsx, [
    "--test",
    "--test-reporter=tap",
    `--test-concurrency=${testConcurrency}`,
    ...testFiles.map((name) => join(integrationRoot, name)),
  ], {
    cwd: e2eRoot,
    env: {
      ...process.env,
      AGENT_FARM_E2E_RUN_ID: safeRunId,
      AGENT_FARM_E2E_PROVE_SUITE_PROCESS_CLEANUP: proveSuiteProcessCleanup ? "1" : "0",
      AGENT_FARM_DATA_DIR: dataDir,
      AGENT_FARM_DISABLE_USER_SETTINGS: "1",
      AGENT_FARM_DISABLE_PROVIDER: "1",
      AGENT_FARM_RUN_PROVIDER_E2E: "0",
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_AUTH_TOKEN: "",
      CLAUDE_CODE_OAUTH_TOKEN: "",
      CLAUDE_CODE_USE_BEDROCK: "",
      CLAUDE_CODE_USE_VERTEX: "",
      AWS_ACCESS_KEY_ID: "",
      AWS_SECRET_ACCESS_KEY: "",
      AWS_SESSION_TOKEN: "",
      AWS_PROFILE: "",
      GOOGLE_APPLICATION_CREDENTIALS: "",
      HOME: homeDir,
      USERPROFILE: homeDir,
      XDG_DATA_HOME: join(homeDir, ".local", "share"),
      XDG_CACHE_HOME: join(homeDir, ".cache"),
      NO_PROXY: "localhost,127.0.0.1,::1",
      no_proxy: "localhost,127.0.0.1,::1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  child.stdout?.on("data", (chunk: Buffer) => {
    const bytes = Buffer.from(chunk);
    stdoutChunks.push(bytes);
    process.stdout.write(bytes);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    const bytes = Buffer.from(chunk);
    stderrChunks.push(bytes);
    process.stderr.write(bytes);
  });
  const outcome = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolveExit, reject) => {
    child!.once("error", reject);
    child!.once("exit", (exitCode, signal) => resolveExit({ exitCode, signal }));
  });
  childExitCode = outcome.exitCode;
  childSignal = outcome.signal;
} finally {
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
  stopChild("SIGTERM");
  try {
    processCleanup = await cleanupRegisteredServerProcesses(processRegistryPath);
    await rm(isolatedRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  } catch (error) {
    cleanupError = error instanceof Error ? error.message : String(error);
  }
  let fixtureProcessGroupId: number | null = null;
  if (proveSuiteProcessCleanup) {
    try {
      const fixture = JSON.parse(await readFile(cleanupFixturePath, "utf8")) as Record<string, unknown>;
      if (
        fixture.schema_version !== "agent-farm.e2e-suite-cleanup-fixture.v1" ||
        fixture.run_id !== safeRunId ||
        !Number.isSafeInteger(fixture.process_group_id) ||
        Number(fixture.process_group_id) <= 0
      ) throw new Error("invalid suite process cleanup fixture proof");
      fixtureProcessGroupId = Number(fixture.process_group_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      cleanupError = cleanupError === null ? message : `${cleanupError}; ${message}`;
    }
  }
  const stdout = Buffer.concat(stdoutChunks).toString("utf8");
  const stderr = Buffer.concat(stderrChunks).toString("utf8");
  await Promise.all([
    writeFile(join(resultsRoot, `${suite}-node-test.tap`), stdout, { encoding: "utf8", mode: 0o600 }),
    writeFile(join(resultsRoot, `${suite}-node-test.stderr.log`), stderr, { encoding: "utf8", mode: 0o600 }),
  ]);
  const testSummary = parseNodeTestSummary(stdout);
  if (testSummary === null) {
    const message = "Node test TAP output did not contain a complete standard summary";
    cleanupError = cleanupError === null ? message : `${cleanupError}; ${message}`;
  }
  const suiteProcessCleanupProof = {
    required: proveSuiteProcessCleanup,
    fixture_process_group_id: fixtureProcessGroupId,
    registry_recorded:
      fixtureProcessGroupId !== null &&
      processCleanup.registered_process_groups.includes(fixtureProcessGroupId),
    initially_alive:
      fixtureProcessGroupId !== null &&
      processCleanup.initially_alive_process_groups.includes(fixtureProcessGroupId),
    terminated:
      fixtureProcessGroupId !== null &&
      (processCleanup.terminated_process_groups.includes(fixtureProcessGroupId) ||
        processCleanup.killed_process_groups.includes(fixtureProcessGroupId)),
    remaining:
      fixtureProcessGroupId !== null &&
      processCleanup.remaining_process_groups.includes(fixtureProcessGroupId),
  };
  const suiteProcessCleanupVerified =
    !suiteProcessCleanupProof.required ||
    (suiteProcessCleanupProof.fixture_process_group_id !== null &&
      suiteProcessCleanupProof.registry_recorded &&
      suiteProcessCleanupProof.initially_alive &&
      suiteProcessCleanupProof.terminated &&
      !suiteProcessCleanupProof.remaining);
  const rootRemoved = await readdir(dirname(isolatedRoot)).then(
    (entries) => !entries.includes(isolatedRoot.slice(dirname(isolatedRoot).length + 1)),
    () => true,
  );
  const proof = {
    schema_version: "agent-farm.node-test-cleanup.v1",
    suite,
    run_id: safeRunId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    test_file_count: testFiles.length,
    test_file_concurrency: testConcurrency,
    test_summary: testSummary,
    tap_artifact: `${suite}-node-test.tap`,
    stderr_artifact: `${suite}-node-test.stderr.log`,
    child_exit_code: childExitCode,
    child_signal: childSignal,
    forwarded_signal: forwardedSignal,
    process_stopped: child === null || child.exitCode !== null || child.signalCode !== null,
    isolated_root_removed: rootRemoved,
    data_directory_removed: rootRemoved,
    home_directory_removed: rootRemoved,
    process_cleanup: processCleanup,
    suite_process_cleanup_proof: {
      ...suiteProcessCleanupProof,
      verified: suiteProcessCleanupVerified,
    },
    cleanup_error: cleanupError,
  };
  await writeFile(
    join(resultsRoot, `${suite}-node-cleanup.json`),
    `${JSON.stringify(proof, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  if (
    !proof.process_stopped ||
    !rootRemoved ||
    testSummary === null ||
    testSummary.fail !== 0 ||
    testSummary.cancelled !== 0 ||
    testSummary.pass !== testSummary.tests ||
    !suiteProcessCleanupVerified ||
    cleanupError !== null ||
    processCleanup.remaining_process_groups.length > 0 ||
    processCleanup.identity_mismatch_process_groups.length > 0 ||
    processCleanup.registry_parse_errors.length > 0
  ) process.exitCode = 1;
}

if (process.exitCode !== 1) {
  if (forwardedSignal !== null) process.exitCode = 1;
  else process.exitCode = childExitCode ?? (childSignal === null ? 1 : 128);
}

if (process.argv[1] && import.meta.url !== pathToFileURL(process.argv[1]).href) {
  throw new Error("run-node-tests.ts must be executed as a script");
}
