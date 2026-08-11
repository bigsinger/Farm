import fs from "node:fs/promises";
import path from "node:path";
import {
  query,
  type CanUseTool,
  type Query,
  type SDKMessage,
  type SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { redactSensitiveText } from "./redaction.js";

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
};

type StopReason = "cancelled" | "timed_out";

type ActiveRunControl = {
  query: Query;
  abortController: AbortController;
  stopReason: StopReason | null;
  interruptionRequested: boolean;
  stopSignal: Promise<void>;
  resolveStopSignal: () => void;
};

const ALLOWED_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"];
const DISALLOWED_TOOLS = [
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
    if (!ALLOWED_TOOLS.includes(toolName)) {
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
  };
}

function requestInterruption(control: ActiveRunControl, reason?: StopReason): void {
  if (reason !== undefined && control.stopReason === null) {
    control.stopReason = reason;
  }

  control.resolveStopSignal();
  if (control.interruptionRequested) return;
  control.interruptionRequested = true;

  try {
    const interrupted = control.query.interrupt();
    void interrupted.catch(() => undefined);
  } catch {
    // Query initialization succeeded, but an SDK implementation may still throw
    // synchronously while dispatching the control request. Abort remains mandatory.
  }

  control.abortController.abort();
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
): SdkRunTerminal {
  return terminal(
    startedAt,
    "provider_blocked",
    sessionId,
    rawResult,
    "provider_auth_failed",
    "The Claude provider rejected authentication or access. Update provider credentials before retrying.",
  );
}

function stopTerminal(
  startedAt: number,
  reason: StopReason,
  sessionId: string | null,
  rawResult: SDKResultMessage | null,
): SdkRunTerminal {
  if (reason === "timed_out") {
    return terminal(
      startedAt,
      "timed_out",
      sessionId,
      rawResult,
      "run_timed_out",
      "The Claude Agent SDK run exceeded its timeout.",
    );
  }

  return terminal(
    startedAt,
    "cancelled",
    sessionId,
    rawResult,
    "run_cancelled",
    "The Claude Agent SDK run was cancelled.",
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

  const abortController = new AbortController();
  let sdkQuery: Query;

  try {
    sdkQuery = query({
      prompt: opts.prompt,
      options: {
        cwd: opts.cwd,
        abortController,
        persistSession: true,
        permissionMode: "default",
        tools: [...ALLOWED_TOOLS],
        disallowedTools: [...DISALLOWED_TOOLS],
        settingSources: [],
        canUseTool: worktreeToolPermission(opts.cwd),
        sandbox: {
          enabled: true,
          failIfUnavailable: true,
          autoAllowBashIfSandboxed: true,
          allowUnsandboxedCommands: false,
          network: {
            allowedDomains: [],
            allowManagedDomainsOnly: true,
            allowUnixSockets: [],
            allowAllUnixSockets: false,
            allowLocalBinding: false,
          },
          filesystem: {
            allowRead: [opts.cwd],
            allowWrite: [opts.cwd],
          },
        },
        systemPrompt: SYSTEM_PROMPT,
        ...(opts.model === undefined ? {} : { model: opts.model }),
        ...(opts.maxBudgetUsd === undefined
          ? {}
          : { maxBudgetUsd: opts.maxBudgetUsd }),
        ...(opts.maxTurns === undefined ? {} : { maxTurns: opts.maxTurns }),
      },
    });
  } catch (error) {
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

  let resolveStopSignal!: () => void;
  const stopSignal = new Promise<void>((resolve) => {
    resolveStopSignal = resolve;
  });
  const control: ActiveRunControl = {
    query: sdkQuery,
    abortController,
    stopReason: null,
    interruptionRequested: false,
    stopSignal,
    resolveStopSignal,
  };
  active.set(opts.runId, control);

  const timeout = setTimeout(() => {
    requestInterruption(control, "timed_out");
  }, opts.timeoutMs);
  timeout.unref();

  let sessionId: string | null = null;
  let rawResult: SDKResultMessage | null = null;
  let providerAuthRejected = false;
  let iteratorError: unknown = null;
  let onMessageError: unknown = null;

  try {
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
        requestInterruption(control);
        break;
      }
      if (providerAuthRejected) {
        requestInterruption(control);
        break;
      }
    }
  } finally {
    clearTimeout(timeout);
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
    );
  }

  if (providerAuthRejected || (rawResult !== null && providerAuthResult(rawResult))) {
    return providerBlockedTerminal(startedAt, sessionId, rawResult);
  }

  if (control.stopReason !== null) {
    return stopTerminal(startedAt, control.stopReason, sessionId, rawResult);
  }

  if (rawResult?.subtype === "success" && rawResult.is_error === false) {
    return terminal(startedAt, "succeeded", sessionId, rawResult, null, null);
  }

  if (rawResult !== null) {
    return terminal(
      startedAt,
      "failed",
      sessionId,
      rawResult,
      rawResult.subtype === "success" ? "sdk_result_error" : rawResult.subtype,
      resultMessage(rawResult),
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
  );
}

export async function cancelAgentRun(runId: string): Promise<boolean> {
  const control = active.get(runId);
  if (control === undefined) return false;
  requestInterruption(control, "cancelled");
  return true;
}

export async function cancelAllAgentRuns(): Promise<void> {
  const runIds = [...active.keys()];
  await Promise.all(runIds.map((runId) => cancelAgentRun(runId)));
}
