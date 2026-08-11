import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import {
  access,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registerServerProcess } from "./process-registry.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const E2E_ROOT = resolve(HERE, "..");
export const REPOSITORY_ROOT = resolve(E2E_ROOT, "..");
export const SERVER_ROOT = join(REPOSITORY_ROOT, "server");
export const WEB_APP_ROOT = join(REPOSITORY_ROOT, "web-app");
export const TEST_RESULTS_BASE = join(E2E_ROOT, "test-results");
const configuredRunId = process.env.AGENT_FARM_E2E_RUN_ID?.replace(/[^a-zA-Z0-9_.-]+/g, "-");
export const E2E_RUN_ID = configuredRunId || `standalone-${process.pid}`;
export const TEST_RESULTS_ROOT = join(TEST_RESULTS_BASE, "runs", E2E_RUN_ID);

export type JsonObject = Record<string, unknown>;

export interface GitFixture {
  root: string;
  repository: string;
  remote: string;
  initialSha: string;
}

export interface CleanupProof {
  processStopped: boolean;
  dataDirectoryRemoved: boolean;
  repositoryRemoved: boolean;
  remoteRemoved: boolean;
  worktreesPruned: boolean;
  branchesRemoved: boolean;
  checkedAt: string;
}

export interface ServerProcess {
  child: ChildProcess;
  baseUrl: string;
  wsUrl: string;
  port: number;
  stdout: () => string;
  stderr: () => string;
  stop: () => Promise<void>;
}

export interface HarnessOptions {
  inheritProviderSettings?: boolean;
}

export interface IsolatedHarness {
  id: string;
  root: string;
  homeDir: string;
  dataDir: string;
  artifactDir: string;
  port: number;
  git?: GitFixture;
  server?: ServerProcess;
  createGitFixture(files?: Record<string, string | Uint8Array>): Promise<GitFixture>;
  startServer(extraEnv?: NodeJS.ProcessEnv): Promise<ServerProcess>;
  stopServer(): Promise<void>;
  restartServer(extraEnv?: NodeJS.ProcessEnv): Promise<ServerProcess>;
  cleanup(): Promise<CleanupProof>;
}

function commandFailure(command: string, args: readonly string[], output: ReturnType<typeof spawnSync>): Error {
  return new Error(
    [
      `Command failed: ${command} ${args.join(" ")}`,
      `exit=${output.status ?? "signal"}`,
      output.stdout?.toString().trim(),
      output.stderr?.toString().trim(),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export function run(
  command: string,
  args: readonly string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string | Uint8Array } = {},
): string {
  const output = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    input: options.input,
    encoding: "utf8",
    stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
  if (output.status !== 0) throw commandFailure(command, args, output);
  return output.stdout.toString().trim();
}

export function git(cwd: string, ...args: string[]): string {
  return run("git", ["-C", cwd, ...args]);
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function sha256File(path: string): Promise<string> {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Bytes(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function reservePort(): Promise<number> {
  return await new Promise<number>((resolvePort, reject) => {
    const socket = createServer();
    socket.unref();
    socket.once("error", reject);
    socket.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = socket.address();
      if (!address || typeof address === "string") {
        socket.close();
        reject(new Error("Failed to reserve an IPv4 test port"));
        return;
      }
      socket.close((error) => (error ? reject(error) : resolvePort(address.port)));
    });
  });
}

export function processExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

async function waitForHttp(urls: readonly string[], child: ChildProcess, timeoutMs: number, logs: () => string): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const lastErrors = new Map(urls.map((url) => [url, "server did not answer"]));
  while (Date.now() < deadline) {
    if (processExited(child)) {
      throw new Error(`Server exited before readiness (exit ${child.exitCode ?? child.signalCode})\n${logs()}`);
    }
    for (const url of urls) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
        if (response.ok) return url;
        lastErrors.set(url, `${response.status} ${await response.text()}`);
      } catch (error) {
        lastErrors.set(url, error instanceof Error ? error.message : String(error));
      }
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  const detail = [...lastErrors].map(([url, error]) => `${url}: ${error}`).join("\n");
  throw new Error(`Timed out waiting for server readiness:\n${detail}\n${logs()}`);
}

async function terminate(child: ChildProcess, timeoutMs = 10_000): Promise<void> {
  if (processExited(child)) return;
  let resolveExited!: () => void;
  const exited = new Promise<void>((resolveExit) => { resolveExited = resolveExit; });
  let settled = false;
  const onExited = () => {
    if (settled) return;
    settled = true;
    child.off("exit", onExited);
    child.off("close", onExited);
    resolveExited();
  };
  child.once("exit", onExited);
  child.once("close", onExited);
  if (processExited(child)) onExited();

  const signalGroup = (signal: NodeJS.Signals) => {
    if (processExited(child)) return;
    if (child.pid && process.platform !== "win32") {
      try {
        process.kill(-child.pid, signal);
        return;
      } catch {
        // Fall back to the direct child if its process group already disappeared.
      }
    }
    child.kill(signal);
  };
  signalGroup("SIGTERM");
  if (processExited(child)) onExited();
  let timer: NodeJS.Timeout | undefined;
  const timedOut = await Promise.race([
    exited.then(() => false),
    new Promise<boolean>((resolveTimeout) => {
      timer = setTimeout(() => resolveTimeout(true), timeoutMs);
      timer.unref();
    }),
  ]);
  if (timer) clearTimeout(timer);
  if (!timedOut || processExited(child)) {
    onExited();
    return;
  }
  signalGroup("SIGKILL");
  if (processExited(child)) onExited();
  await exited;
}

async function writeFixtureFiles(repository: string, files: Record<string, string | Uint8Array>): Promise<void> {
  for (const [relativePath, content] of Object.entries(files)) {
    if (relativePath.startsWith("/") || relativePath.split("/").includes("..")) {
      throw new Error(`Unsafe fixture path: ${relativePath}`);
    }
    const target = join(repository, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

export async function createHarness(label: string, options: HarnessOptions = {}): Promise<IsolatedHarness> {
  const safeLabel = label.replace(/[^a-zA-Z0-9_.-]+/g, "-").slice(0, 48) || "case";
  const root = await mkdtemp(join(tmpdir(), `agent-farm-e2e-${safeLabel}-`));
  const homeDir = join(root, "home");
  const dataDir = join(root, "data");
  const artifactDir = join(TEST_RESULTS_ROOT, `${safeLabel}-${basename(root)}`);
  await Promise.all([
    mkdir(homeDir, { recursive: true }),
    mkdir(dataDir, { recursive: true }),
    mkdir(artifactDir, { recursive: true }),
  ]);
  const realClaudeSettings = join(homedir(), ".claude", "settings.json");
  if (options.inheritProviderSettings && (await pathExists(realClaudeSettings))) {
    const isolatedClaudeDirectory = join(homeDir, ".claude");
    await mkdir(isolatedClaudeDirectory, { recursive: true });
    await cp(realClaudeSettings, join(isolatedClaudeDirectory, "settings.json"), { force: true });
  }
  const port = await reservePort();

  let fixture: GitFixture | undefined;
  let server: ServerProcess | undefined;
  let cleaned = false;

  const harness: IsolatedHarness = {
    id: randomUUID(),
    root,
    homeDir,
    dataDir,
    artifactDir,
    port,
    get git() {
      return fixture;
    },
    get server() {
      return server;
    },
    async createGitFixture(files = { "README.md": "# agent-farm e2e\n" }) {
      if (fixture) throw new Error("Git fixture already exists for this harness");
      const repository = join(root, "repository");
      const remote = join(root, "origin.git");
      run("git", ["init", "--bare", "--quiet", remote]);
      run("git", ["init", "--quiet", "--initial-branch=main", repository]);
      git(repository, "config", "user.email", "agent-farm-e2e@example.invalid");
      git(repository, "config", "user.name", "Agent Farm E2E");
      await writeFixtureFiles(repository, files);
      git(repository, "add", "--all");
      git(repository, "commit", "--quiet", "-m", "initial fixture");
      git(repository, "remote", "add", "origin", remote);
      git(repository, "push", "--quiet", "--set-upstream", "origin", "main");
      run("git", ["--git-dir", remote, "symbolic-ref", "HEAD", "refs/heads/main"]);
      fixture = { root, repository, remote, initialSha: git(repository, "rev-parse", "HEAD") };
      return fixture;
    },
    async startServer(extraEnv = {}) {
      if (server && !processExited(server.child)) throw new Error("Server already running");
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      const cleanupToken = randomUUID().replaceAll("-", "");
      const command = process.env.AGENT_FARM_SERVER_COMMAND ?? join(SERVER_ROOT, "node_modules", ".bin", "tsx");
      const args = process.env.AGENT_FARM_SERVER_ARGS?.split(" ").filter(Boolean) ?? ["src/index.ts"];
      const providerIsolationEnv: NodeJS.ProcessEnv = options.inheritProviderSettings
        ? {}
        : {
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
          };
      const child = spawn(command, args, {
        cwd: SERVER_ROOT,
        env: {
          ...process.env,
          NO_PROXY: "localhost,127.0.0.1,::1",
          no_proxy: "localhost,127.0.0.1,::1",
          AGENT_FARM_DATA_DIR: dataDir,
          AGENT_FARM_E2E_SERVER: "1",
          AGENT_FARM_E2E_RUN_ID: E2E_RUN_ID,
          AGENT_FARM_E2E_CLEANUP_TOKEN: cleanupToken,
          HOME: homeDir,
          USERPROFILE: homeDir,
          XDG_DATA_HOME: join(homeDir, ".local", "share"),
          XDG_CACHE_HOME: join(homeDir, ".cache"),
          HOST: "127.0.0.1",
          PORT: String(port),
          ...providerIsolationEnv,
          ...extraEnv,
        },
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      });
      if (!child.pid) {
        await terminate(child);
        throw new Error("Spawned Agent Farm server has no process id");
      }
      const processRegistryPath = join(TEST_RESULTS_ROOT, "server-processes.jsonl");
      const processRegistration = {
        schema_version: "agent-farm.e2e-server-process.v1" as const,
        run_id: E2E_RUN_ID,
        pid: child.pid,
        process_group_id: child.pid,
        port,
        data_directory: dataDir,
        cleanup_token: cleanupToken,
      };
      registerServerProcess(processRegistryPath, {
        ...processRegistration,
        state: "started",
        registered_at: new Date().toISOString(),
      });
      let stopRecorded = false;
      const stopServerProcess = async () => {
        await terminate(child);
        if (!stopRecorded && processExited(child)) {
          stopRecorded = true;
          registerServerProcess(processRegistryPath, {
            ...processRegistration,
            state: "stopped",
            registered_at: new Date().toISOString(),
          });
        }
      };
      child.stdout?.on("data", (chunk: Buffer) => stdout.push(Buffer.from(chunk)));
      child.stderr?.on("data", (chunk: Buffer) => stderr.push(Buffer.from(chunk)));
      const logs = () => `stdout:\n${Buffer.concat(stdout).toString("utf8")}\nstderr:\n${Buffer.concat(stderr).toString("utf8")}`;
      const baseUrl = `http://127.0.0.1:${port}`;
      server = {
        child,
        baseUrl,
        wsUrl: `ws://127.0.0.1:${port}/ws`,
        port,
        stdout: () => Buffer.concat(stdout).toString("utf8"),
        stderr: () => Buffer.concat(stderr).toString("utf8"),
        stop: stopServerProcess,
      };
      try {
        await waitForHttp([`${baseUrl}/api/health`, `${baseUrl}/health`], child, 60_000, logs);
      } catch (error) {
        await stopServerProcess();
        throw error;
      }
      return server;
    },
    async stopServer() {
      if (!server) return;
      await server.stop();
    },
    async restartServer(extraEnv = {}) {
      if (server) await server.stop();
      return harness.startServer(extraEnv);
    },
    async cleanup() {
      if (cleaned) throw new Error("Harness cleanup called more than once");
      cleaned = true;
      let worktreesPruned = true;
      let branchesRemoved = true;
      if (server) {
        await server.stop();
        await Promise.all([
          writeFile(join(artifactDir, "server.stdout.log"), server.stdout()),
          writeFile(join(artifactDir, "server.stderr.log"), server.stderr()),
          writeFile(join(artifactDir, "server-process.json"), `${JSON.stringify({
            schema_version: "agent-farm.e2e-server-process.v1",
            pid: server.child.pid ?? null,
            port: server.port,
            exit_code: server.child.exitCode,
            signal_code: server.child.signalCode,
            stopped: processExited(server.child),
            recorded_at: new Date().toISOString(),
          }, null, 2)}\n`),
        ]);
      }
      if (fixture && (await pathExists(fixture.repository))) {
        try {
          const canonicalRepository = await realpath(fixture.repository);
          const isMainWorktree = async (path: string) => {
            try {
              return (await realpath(path)) === canonicalRepository;
            } catch {
              return resolve(path) === resolve(fixture!.repository);
            }
          };
          git(fixture.repository, "worktree", "prune", "--expire", "now");
          const porcelain = git(fixture.repository, "worktree", "list", "--porcelain");
          const listedWorktrees = porcelain
            .split("\n")
            .filter((line) => line.startsWith("worktree "))
            .map((line) => line.slice("worktree ".length));
          const linked: string[] = [];
          for (const worktree of listedWorktrees) {
            if (!(await isMainWorktree(worktree))) linked.push(worktree);
          }
          for (const worktree of linked) {
            try {
              git(fixture.repository, "worktree", "remove", "--force", worktree);
            } catch {
              // A missing path is finalized by prune below.
            }
          }
          git(fixture.repository, "worktree", "prune", "--expire", "now");
          const remainingListed = git(fixture.repository, "worktree", "list", "--porcelain")
            .split("\n")
            .filter((line) => line.startsWith("worktree "))
            .map((line) => line.slice("worktree ".length));
          const remainingWorktrees: string[] = [];
          for (const worktree of remainingListed) {
            if (!(await isMainWorktree(worktree))) remainingWorktrees.push(worktree);
          }
          worktreesPruned = remainingWorktrees.length === 0;
          const branches = git(fixture.repository, "for-each-ref", "--format=%(refname:short)", "refs/heads")
            .split("\n")
            .filter(Boolean)
            .filter((branch) => branch !== "main");
          for (const branch of branches) git(fixture.repository, "branch", "--delete", "--force", branch);
          branchesRemoved = git(fixture.repository, "for-each-ref", "--format=%(refname:short)", "refs/heads")
            .split("\n")
            .filter(Boolean)
            .every((branch) => branch === "main");
        } catch {
          worktreesPruned = false;
          branchesRemoved = false;
        }
      }
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      const proof: CleanupProof = {
        processStopped: !server || processExited(server.child),
        dataDirectoryRemoved: !(await pathExists(dataDir)),
        repositoryRemoved: !fixture || !(await pathExists(fixture.repository)),
        remoteRemoved: !fixture || !(await pathExists(fixture.remote)),
        worktreesPruned,
        branchesRemoved,
        checkedAt: new Date().toISOString(),
      };
      await writeFile(join(artifactDir, "cleanup-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
      return proof;
    },
  };
  return harness;
}

export async function copyDirectory(source: string, destination: string): Promise<void> {
  await cp(source, destination, { recursive: true, force: true });
}

export async function listTree(root: string): Promise<string[]> {
  const result: string[] = [];
  async function visit(path: string, prefix: string): Promise<void> {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      result.push(relative);
      if (entry.isDirectory() && !entry.isSymbolicLink()) await visit(join(path, entry.name), relative);
    }
  }
  if (await pathExists(root)) await visit(root, "");
  return result;
}

export async function fileKind(path: string): Promise<"missing" | "file" | "directory" | "symlink" | "other"> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink()) return "symlink";
    if (info.isFile()) return "file";
    if (info.isDirectory()) return "directory";
    return "other";
  } catch {
    return "missing";
  }
}

export async function fileSize(path: string): Promise<number> {
  return (await stat(path)).size;
}
