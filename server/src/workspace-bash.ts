import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  runWorkspaceCommand,
  type WorkspaceCommandResult,
  type WorkspaceSandbox,
} from "./agent-sandbox.js";

const DEFAULT_TIMEOUT_MS = 120_000;

function combineAbortSignals(primary: AbortSignal, secondary?: AbortSignal): {
  signal: AbortSignal;
  dispose: () => void;
} {
  if (!secondary || secondary === primary) {
    return { signal: primary, dispose: () => undefined };
  }
  if (typeof AbortSignal.any === "function") {
    return {
      signal: AbortSignal.any([primary, secondary]),
      dispose: () => undefined,
    };
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (primary.aborted || secondary.aborted) {
    controller.abort();
    return { signal: controller.signal, dispose: () => undefined };
  }
  primary.addEventListener("abort", onAbort, { once: true });
  secondary.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    dispose: () => {
      primary.removeEventListener("abort", onAbort);
      secondary.removeEventListener("abort", onAbort);
    },
  };
}

function requestAbortSignal(extra: unknown): AbortSignal | undefined {
  if (extra && typeof extra === "object") {
    const signal = (extra as { signal?: unknown }).signal;
    if (signal instanceof AbortSignal) return signal;
  }
  return undefined;
}

function renderResult(result: WorkspaceCommandResult): string {
  const sections = [
    `status=${result.status}`,
    `exit_code=${result.exitCode === null ? "null" : result.exitCode}`,
    `signal=${result.signal ?? "null"}`,
    `duration_ms=${result.durationMs}`,
    `truncated=${result.truncated}`,
    `stdout_bytes=${result.stdoutBytes}`,
    `stderr_bytes=${result.stderrBytes}`,
    `stdout_sha256=${result.stdoutSha256}`,
    `stderr_sha256=${result.stderrSha256}`,
  ];
  if (result.stdout) sections.push(`stdout:\n${result.stdout}`);
  if (result.stderr) sections.push(`stderr:\n${result.stderr}`);
  return sections.join("\n");
}

export function createWorkspaceBashServer(
  sandbox: WorkspaceSandbox,
  runSignal: AbortSignal,
): McpSdkServerConfigWithInstance {
  const bash = tool(
    "bash",
    [
      "Run one foreground shell command inside the task worktree.",
      "The command has no network, no host credentials, no access outside the worktree, and cannot modify Git metadata.",
      "Use foreground commands only; background jobs and sandbox overrides are rejected.",
    ].join(" "),
    {
      command: z.string().min(1).max(200_000),
      timeout: z.number().int().min(1).max(600_000).optional(),
      description: z.string().max(500).optional(),
      run_in_background: z.boolean().optional(),
      dangerouslyDisableSandbox: z.boolean().optional(),
    },
    async (input, extra) => {
      if (input.run_in_background === true) {
        return {
          content: [{ type: "text", text: "Background Bash commands are not supported by Agent Farm." }],
          isError: true,
        };
      }
      if (input.dangerouslyDisableSandbox === true) {
        return {
          content: [{ type: "text", text: "Sandbox overrides are disabled by Agent Farm." }],
          isError: true,
        };
      }
      const combined = combineAbortSignals(runSignal, requestAbortSignal(extra));
      try {
        const result = await runWorkspaceCommand(sandbox, input.command, {
          timeoutMs: input.timeout ?? DEFAULT_TIMEOUT_MS,
          signal: combined.signal,
        });
        return {
          content: [{ type: "text", text: renderResult(result) }],
          isError: result.status !== "succeeded",
        };
      } finally {
        combined.dispose();
      }
    },
    { alwaysLoad: true },
  );
  return createSdkMcpServer({
    name: "workspace",
    version: "1.0.0",
    tools: [bash],
    alwaysLoad: true,
  });
}
