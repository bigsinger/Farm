import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SandboxRuntimeConfigSchema,
  type SandboxRuntimeConfig,
} from "@anthropic-ai/sandbox-runtime";
import { RUNS_DIR } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const SRT_CLI = path.resolve(
  moduleDir,
  "../node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js",
);
const COMMAND_OUTPUT_LIMIT = 4 * 1024 * 1024;
const KILL_GRACE_MS = 2_000;
const SENSITIVE_ENV_NAME = /(?:token|api[_-]?key|secret|password|passwd|authorization|cookie|private[_-]?key|client[_-]?secret|credential)/i;

type CommandStopReason = "timed_out" | "cancelled";

type ActiveWorkspaceCommand = {
  child: ChildProcess;
  pid: number | null;
  stop: (reason: CommandStopReason) => void;
  completion: Promise<void>;
};

type WorkspaceSandboxRuntime = {
  active: Set<ActiveWorkspaceCommand>;
  closing: boolean;
};

export type WorkspaceSandbox = {
  runDir: string;
  homeDir: string;
  tempDir: string;
  policyPath: string;
  cwd: string;
  environment: NodeJS.ProcessEnv;
  runtime: WorkspaceSandboxRuntime;
};

export type WorkspaceCommandResult = {
  status: "succeeded" | "failed" | "timed_out" | "cancelled";
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  stdoutBytes: number;
  stderrBytes: number;
  stdoutSha256: string;
  stderrSha256: string;
  truncated: boolean;
  durationMs: number;
};

const activeSandboxes = new Map<string, WorkspaceSandboxRuntime>();

export class AgentSandboxError extends Error {
  readonly code = "agent_sandbox_unavailable";

  constructor(message: string) {
    super(message);
    this.name = "AgentSandboxError";
  }
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

async function canonicalExisting(candidate: string): Promise<string> {
  return path.normalize(await fs.realpath(path.resolve(candidate)));
}

async function existingPath(candidate: string): Promise<string | null> {
  try {
    return await canonicalExisting(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function systemReadRoots(): string[] {
  if (process.platform === "darwin") {
    return [
      "/bin",
      "/sbin",
      "/usr",
      "/System",
      "/Library",
      "/dev",
      "/private/etc/ssl",
      "/private/var/db/timezone",
    ];
  }
  if (process.platform === "linux") {
    return [
      "/bin",
      "/sbin",
      "/usr",
      "/lib",
      "/lib64",
      "/dev",
      "/etc/ssl",
      "/etc/ca-certificates",
    ];
  }
  if (process.platform === "win32") return [];
  throw new AgentSandboxError(`Sandbox Runtime does not support platform '${process.platform}'.`);
}

async function runtimeReadRoots(cwd: string): Promise<string[]> {
  const roots = new Set<string>();
  for (const candidate of [
    ...systemReadRoots(),
    path.dirname(process.execPath),
    path.resolve(moduleDir, "../node_modules/@anthropic-ai/sandbox-runtime"),
  ]) {
    const existing = await existingPath(candidate);
    if (existing) roots.add(existing);
  }

  const configured = process.env.AGENT_FARM_AGENT_RUNTIME_ROOTS
    ?.split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];
  const home = await existingPath(os.homedir());
  for (const entry of configured) {
    if (!path.isAbsolute(entry)) {
      throw new AgentSandboxError("AGENT_FARM_AGENT_RUNTIME_ROOTS entries must be absolute paths.");
    }
    const canonical = await canonicalExisting(entry);
    if (canonical === path.parse(canonical).root || canonical === home) {
      throw new AgentSandboxError(
        `AGENT_FARM_AGENT_RUNTIME_ROOTS cannot expose a filesystem root or the entire user home: ${entry}`,
      );
    }
    if (isContained(canonical, cwd) && canonical !== cwd) {
      throw new AgentSandboxError(
        `AGENT_FARM_AGENT_RUNTIME_ROOTS cannot expose an ancestor of the task worktree: ${entry}`,
      );
    }
    roots.add(canonical);
  }
  return [...roots];
}

async function gitReadRoots(cwd: string): Promise<string[]> {
  const dotGit = path.join(cwd, ".git");
  let stat: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    stat = await fs.lstat(dotGit);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  if (stat.isDirectory()) return [await canonicalExisting(dotGit)];
  if (!stat.isFile()) throw new AgentSandboxError("Task worktree .git metadata is not a file or directory.");
  const pointer = await fs.readFile(dotGit, "utf8");
  const match = /^gitdir:\s*(.+)\s*$/i.exec(pointer.trim());
  if (!match) throw new AgentSandboxError("Task worktree .git file has no valid gitdir pointer.");
  const gitDir = await canonicalExisting(
    path.isAbsolute(match[1]!) ? match[1]! : path.resolve(cwd, match[1]!),
  );
  const roots = new Set([gitDir]);
  const commonDirPath = path.join(gitDir, "commondir");
  try {
    const commonPointer = (await fs.readFile(commonDirPath, "utf8")).trim();
    if (commonPointer) {
      roots.add(await canonicalExisting(
        path.isAbsolute(commonPointer)
          ? commonPointer
          : path.resolve(gitDir, commonPointer),
      ));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return [...roots];
}

function cleanPath(entries: readonly string[]): string {
  return [...new Set(entries.filter(Boolean))].join(path.delimiter);
}

export function workspaceCommandEnvironment(sandbox: Pick<WorkspaceSandbox, "cwd" | "homeDir" | "tempDir">): NodeJS.ProcessEnv {
  const nodeBin = path.dirname(process.execPath);
  const worktreeBin = path.join(sandbox.cwd, "node_modules", ".bin");
  const systemBins = process.platform === "win32"
    ? []
    : ["/usr/bin", "/bin", "/usr/sbin", "/sbin", "/usr/local/bin"];
  const env: NodeJS.ProcessEnv = {
    PATH: cleanPath([worktreeBin, nodeBin, ...systemBins]),
    HOME: sandbox.homeDir,
    USERPROFILE: sandbox.homeDir,
    TMPDIR: sandbox.tempDir,
    TMP: sandbox.tempDir,
    TEMP: sandbox.tempDir,
    LANG: process.env.LANG ?? "C.UTF-8",
    LC_ALL: process.env.LC_ALL ?? process.env.LANG ?? "C.UTF-8",
    TERM: "dumb",
    CI: "1",
    NO_COLOR: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_OPTIONAL_LOCKS: "0",
  };
  for (const [key, value] of Object.entries(env)) {
    if (SENSITIVE_ENV_NAME.test(key) || typeof value !== "string") delete env[key];
  }
  return env;
}

async function writePolicy(
  cwd: string,
  runDir: string,
  policyPath: string,
  extraRoots: readonly string[] = [],
): Promise<void> {
  const readRoots = new Set([
    cwd,
    runDir,
    ...extraRoots,
    ...(await runtimeReadRoots(cwd)),
    ...(await gitReadRoots(cwd)),
  ]);
  const writeRoots = new Set([cwd, runDir, ...extraRoots]);
  const policy: SandboxRuntimeConfig = {
    network: {
      allowedDomains: [],
      deniedDomains: [],
      allowUnixSockets: [],
      allowAllUnixSockets: false,
      allowLocalBinding: false,
    },
    filesystem: {
      denyRead: [path.parse(cwd).root],
      allowRead: [...readRoots],
      allowWrite: [...writeRoots],
      denyWrite: [path.join(cwd, ".git"), ...(await gitReadRoots(cwd))],
    },
    enableWeakerNestedSandbox: false,
    enableWeakerNetworkIsolation: false,
    allowAppleEvents: false,
  };
  const parsed = SandboxRuntimeConfigSchema.parse(policy);
  await fs.writeFile(policyPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(policyPath, 0o600);
}

const UNIX_SOCKET_PATH_LIMIT = 100;

async function allocateTempDir(runDir: string, runId: string): Promise<string> {
  const nested = path.join(runDir, "tmp");
  await fs.mkdir(nested, { recursive: true, mode: 0o700 });
  const nestedCanonical = await canonicalExisting(nested);
  const probeSock = path.join(nestedCanonical, "srt-mux-99999-0.sock");
  if (Buffer.byteLength(probeSock, "utf8") <= UNIX_SOCKET_PATH_LIMIT) return nestedCanonical;

  // macOS sockaddr_un is short; keep SRT mux sockets under a compact /tmp path.
  const shortToken = crypto.createHash("sha256").update(`${runDir}:${runId}`).digest("hex").slice(0, 12);
  const shortTemp = path.join("/tmp", `af${shortToken}`);
  await fs.rm(shortTemp, { recursive: true, force: true });
  await fs.mkdir(shortTemp, { recursive: true, mode: 0o700 });
  const shortCanonical = await canonicalExisting(shortTemp);
  const shortSock = path.join(shortCanonical, "srt-mux-99999-0.sock");
  if (Buffer.byteLength(shortSock, "utf8") > UNIX_SOCKET_PATH_LIMIT) {
    throw new AgentSandboxError(
      `Sandbox temp path is too long for a Unix domain socket (${Buffer.byteLength(shortSock, "utf8")} bytes).`,
    );
  }
  return shortCanonical;
}

export async function createWorkspaceSandbox(cwdInput: string, runId: string): Promise<WorkspaceSandbox> {
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(runId)) throw new AgentSandboxError("Invalid sandbox run id.");
  const cwd = await canonicalExisting(cwdInput);
  const requestedRunDir = path.join(RUNS_DIR, runId);
  await fs.rm(requestedRunDir, { recursive: true, force: true });
  await fs.mkdir(requestedRunDir, { recursive: true, mode: 0o700 });
  // macOS seatbelt matches canonical paths; /var/folders vs /private/var/folders must not diverge.
  const runDir = await canonicalExisting(requestedRunDir);
  const homeDir = path.join(runDir, "home");
  const policyPath = path.join(runDir, "srt-policy.json");
  await fs.mkdir(homeDir, { recursive: true, mode: 0o700 });
  const tempDir = await allocateTempDir(runDir, runId);
  await writePolicy(cwd, runDir, policyPath, [tempDir]);
  const runtime: WorkspaceSandboxRuntime = {
    active: new Set(),
    closing: false,
  };
  activeSandboxes.set(runDir, runtime);
  return {
    runDir,
    homeDir,
    tempDir,
    policyPath,
    cwd,
    environment: workspaceCommandEnvironment({ cwd, homeDir, tempDir }),
    runtime,
  };
}

type OutputBudget = {
  remaining: number;
  truncated: boolean;
};

type OutputCapture = {
  chunks: Buffer[];
  bytes: number;
  digest: ReturnType<typeof crypto.createHash>;
};

function appendLimited(capture: OutputCapture, chunk: Buffer, budget: OutputBudget): void {
  capture.bytes += chunk.byteLength;
  capture.digest.update(chunk);
  if (budget.remaining <= 0) {
    budget.truncated = true;
    return;
  }
  const accepted = chunk.byteLength <= budget.remaining
    ? chunk
    : chunk.subarray(0, budget.remaining);
  capture.chunks.push(Buffer.from(accepted));
  budget.remaining -= accepted.byteLength;
  if (accepted.byteLength < chunk.byteLength) budget.truncated = true;
}

function terminateProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // The process may not have become a group leader; direct signalling is still required.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // Exit observation remains authoritative.
  }
}

function processGroupExists(pid: number): boolean {
  if (process.platform === "win32") {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function waitForProcessGroupExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processGroupExists(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return !processGroupExists(pid);
}

async function waitForStreamClose(stream: NodeJS.ReadableStream | null | undefined): Promise<void> {
  if (!stream) return;
  const readable = stream as NodeJS.ReadableStream & {
    readableEnded?: boolean;
    destroyed?: boolean;
  };
  if (readable.readableEnded || readable.destroyed) return;
  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    stream.once("end", finish);
    stream.once("close", finish);
    stream.once("error", finish);
  });
}

function emptyCommandResult(status: WorkspaceCommandResult["status"], startedAt: number): WorkspaceCommandResult {
  return {
    status,
    exitCode: null,
    signal: null,
    stdout: "",
    stderr: "",
    stdoutBytes: 0,
    stderrBytes: 0,
    stdoutSha256: crypto.createHash("sha256").update("").digest("hex"),
    stderrSha256: crypto.createHash("sha256").update("").digest("hex"),
    truncated: false,
    durationMs: Math.max(0, Date.now() - startedAt),
  };
}

export async function runWorkspaceCommand(
  sandbox: WorkspaceSandbox,
  command: string,
  options: { timeoutMs: number; signal?: AbortSignal },
): Promise<WorkspaceCommandResult> {
  if (!command.trim()) throw new AgentSandboxError("Bash command must not be empty.");
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 600_000) {
    throw new AgentSandboxError("Bash timeout must be an integer from 1 through 600000 milliseconds.");
  }
  const startedAt = Date.now();
  if (sandbox.runtime.closing) {
    throw new AgentSandboxError("The workspace sandbox is already shutting down.");
  }
  if (options.signal?.aborted) return emptyCommandResult("cancelled", startedAt);

  let child: ChildProcess;
  try {
    child = spawn(
      process.execPath,
      [SRT_CLI, "--settings", sandbox.policyPath, "-c", command],
      {
        cwd: sandbox.cwd,
        env: sandbox.environment,
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
        windowsHide: true,
      },
    );
  } catch (error) {
    throw new AgentSandboxError(
      `Could not start the workspace sandbox command: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const budget: OutputBudget = {
    remaining: COMMAND_OUTPUT_LIMIT,
    truncated: false,
  };
  const stdout: OutputCapture = {
    chunks: [],
    bytes: 0,
    digest: crypto.createHash("sha256"),
  };
  const stderr: OutputCapture = {
    chunks: [],
    bytes: 0,
    digest: crypto.createHash("sha256"),
  };
  child.stdout?.on("data", (chunk: Buffer) => appendLimited(stdout, chunk, budget));
  child.stderr?.on("data", (chunk: Buffer) => appendLimited(stderr, chunk, budget));

  let stopReason: CommandStopReason | null = null;
  let forceKill: NodeJS.Timeout | null = null;
  let settled = false;
  let resolveOutcome!: (outcome: { code: number | null; signal: NodeJS.Signals | null }) => void;
  const outcomePromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    resolveOutcome = resolve;
  });
  const settle = (code: number | null, signal: NodeJS.Signals | null) => {
    if (settled) return;
    settled = true;
    resolveOutcome({ code, signal });
  };
  const stop = (reason: CommandStopReason) => {
    if (stopReason !== null || settled) return;
    stopReason = reason;
    terminateProcessTree(child, "SIGTERM");
    forceKill = setTimeout(() => {
      if (!settled) terminateProcessTree(child, "SIGKILL");
    }, KILL_GRACE_MS);
    forceKill.unref();
  };
  let resolveCompletion!: () => void;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });
  const entry: ActiveWorkspaceCommand = {
    child,
    pid: child.pid ?? null,
    stop,
    completion,
  };
  sandbox.runtime.active.add(entry);

  const timeout = setTimeout(() => stop("timed_out"), options.timeoutMs);
  timeout.unref();
  const onAbort = () => stop("cancelled");
  options.signal?.addEventListener("abort", onAbort, { once: true });
  if (options.signal?.aborted) onAbort();

  let spawnError: Error | null = null;
  const onError = (error: Error) => {
    spawnError = error;
    settle(null, null);
  };
  child.once("error", onError);
  child.once("exit", (code, signal) => settle(code, signal));

  try {
    const outcome = await outcomePromise;
    await Promise.all([
      waitForStreamClose(child.stdout),
      waitForStreamClose(child.stderr),
    ]);
    if (entry.pid !== null) {
      const groupGone = await waitForProcessGroupExit(entry.pid, KILL_GRACE_MS + 1_000);
      if (!groupGone) {
        terminateProcessTree(child, "SIGKILL");
        const killed = await waitForProcessGroupExit(entry.pid, KILL_GRACE_MS);
        if (!killed) {
          throw new AgentSandboxError(
            `Workspace sandbox command process group ${entry.pid} did not disappear after SIGKILL.`,
          );
        }
      }
    }
    const failure = spawnError as Error | null;
    if (failure !== null && outcome.code === null && stopReason === null) {
      throw new AgentSandboxError(
        `Workspace sandbox command failed to start: ${failure.message}`,
      );
    }
    return {
      status: stopReason ?? (outcome.code === 0 ? "succeeded" : "failed"),
      exitCode: outcome.code,
      signal: outcome.signal,
      stdout: Buffer.concat(stdout.chunks).toString("utf8"),
      stderr: Buffer.concat(stderr.chunks).toString("utf8"),
      stdoutBytes: stdout.bytes,
      stderrBytes: stderr.bytes,
      stdoutSha256: stdout.digest.digest("hex"),
      stderrSha256: stderr.digest.digest("hex"),
      truncated: budget.truncated,
      durationMs: Math.max(0, Date.now() - startedAt),
    };
  } finally {
    clearTimeout(timeout);
    if (forceKill) clearTimeout(forceKill);
    options.signal?.removeEventListener("abort", onAbort);
    child.off("error", onError);
    sandbox.runtime.active.delete(entry);
    resolveCompletion();
  }
}

export async function stopWorkspaceCommands(
  sandbox: WorkspaceSandbox,
  reason: CommandStopReason = "cancelled",
): Promise<void> {
  const commands = [...sandbox.runtime.active];
  for (const command of commands) command.stop(reason);
  await Promise.all(commands.map((command) => command.completion));
}

function shellQuote(value: string): string {
  if (process.platform === "win32") return `"${value.replaceAll('"', '\\"')}"`;
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

async function reserveLoopbackServer(): Promise<{ server: net.Server; port: number; connected: () => boolean }> {
  let accepted = false;
  const server = net.createServer((socket) => {
    accepted = true;
    socket.destroy();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new AgentSandboxError("Could not reserve a loopback sandbox probe port.");
  }
  return { server, port: address.port, connected: () => accepted };
}

export async function verifyWorkspaceSandbox(sandbox: WorkspaceSandbox): Promise<void> {
  const nonce = crypto.randomBytes(18).toString("hex");
  const insidePath = path.join(sandbox.cwd, `.agent-farm-sandbox-probe-${nonce}`);
  const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-farm-sandbox-outside-"));
  const outsidePath = path.join(outsideDir, "sentinel.txt");
  const linkPath = path.join(sandbox.cwd, `.agent-farm-sandbox-link-${nonce}`);
  const sentinel = `agent-farm-outside-${nonce}`;
  await fs.writeFile(outsidePath, `${sentinel}\n`, { mode: 0o600 });
  if (process.platform !== "win32") await fs.symlink(outsidePath, linkPath);
  const loopback = await reserveLoopbackServer();
  try {
    const inside = await runWorkspaceCommand(
      sandbox,
      `printf %s ${shellQuote(nonce)} > ${shellQuote(insidePath)} && /bin/cat ${shellQuote(insidePath)}`,
      { timeoutMs: 10_000 },
    );
    if (inside.status !== "succeeded" || !inside.stdout.includes(nonce)) {
      throw new AgentSandboxError("Sandbox self-check could not read and write inside the task worktree.");
    }

    for (const candidate of [outsidePath, ...(process.platform === "win32" ? [] : [linkPath])]) {
      const denied = await runWorkspaceCommand(
        sandbox,
        `/bin/cat ${shellQuote(candidate)}`,
        { timeoutMs: 10_000 },
      );
      if (denied.status === "succeeded" || denied.stdout.includes(sentinel) || denied.stderr.includes(sentinel)) {
        throw new AgentSandboxError("Sandbox self-check read a sentinel outside the task worktree.");
      }
    }

    const envProbe = await runWorkspaceCommand(
      sandbox,
      `/usr/bin/env`,
      { timeoutMs: 10_000 },
    );
    if (envProbe.status !== "succeeded") throw new AgentSandboxError("Sandbox self-check could not inspect its environment.");
    for (const key of Object.keys(process.env).filter((name) => SENSITIVE_ENV_NAME.test(name))) {
      if (new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=`, "m").test(envProbe.stdout)) {
        throw new AgentSandboxError(`Sandbox self-check exposed sensitive environment variable ${key}.`);
      }
    }

    const networkScript = path.join(sandbox.runDir, "network-probe.mjs");
    await fs.writeFile(
      networkScript,
      [
        'import net from "node:net";',
        `const socket = net.connect(${loopback.port}, "127.0.0.1");`,
        'socket.once("connect", () => process.exit(0));',
        'socket.once("error", () => process.exit(1));',
        'setTimeout(() => process.exit(2), 1500).unref();',
      ].join("\n"),
      { mode: 0o600 },
    );
    const network = await runWorkspaceCommand(
      sandbox,
      `${shellQuote(process.execPath)} ${shellQuote(networkScript)}`,
      { timeoutMs: 5_000 },
    );
    if (network.status === "succeeded" || loopback.connected()) {
      throw new AgentSandboxError("Sandbox self-check connected to a forbidden local network endpoint.");
    }
  } finally {
    await new Promise<void>((resolve) => loopback.server.close(() => resolve()));
    await Promise.all([
      fs.rm(insidePath, { force: true }),
      fs.rm(linkPath, { force: true }),
      fs.rm(outsideDir, { recursive: true, force: true }),
    ]);
  }
}

export type SandboxCleanupProof = {
  runDir: string;
  closed: boolean;
  activeCommandsStopped: number;
  directoryRemoved: boolean;
  retainedForRecovery: boolean;
  reason: string | null;
};

export async function cleanupWorkspaceSandbox(
  sandbox: WorkspaceSandbox | null,
): Promise<SandboxCleanupProof | null> {
  if (!sandbox) return null;
  sandbox.runtime.closing = true;
  const activeBefore = sandbox.runtime.active.size;
  await stopWorkspaceCommands(sandbox, "cancelled");
  if (sandbox.runtime.active.size > 0) {
    return {
      runDir: sandbox.runDir,
      closed: false,
      activeCommandsStopped: activeBefore,
      directoryRemoved: false,
      retainedForRecovery: true,
      reason: "active_workspace_commands_remain",
    };
  }
  for (const command of sandbox.runtime.active) {
    if (command.pid !== null && processGroupExists(command.pid)) {
      return {
        runDir: sandbox.runDir,
        closed: false,
        activeCommandsStopped: activeBefore,
        directoryRemoved: false,
        retainedForRecovery: true,
        reason: `process_group_alive:${command.pid}`,
      };
    }
  }
  if (!isContained(sandbox.runDir, sandbox.tempDir)) {
    await fs.rm(sandbox.tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
  await fs.rm(sandbox.runDir, { recursive: true, force: true });
  activeSandboxes.delete(sandbox.runDir);
  return {
    runDir: sandbox.runDir,
    closed: true,
    activeCommandsStopped: activeBefore,
    directoryRemoved: true,
    retainedForRecovery: false,
    reason: null,
  };
}

export async function cleanupOrphanedWorkspaceSandboxes(
  ownedRunDirs: ReadonlySet<string> = new Set(),
): Promise<number> {
  let entries: string[];
  try {
    entries = await fs.readdir(RUNS_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  let removed = 0;
  for (const entry of entries) {
    const runDir = path.join(RUNS_DIR, entry);
    if (ownedRunDirs.has(runDir) || activeSandboxes.has(runDir)) continue;
    const marker = path.join(runDir, ".agent-farm-sandbox-released");
    try {
      await fs.access(marker);
    } catch {
      // Fail closed: do not delete run directories that were never marked released and are not owned.
      continue;
    }
    await fs.rm(runDir, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
}

export async function markWorkspaceSandboxReleased(sandbox: WorkspaceSandbox): Promise<void> {
  await fs.writeFile(
    path.join(sandbox.runDir, ".agent-farm-sandbox-released"),
    `${Date.now()}\n`,
    { mode: 0o600 },
  );
}
