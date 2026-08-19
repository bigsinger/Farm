import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  query,
  type CanUseTool,
  type Query,
  type SDKMessage,
  type SDKResultMessage,
  type SpawnedProcess,
  type SpawnOptions,
} from "@anthropic-ai/claude-agent-sdk";
import {
  SandboxRuntimeConfigSchema,
  type SandboxRuntimeConfig,
} from "@anthropic-ai/sandbox-runtime";
import {
  AgentSandboxError,
  cleanupWorkspaceSandbox,
  createWorkspaceSandbox,
  markWorkspaceSandboxReleased,
  stopWorkspaceCommands,
  verifyWorkspaceSandbox,
  type SandboxCleanupProof,
  type WorkspaceSandbox,
} from "./agent-sandbox.js";
import { createWorkspaceBashServer } from "./workspace-bash.js";
import { redactSensitiveText } from "./redaction.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const SRT_CLI = path.resolve(
  moduleDir,
  "../node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js",
);

export type RunSdkOptions = {
  taskId: string;
  runId: string;
  cwd: string;
  prompt: string;
  model?: string;
  timeoutMs: number;
  maxBudgetUsd?: number;
  maxTurns?: number;
  onMessage: (message: SDKMessage) => Promise<void> | void;
};

export type SdkRunTerminal = {
  status:
    | "succeeded"
    | "failed"
    | "cancelled"
    | "timed_out"
    | "provider_blocked"
    | "sandbox_blocked"
    | "crashed";
  sessionId: string | null;
  resultSubtype: SDKResultMessage["subtype"] | null;
  costUsd: number | null;
  numTurns: number | null;
  durationMs: number;
  usage: SDKResultMessage["usage"] | null;
  modelUsage: SDKResultMessage["modelUsage"] | null;
  permissionDenials: SDKResultMessage["permission_denials"];
  errorCode: string | null;
  errorMessage: string | null;
  rawResult: SDKResultMessage | null;
  cleanupProof?: SandboxCleanupProof | null;
};

type StopReason = "cancelled" | "timed_out";

type ActiveRunControl = {
  query: Query | null;
  abortController: AbortController;
  sandbox: WorkspaceSandbox | null;
  stopReason: StopReason | null;
  interruptionRequested: boolean;
  stopSignal: Promise<void>;
  resolveStopSignal: () => void;
};

const ALLOWED_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"];
const DISALLOWED_TOOLS = [
  "Bash",
  "WebFetch",
  "WebSearch",
  "Agent",
  "Workflow",
  "SendMessage",
  "Task",
  "TaskOutput",
  "TaskStop",
];

const SYSTEM_PROMPT = [
  "Work only inside the current worktree provided as cwd. Do not read, write, or run commands outside it.",
  "Do not send external messages, contact peer agents, publish, deploy, release, push, merge, or otherwise communicate outside this runtime.",
  "Do not perform destructive repository operations such as hard resets, repository cleaning, force pushes, branch deletion, or history rewriting.",
  "Complete the requested production code end to end using real implementations and real repository data.",
  "Do not use mocks, placeholders, stubs, deferred TODOs, or knowingly leave required paths incomplete.",
  "Keep changes scoped to the requested task and verify the result with the repository's relevant checks.",
].join("\n");

const active = new Map<string, ActiveRunControl>();

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function nearestExistingPath(candidate: string): Promise<string> {
  let current = candidate;
  while (true) {
    try {
      return await fs.realpath(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

export async function isWorktreePathAllowed(cwd: string, candidate: string): Promise<boolean> {
  const root = await fs.realpath(cwd);
  const requested = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(root, candidate);
  const canonical = await nearestExistingPath(requested);
  if (!isContained(root, canonical)) return false;
  const relative = path.relative(root, canonical).split(path.sep);
  return relative[0] !== ".git";
}

function worktreeToolPermission(cwd: string): CanUseTool {
  return async (toolName, input, options) => {
    if (!ALLOWED_TOOLS.includes(toolName) && toolName !== "mcp__workspace__bash") {
      return { behavior: "deny", message: `Tool ${toolName} is outside the Agent Farm allowlist.`, interrupt: true };
    }

    const candidates = [options.blockedPath, input.file_path, input.path, input.directory, input.pattern]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    for (const candidate of candidates) {
      if (!(await isWorktreePathAllowed(cwd, candidate))) {
        return { behavior: "deny", message: "The requested path is outside the task worktree or targets .git metadata.", interrupt: true };
      }
    }
    return { behavior: "allow" };
  };
}

function hasEnv(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function providerFlag(name: string): boolean {
  return process.env[name] === "1";
}

function hasWorkloadIdentity(): boolean {
  return (
    hasEnv("ANTHROPIC_FEDERATION_RULE_ID") &&
    hasEnv("ANTHROPIC_ORGANIZATION_ID") &&
    hasEnv("ANTHROPIC_SERVICE_ACCOUNT_ID") &&
    (hasEnv("ANTHROPIC_IDENTITY_TOKEN") || hasEnv("ANTHROPIC_IDENTITY_TOKEN_FILE"))
  );
}

/** Returns a non-secret description of the configured Claude provider. */
export function providerKind(): string | null {
  if (providerFlag("CLAUDE_CODE_USE_BEDROCK")) return "bedrock";
  if (providerFlag("CLAUDE_CODE_USE_MANTLE")) return "bedrock-mantle";
  if (providerFlag("CLAUDE_CODE_USE_VERTEX")) return "vertex";
  if (providerFlag("CLAUDE_CODE_USE_FOUNDRY")) return "foundry";
  if (providerFlag("CLAUDE_CODE_USE_ANTHROPIC_AWS")) return "anthropic-aws";

  const hasDirectCredential =
    hasEnv("ANTHROPIC_API_KEY") ||
    hasEnv("ANTHROPIC_AUTH_TOKEN") ||
    hasEnv("CLAUDE_CODE_OAUTH_TOKEN");
  if (hasDirectCredential && hasEnv("ANTHROPIC_BASE_URL")) return "custom-endpoint";
  if (hasEnv("ANTHROPIC_API_KEY")) return "anthropic-api-key";
  if (hasEnv("ANTHROPIC_AUTH_TOKEN")) return "anthropic-auth-token";
  if (hasEnv("CLAUDE_CODE_OAUTH_TOKEN")) return "claude-oauth";
  if (hasEnv("ANTHROPIC_PROFILE")) return "anthropic-profile";
  if (hasWorkloadIdentity()) return "anthropic-wif";
  return null;
}

export function hasProviderAuth(): boolean {
  return providerKind() !== null;
}

function copyEnv(names: readonly string[], target: NodeJS.ProcessEnv): void {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.length > 0) target[name] = value;
  }
}

function providerNetworkDomains(kind: string): string[] {
  switch (kind) {
    case "bedrock":
    case "bedrock-mantle":
    case "anthropic-aws":
      return [
        "bedrock-runtime.*.amazonaws.com",
        "bedrock.*.amazonaws.com",
        "sts.*.amazonaws.com",
        "sts.amazonaws.com",
      ];
    case "vertex":
      return [
        "aiplatform.googleapis.com",
        "*.aiplatform.googleapis.com",
        "oauth2.googleapis.com",
        "www.googleapis.com",
      ];
    case "foundry":
      return [
        "*.azure.com",
        "*.openai.azure.com",
        "login.microsoftonline.com",
      ];
    case "custom-endpoint": {
      try {
        const host = new URL(process.env.ANTHROPIC_BASE_URL!).hostname;
        return host ? [host] : ["api.anthropic.com"];
      } catch {
        return ["api.anthropic.com"];
      }
    }
    default:
      return ["api.anthropic.com", "claude.ai"];
  }
}

function buildSdkEnvironment(configDir: string, kind: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin",
    HOME: configDir,
    USERPROFILE: configDir,
    TMPDIR: path.join(configDir, "tmp"),
    TMP: path.join(configDir, "tmp"),
    TEMP: path.join(configDir, "tmp"),
    LANG: process.env.LANG ?? "C.UTF-8",
    LC_ALL: process.env.LC_ALL ?? process.env.LANG ?? "C.UTF-8",
    TERM: "dumb",
    CI: "1",
    NO_COLOR: "1",
    CLAUDE_CONFIG_DIR: configDir,
    CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "1",
  };
  copyEnv(["SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"], env);

  if (kind === "bedrock" || kind === "bedrock-mantle" || kind === "anthropic-aws") {
    copyEnv([
      "CLAUDE_CODE_USE_BEDROCK",
      "CLAUDE_CODE_USE_MANTLE",
      "CLAUDE_CODE_USE_ANTHROPIC_AWS",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_SESSION_TOKEN",
      "AWS_REGION",
      "AWS_DEFAULT_REGION",
      "AWS_PROFILE",
      "AWS_SHARED_CREDENTIALS_FILE",
      "AWS_CONFIG_FILE",
      "AWS_WEB_IDENTITY_TOKEN_FILE",
      "AWS_ROLE_ARN",
      "AWS_ROLE_SESSION_NAME",
    ], env);
  } else if (kind === "vertex") {
    copyEnv([
      "CLAUDE_CODE_USE_VERTEX",
      "CLOUD_ML_REGION",
      "ANTHROPIC_VERTEX_PROJECT_ID",
      "GOOGLE_CLOUD_PROJECT",
      "GCLOUD_PROJECT",
      "GOOGLE_APPLICATION_CREDENTIALS",
    ], env);
  } else if (kind === "foundry") {
    copyEnv([
      "CLAUDE_CODE_USE_FOUNDRY",
      "AZURE_API_KEY",
      "AZURE_CLIENT_ID",
      "AZURE_CLIENT_SECRET",
      "AZURE_TENANT_ID",
      "AZURE_OPENAI_ENDPOINT",
    ], env);
  } else {
    copyEnv([
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_AUTH_TOKEN",
      "CLAUDE_CODE_OAUTH_TOKEN",
      "ANTHROPIC_BASE_URL",
      "ANTHROPIC_PROFILE",
      "ANTHROPIC_FEDERATION_RULE_ID",
      "ANTHROPIC_ORGANIZATION_ID",
      "ANTHROPIC_SERVICE_ACCOUNT_ID",
      "ANTHROPIC_IDENTITY_TOKEN",
      "ANTHROPIC_IDENTITY_TOKEN_FILE",
    ], env);
  }
  return env;
}

async function existingPath(candidate: string): Promise<string | null> {
  try {
    return path.normalize(await fs.realpath(path.resolve(candidate)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeOuterPolicy(
  cwd: string,
  runDir: string,
  tempDir: string,
  kind: string,
  policyPath: string,
): Promise<void> {
  const readRoots = new Set<string>([cwd, runDir, tempDir]);
  for (const candidate of [
    path.dirname(process.execPath),
    path.resolve(moduleDir, "../node_modules/@anthropic-ai/claude-agent-sdk"),
    path.resolve(moduleDir, "../node_modules/@anthropic-ai/sandbox-runtime"),
    "/etc/ssl",
    "/private/etc/ssl",
    "/etc/ca-certificates",
  ]) {
    const existing = await existingPath(candidate);
    if (existing) readRoots.add(existing);
  }
  for (const envName of [
    "SSL_CERT_FILE",
    "NODE_EXTRA_CA_CERTS",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "AWS_SHARED_CREDENTIALS_FILE",
    "AWS_CONFIG_FILE",
    "AWS_WEB_IDENTITY_TOKEN_FILE",
    "ANTHROPIC_IDENTITY_TOKEN_FILE",
  ]) {
    const value = process.env[envName];
    if (!value) continue;
    const existing = await existingPath(value);
    if (existing) readRoots.add(path.dirname(existing) === existing ? existing : path.dirname(existing));
    if (existing) readRoots.add(existing);
  }

  const policy: SandboxRuntimeConfig = {
    network: {
      allowedDomains: providerNetworkDomains(kind),
      deniedDomains: [],
      allowUnixSockets: [],
      allowAllUnixSockets: false,
      allowLocalBinding: false,
    },
    filesystem: {
      denyRead: [path.parse(cwd).root],
      allowRead: [...readRoots],
      allowWrite: [cwd, runDir, tempDir],
      denyWrite: [path.join(cwd, ".git")],
    },
    enableWeakerNestedSandbox: false,
    enableWeakerNetworkIsolation: false,
    allowAppleEvents: false,
  };
  const parsed = SandboxRuntimeConfigSchema.parse(policy);
  await fs.writeFile(policyPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(policyPath, 0o600);
}

function shellQuote(value: string): string {
  if (process.platform === "win32") return `"${value.replaceAll('"', '\\"')}"`;
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function spawnOuterSandboxedProcess(
  options: SpawnOptions,
  policyPath: string,
): SpawnedProcess {
  const commandLine = [shellQuote(options.command), ...options.args.map(shellQuote)].join(" ");
  const child: ChildProcess = spawn(
    process.execPath,
    [SRT_CLI, "--settings", policyPath, "-c", commandLine],
    {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsHide: true,
      signal: options.signal,
    },
  );
  if (!child.stdin || !child.stdout) {
    child.kill("SIGKILL");
    throw new AgentSandboxError("Outer sandboxed Claude process did not expose stdin/stdout pipes.");
  }
  return child as SpawnedProcess;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return redactSensitiveText(error.message);
  if (typeof error === "string" && error.trim()) return redactSensitiveText(error);
  return "Unknown Claude Agent SDK runtime error.";
}

function elapsedSince(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

function terminal(
  startedAt: number,
  status: SdkRunTerminal["status"],
  sessionId: string | null,
  rawResult: SDKResultMessage | null,
  errorCode: string | null,
  errorMessage: string | null,
  cleanupProof: SandboxCleanupProof | null = null,
): SdkRunTerminal {
  return {
    status,
    sessionId,
    resultSubtype: rawResult?.subtype ?? null,
    costUsd: rawResult?.total_cost_usd ?? null,
    numTurns: rawResult?.num_turns ?? null,
    durationMs: rawResult?.duration_ms ?? elapsedSince(startedAt),
    usage: rawResult?.usage ?? null,
    modelUsage: rawResult?.modelUsage ?? null,
    permissionDenials: rawResult?.permission_denials ?? [],
    errorCode,
    errorMessage,
    rawResult,
    cleanupProof,
  };
}

async function closeQuery(control: ActiveRunControl): Promise<void> {
  const current = control.query;
  if (!current) return;
  control.query = null;
  try {
    current.close();
  } catch {
    // close is best-effort once interruption already started.
  }
}

async function requestInterruption(control: ActiveRunControl, reason?: StopReason): Promise<void> {
  if (reason !== undefined && control.stopReason === null) {
    control.stopReason = reason;
  }

  control.resolveStopSignal();
  if (control.interruptionRequested) return;
  control.interruptionRequested = true;

  if (control.sandbox) {
    control.sandbox.runtime.closing = true;
    await stopWorkspaceCommands(control.sandbox, "cancelled").catch(() => undefined);
  }

  if (control.query) {
    try {
      const interrupted = control.query.interrupt();
      void interrupted.catch(() => undefined);
    } catch {
      // Query initialization succeeded, but an SDK implementation may still throw
      // synchronously while dispatching the control request. Abort remains mandatory.
    }
  }

  control.abortController.abort();
  await closeQuery(control);
}

function resultMessage(result: SDKResultMessage): string {
  if (result.subtype === "success") return result.result;
  return result.errors.length > 0
    ? result.errors.join("\n")
    : `Claude Agent SDK ended with ${result.subtype}.`;
}

function providerAuthResult(result: SDKResultMessage): boolean {
  const apiStatus = result.subtype === "success" ? result.api_error_status : null;
  return (
    apiStatus === 401 ||
    apiStatus === 403 ||
    /authentication_failed|oauth_org_not_allowed|invalid api key|unauthorized|forbidden/i.test(resultMessage(result))
  );
}

function providerAuthMessage(message: SDKMessage): boolean {
  const record = message as unknown as Record<string, unknown>;
  if (record.type === "result") return providerAuthResult(message as SDKResultMessage);
  const status = typeof record.error_status === "number" ? record.error_status : null;
  const error = typeof record.error === "string" ? record.error : "";
  return status === 401 || status === 403 || /authentication_failed|oauth_org_not_allowed/i.test(error);
}

function providerBlockedTerminal(
  startedAt: number,
  sessionId: string | null,
  rawResult: SDKResultMessage | null,
  cleanupProof: SandboxCleanupProof | null,
): SdkRunTerminal {
  return terminal(
    startedAt,
    "provider_blocked",
    sessionId,
    rawResult,
    "provider_auth_failed",
    "The Claude provider rejected authentication or access. Update provider credentials before retrying.",
    cleanupProof,
  );
}

function stopTerminal(
  startedAt: number,
  reason: StopReason,
  sessionId: string | null,
  rawResult: SDKResultMessage | null,
  cleanupProof: SandboxCleanupProof | null,
): SdkRunTerminal {
  if (reason === "timed_out") {
    return terminal(
      startedAt,
      "timed_out",
      sessionId,
      rawResult,
      "run_timed_out",
      "The Claude Agent SDK run exceeded its timeout.",
      cleanupProof,
    );
  }

  return terminal(
    startedAt,
    "cancelled",
    sessionId,
    rawResult,
    "run_cancelled",
    "The Claude Agent SDK run was cancelled.",
    cleanupProof,
  );
}

export async function executeAgentRun(opts: RunSdkOptions): Promise<SdkRunTerminal> {
  const startedAt = Date.now();

  if (!hasProviderAuth()) {
    return terminal(
      startedAt,
      "provider_blocked",
      null,
      null,
      "provider_auth_missing",
      "No supported Claude provider authentication is configured.",
    );
  }

  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs < 0) {
    return terminal(
      startedAt,
      "crashed",
      null,
      null,
      "invalid_timeout",
      "timeoutMs must be a finite, non-negative number.",
    );
  }

  if (active.has(opts.runId)) {
    return terminal(
      startedAt,
      "crashed",
      null,
      null,
      "run_already_active",
      "A Claude Agent SDK run with this runId is already active.",
    );
  }

  const kind = providerKind();
  if (!kind) {
    return terminal(
      startedAt,
      "provider_blocked",
      null,
      null,
      "provider_auth_missing",
      "No supported Claude provider authentication is configured.",
    );
  }

  const abortController = new AbortController();
  let sandbox: WorkspaceSandbox | null = null;
  let outerPolicyPath: string | null = null;
  let cleanupProof: SandboxCleanupProof | null = null;
  let sdkQuery: Query | null = null;

  let resolveStopSignal!: () => void;
  const stopSignal = new Promise<void>((resolve) => {
    resolveStopSignal = resolve;
  });
  const control: ActiveRunControl = {
    query: null,
    abortController,
    sandbox: null,
    stopReason: null,
    interruptionRequested: false,
    stopSignal,
    resolveStopSignal,
  };
  active.set(opts.runId, control);

  const timeout = setTimeout(() => {
    void requestInterruption(control, "timed_out");
  }, opts.timeoutMs);
  timeout.unref();

  let sessionId: string | null = null;
  let rawResult: SDKResultMessage | null = null;
  let providerAuthRejected = false;
  let iteratorError: unknown = null;
  let onMessageError: unknown = null;

  try {
    sandbox = await createWorkspaceSandbox(opts.cwd, opts.runId);
    control.sandbox = sandbox;
    await fs.mkdir(path.join(sandbox.runDir, "tmp"), { recursive: true, mode: 0o700 });
    await verifyWorkspaceSandbox(sandbox);
    outerPolicyPath = path.join(sandbox.runDir, "outer-srt-policy.json");
    await writeOuterPolicy(sandbox.cwd, sandbox.runDir, sandbox.tempDir, kind, outerPolicyPath);
    const sdkEnv = buildSdkEnvironment(sandbox.homeDir, kind);
    const workspaceServer = createWorkspaceBashServer(sandbox, abortController.signal);

    try {
      sdkQuery = query({
        prompt: opts.prompt,
        options: {
          cwd: opts.cwd,
          abortController,
          persistSession: false,
          permissionMode: "default",
          tools: [...ALLOWED_TOOLS],
          disallowedTools: [...DISALLOWED_TOOLS],
          settingSources: [],
          canUseTool: worktreeToolPermission(opts.cwd),
          mcpServers: {
            workspace: workspaceServer,
          },
          strictMcpConfig: true,
          toolAliases: {
            Bash: "mcp__workspace__bash",
          },
          env: sdkEnv,
          systemPrompt: SYSTEM_PROMPT,
          spawnClaudeCodeProcess: (spawnOptions) => {
            if (!outerPolicyPath) {
              throw new AgentSandboxError("Outer sandbox policy was not prepared before Claude process spawn.");
            }
            return spawnOuterSandboxedProcess(spawnOptions, outerPolicyPath);
          },
          ...(opts.model === undefined ? {} : { model: opts.model }),
          ...(opts.maxBudgetUsd === undefined
            ? {}
            : { maxBudgetUsd: opts.maxBudgetUsd }),
          ...(opts.maxTurns === undefined ? {} : { maxTurns: opts.maxTurns }),
        },
      });
    } catch (error) {
      if (error instanceof AgentSandboxError) throw error;
      abortController.abort();
      return terminal(
        startedAt,
        "crashed",
        null,
        null,
        "query_initialization_failed",
        safeErrorMessage(error),
      );
    }

    control.query = sdkQuery;

    while (true) {
      const next = sdkQuery.next().then(
        (value) => ({ kind: "next" as const, value }),
        (error: unknown) => ({ kind: "error" as const, error }),
      );
      const outcome = await Promise.race([
        next,
        control.stopSignal.then(() => ({ kind: "stopped" as const })),
      ]);

      if (outcome.kind === "stopped") break;
      if (outcome.kind === "error") {
        iteratorError = outcome.error;
        break;
      }
      if (outcome.value.done) break;
      if (control.stopReason !== null) break;

      const message = outcome.value.value;
      if ("session_id" in message && typeof message.session_id === "string") {
        sessionId = message.session_id;
      }
      if (message.type === "result") {
        rawResult = message;
      }
      if (providerAuthMessage(message)) providerAuthRejected = true;

      const delivered = Promise.resolve()
        .then(() => opts.onMessage(message))
        .then(
          () => ({ kind: "delivered" as const }),
          (error: unknown) => ({ kind: "error" as const, error }),
        );
      const delivery = await Promise.race([
        delivered,
        control.stopSignal.then(() => ({ kind: "stopped" as const })),
      ]);

      if (delivery.kind === "stopped") break;
      if (delivery.kind === "error") {
        onMessageError = delivery.error;
        await requestInterruption(control);
        break;
      }
      if (providerAuthRejected) {
        await requestInterruption(control);
        break;
      }
    }
  } catch (error) {
    if (error instanceof AgentSandboxError) {
      cleanupProof = await cleanupWorkspaceSandbox(sandbox);
      if (active.get(opts.runId) === control) active.delete(opts.runId);
      clearTimeout(timeout);
      return terminal(
        startedAt,
        "sandbox_blocked",
        sessionId,
        rawResult,
        error.code,
        error.message,
        cleanupProof,
      );
    }
    iteratorError = error;
  } finally {
    clearTimeout(timeout);
    await closeQuery(control);
    if (sandbox) {
      await markWorkspaceSandboxReleased(sandbox).catch(() => undefined);
      cleanupProof = await cleanupWorkspaceSandbox(sandbox);
    }
    if (active.get(opts.runId) === control) {
      active.delete(opts.runId);
    }
  }

  if (onMessageError !== null) {
    return terminal(
      startedAt,
      "crashed",
      sessionId,
      rawResult,
      "on_message_failed",
      safeErrorMessage(onMessageError),
      cleanupProof,
    );
  }

  if (providerAuthRejected || (rawResult !== null && providerAuthResult(rawResult))) {
    return providerBlockedTerminal(startedAt, sessionId, rawResult, cleanupProof);
  }

  if (control.stopReason !== null) {
    return stopTerminal(startedAt, control.stopReason, sessionId, rawResult, cleanupProof);
  }

  if (rawResult?.subtype === "success" && rawResult.is_error === false) {
    return terminal(startedAt, "succeeded", sessionId, rawResult, null, null, cleanupProof);
  }

  if (rawResult !== null) {
    return terminal(
      startedAt,
      "failed",
      sessionId,
      rawResult,
      rawResult.subtype === "success" ? "sdk_result_error" : rawResult.subtype,
      resultMessage(rawResult),
      cleanupProof,
    );
  }

  return terminal(
    startedAt,
    "crashed",
    sessionId,
    null,
    iteratorError === null ? "result_missing" : "sdk_iterator_failed",
    iteratorError === null
      ? "The Claude Agent SDK iterator completed without a result message."
      : safeErrorMessage(iteratorError),
    cleanupProof,
  );
}

export async function cancelAgentRun(runId: string): Promise<boolean> {
  const control = active.get(runId);
  if (control === undefined) return false;
  await requestInterruption(control, "cancelled");
  return true;
}

export async function cancelAllAgentRuns(): Promise<void> {
  const runIds = [...active.keys()];
  await Promise.all(runIds.map((runId) => cancelAgentRun(runId)));
}

export function activeSandboxRunDirs(): Set<string> {
  return new Set(
    [...active.values()]
      .map((control) => control.sandbox?.runDir)
      .filter((value): value is string => typeof value === "string"),
  );
}
