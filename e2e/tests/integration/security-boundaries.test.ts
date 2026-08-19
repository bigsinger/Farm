import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { isWorktreePathAllowed } from "../../../server/src/agent.js";
import { errorMiddleware } from "../../../server/src/errors.js";
import { sanitizeForAudit, sdkAuditPayload } from "../../../server/src/ledger.js";
import { createHarness, SERVER_ROOT } from "../../lib/harness.js";
import { LedgerCollector } from "../../lib/ws-ledger.js";

const TSX = join(SERVER_ROOT, "node_modules", ".bin", "tsx");

async function spawnServerOnce(
  harness: Awaited<ReturnType<typeof createHarness>>,
  extraEnv: NodeJS.ProcessEnv,
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(TSX, ["src/index.ts"], {
      cwd: SERVER_ROOT,
      env: {
        ...process.env,
        AGENT_FARM_DATA_DIR: harness.dataDir,
        AGENT_FARM_DISABLE_USER_SETTINGS: "1",
        HOME: harness.homeDir,
        USERPROFILE: harness.homeDir,
        HOST: "127.0.0.1",
        PORT: String(harness.port),
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout?.on("data", (chunk: Buffer) => stdout.push(Buffer.from(chunk)));
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(Buffer.from(chunk)));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("server did not exit after forbidden HOST bind"));
    }, 15_000);
    timer.unref();
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

async function snapshotDataDir(dataDir: string): Promise<Map<string, { size: number; sha256: string }>> {
  const result = new Map<string, { size: number; sha256: string }>();
  let entries: Array<{ name: string; isFile(): boolean; isDirectory(): boolean; parentPath?: string; path?: string }>;
  try {
    entries = await readdir(dataDir, { recursive: true, withFileTypes: true }) as typeof entries;
  } catch {
    return result;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const file = join((entry as { parentPath?: string }).parentPath ?? dataDir, entry.name);
    const relative = file.slice(dataDir.length + 1);
    const bytes = await readFile(file);
    result.set(relative, {
      size: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return result;
}

interface WsClient {
  once(event: "open", listener: () => void): this;
  once(event: "error", listener: (error: Error) => void): this;
  once(event: "unexpected-response", listener: (_request: unknown, response: { statusCode?: number }) => void): this;
  close(): void;
  terminate(): void;
}

interface WsConstructor {
  new (
    url: string,
    options?: { origin?: string; headers?: Record<string, string> },
  ): WsClient;
}

const serverRequire = createRequire(join(SERVER_ROOT, "package.json"));
const { WebSocket } = serverRequire("ws") as { WebSocket: WsConstructor };

async function connectWithOrigin(url: string, origin: string): Promise<WsClient> {
  return await new Promise<WsClient>((resolve, reject) => {
    const socket = new WebSocket(url, { origin });
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
    socket.once("unexpected-response", (_request, response) => {
      socket.terminate();
      reject(new Error(`unexpected HTTP ${response.statusCode ?? "unknown"}`));
    });
  });
}

async function rejectedUpgradeStatus(
  url: string,
  options: { origin?: string; headers?: Record<string, string> } = {},
): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const socket = new WebSocket(url, options);
    socket.once("open", () => {
      socket.terminate();
      reject(new Error("forbidden WebSocket upgrade unexpectedly opened"));
    });
    socket.once("unexpected-response", (_request, response) => {
      socket.terminate();
      resolve(response.statusCode ?? 0);
    });
    socket.once("error", (error) => {
      const match = /Unexpected server response: (\d+)/i.exec(error.message);
      if (match) {
        resolve(Number(match[1]));
        return;
      }
      reject(error);
    });
  });
}

test("Agent SDK path confinement rejects traversal, metadata and symlink escapes", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-farm-sdk-paths-"));
  const worktree = join(root, "worktree");
  const outside = join(root, "outside");
  try {
    await Promise.all([mkdir(join(worktree, ".git"), { recursive: true }), mkdir(outside, { recursive: true })]);
    await writeFile(join(worktree, "existing.txt"), "inside\n");
    await writeFile(join(outside, "secret.txt"), "outside\n");
    if (process.platform !== "win32") await symlink(outside, join(worktree, "outside-link"));

    assert.equal(await isWorktreePathAllowed(worktree, "existing.txt"), true);
    assert.equal(await isWorktreePathAllowed(worktree, "new/deep/file.txt"), true);
    assert.equal(await isWorktreePathAllowed(worktree, join(worktree, "existing.txt")), true);
    assert.equal(await isWorktreePathAllowed(worktree, "../outside/secret.txt"), false);
    assert.equal(await isWorktreePathAllowed(worktree, join(outside, "secret.txt")), false);
    assert.equal(await isWorktreePathAllowed(worktree, ".git/config"), false);
    if (process.platform !== "win32") {
      assert.equal(await isWorktreePathAllowed(worktree, "outside-link"), false);
      assert.equal(await isWorktreePathAllowed(worktree, "outside-link/new-file.txt"), false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("real server allows same-origin ledger clients and rejects cross-origin browser upgrades", { timeout: 2 * 60_000 }, async () => {
  const harness = await createHarness("ws-origin-boundary");
  try {
    const server = await harness.startServer();
    const collector = new LedgerCollector(server.wsUrl, 0);
    await collector.connect();
    await collector.waitUntilReady();
    await collector.close();

    const sameOrigin = await connectWithOrigin(server.wsUrl, server.baseUrl);
    sameOrigin.close();
    assert.equal(await rejectedUpgradeStatus(server.wsUrl, { origin: "https://attacker.example" }), 403);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.processStopped, true);
    assert.equal(proof.dataDirectoryRemoved, true);
  }
});

test("malformed and oversized JSON bodies return structured client errors", { timeout: 2 * 60_000 }, async () => {
  const harness = await createHarness("json-parser-boundary");
  try {
    const server = await harness.startServer({ AGENT_FARM_JSON_LIMIT: "128b" });
    const malformed = await fetch(`${server.baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{\"prompt\":\"credential-value\"",
    });
    assert.equal(malformed.status, 400);
    const malformedText = await malformed.text();
    assert.match(malformedText, /invalid_json/);
    assert.match(malformedText, /request_id/);
    assert.doesNotMatch(malformedText, /credential-value/);

    const oversized = await fetch(`${server.baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "sensitive-body".repeat(100) }),
    });
    assert.equal(oversized.status, 413);
    const oversizedText = await oversized.text();
    assert.match(oversizedText, /request_body_too_large/);
    assert.match(oversizedText, /request_id/);
    assert.doesNotMatch(oversizedText, /sensitive-body/);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.processStopped, true);
    assert.equal(proof.dataDirectoryRemoved, true);
  }
});

test("local project art is served on loopback while non-loopback HOST fails before any data write", { timeout: 2 * 60_000 }, async () => {
  const harness = await createHarness("asset-license-boundary");
  try {
    const server = await harness.startServer();
    const local = await fetch(`${server.baseUrl}/assets/BootScene.scene`);
    assert.equal(local.status, 200);
    assert.match(local.headers.get("content-type") ?? "", /json|octet-stream/);

    const foreignOrigin = await fetch(`${server.baseUrl}/api/health`, {
      headers: { Origin: "https://attacker.example" },
    });
    assert.equal(foreignOrigin.status, 403);
    const foreignBody = await foreignOrigin.json() as { error?: { code?: string } };
    assert.equal(foreignBody.error?.code, "invalid_browser_origin");

    const nullOrigin = await fetch(`${server.baseUrl}/api/health`, {
      headers: { Origin: "null" },
    });
    assert.equal(nullOrigin.status, 403);

    const crossSite = await fetch(`${server.baseUrl}/api/health`, {
      headers: { "Sec-Fetch-Site": "cross-site" },
    });
    assert.equal(crossSite.status, 403);
    const crossSiteBody = await crossSite.json() as { error?: { code?: string } };
    assert.equal(crossSiteBody.error?.code, "cross_site_request_denied");

    assert.equal(await rejectedUpgradeStatus(server.wsUrl, { origin: "http://attacker.example" }), 403);
    assert.equal(
      await rejectedUpgradeStatus(server.wsUrl, {
        origin: `http://attacker.example:${server.port}`,
        headers: { Host: `attacker.example:${server.port}` },
      }),
      400,
    );

    await harness.stopServer();
    const dataBefore = await snapshotDataDir(harness.dataDir);
    const failedStart = await spawnServerOnce(harness, { HOST: "0.0.0.0" });
    assert.notEqual(failedStart.exitCode, 0);
    assert.match(`${failedStart.stdout}\n${failedStart.stderr}`, /refusing non-loopback bind|HOST must be one of/i);
    assert.deepEqual(await snapshotDataDir(harness.dataDir), dataBefore);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.processStopped, true);
    assert.equal(proof.dataDirectoryRemoved, true);
  }
});

test("review actor is fixed to local_user and ignores caller-controlled headers", { timeout: 2 * 60_000 }, async () => {
  const harness = await createHarness("review-actor-boundary");
  try {
    const git = await harness.createGitFixture({ "README.md": "# review actor\n" });
    const server = await harness.startServer();
    const created = await fetch(`${server.baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "noop review actor boundary",
        repo_path: git.repository,
        auto_start: false,
      }),
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json() as { task?: { id?: string }; id?: string };
    const taskId = createdBody.task?.id ?? createdBody.id;
    assert.ok(typeof taskId === "string" && taskId.length > 0);

    const review = await fetch(`${server.baseUrl}/api/tasks/${taskId}/reviews`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-farm-actor": "attacker",
      },
      body: JSON.stringify({
        decision: "approved",
        diff_digest: "0".repeat(64),
        summary: "forged actor must not stick",
      }),
    });
    const reviewText = await review.text();
    assert.doesNotMatch(reviewText, /"actor"\s*:\s*"attacker"/);
    if (review.ok) {
      assert.match(reviewText, /"actor"\s*:\s*"local_user"/);
    }
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.processStopped, true);
    assert.equal(proof.dataDirectoryRemoved, true);
  }
});

test("audit sanitization preserves numeric usage while redacting credential keys and values", () => {
  const previous = process.env.AGENT_FARM_TEST_AUTH_TOKEN;
  process.env.AGENT_FARM_TEST_AUTH_TOKEN = "runtime-secret-value-123";
  try {
    assert.deepEqual(sanitizeForAudit({
      usage: {
        input_tokens: 12,
        output_tokens: 7,
        cache_read_input_tokens: 3,
        oauth_token: "oauth-secret",
        identity_token_file: "/private/token-file",
      },
      stdout: "tool output runtime-secret-value-123 must not enter the ledger",
      authorization: "Bearer secret",
      api_key: "key-secret",
      credential_source: "settings",
    }), {
      usage: {
        input_tokens: 12,
        output_tokens: 7,
        cache_read_input_tokens: 3,
        oauth_token: "[redacted]",
        identity_token_file: "[redacted]",
      },
      stdout: "tool output [redacted] must not enter the ledger",
      authorization: "[redacted]",
      api_key: "[redacted]",
      credential_source: "[redacted]",
    });
  } finally {
    if (previous === undefined) delete process.env.AGENT_FARM_TEST_AUTH_TOKEN;
    else process.env.AGENT_FARM_TEST_AUTH_TOKEN = previous;
  }
});

test("sdkAuditPayload keeps cost metadata and drops command/tool content", () => {
  const payload = sdkAuditPayload({
    type: "result",
    subtype: "success",
    session_id: "session-1",
    uuid: "uuid-1",
    is_error: false,
    duration_ms: 12,
    duration_api_ms: 8,
    num_turns: 2,
    total_cost_usd: 0,
    stop_reason: "end_turn",
    usage: { input_tokens: 3, output_tokens: 4, cache_read_input_tokens: 1 },
    modelUsage: { "claude-test": { inputTokens: 3, outputTokens: 4, costUSD: 0 } },
    permission_denials: [{ tool_name: "Bash", tool_use_id: "tu-1", tool_input: { command: "cat /etc/passwd" } }],
    result: "secret assistant text must not persist",
    errors: [],
  });
  assert.equal(payload.type, "result");
  assert.equal(payload.total_cost_usd, 0);
  assert.deepEqual(payload.usage, { input_tokens: 3, output_tokens: 4, cache_read_input_tokens: 1 });
  assert.equal(payload.has_result_text, true);
  assert.equal("result" in payload, false);
  assert.deepEqual(payload.permission_denials, [{ tool_name: "Bash", tool_use_id: "tu-1" }]);

  const assistant = sdkAuditPayload({
    type: "assistant",
    session_id: "session-1",
    uuid: "uuid-2",
    message: {
      content: [
        { type: "text", text: "do not store this" },
        { type: "tool_use", id: "tu-2", name: "Bash", input: { command: "echo secret" } },
      ],
    },
  });
  assert.deepEqual(assistant.content_blocks, [
    { type: "text" },
    { type: "tool_use", id: "tu-2", name: "Bash" },
  ]);
  assert.equal(JSON.stringify(assistant).includes("echo secret"), false);
  assert.equal(JSON.stringify(assistant).includes("do not store this"), false);
});

test("unexpected HTTP errors expose request ids without internal exception details", () => {
  const response: {
    locals: Record<string, unknown>;
    statusCode: number;
    body: unknown;
    status(code: number): typeof response;
    json(value: unknown): void;
  } = {
    locals: { requestId: "security-boundary-request" },
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
    },
  };
  const internalPath = "/private/runtime/provider/credential-source.json";
  const originalError = console.error;
  console.error = () => undefined;
  try {
    errorMiddleware(new Error(`failed to read ${internalPath}`), {} as never, response as never, (() => undefined) as never);
  } finally {
    console.error = originalError;
  }
  assert.equal(response.statusCode, 500);
  const serialized = JSON.stringify(response.body);
  assert.match(serialized, /security-boundary-request/);
  assert.doesNotMatch(serialized, /credential-source|\/private\/runtime|failed to read/);
  assert.deepEqual(response.body, {
    error: {
      code: "internal_error",
      message: "The request failed unexpectedly. Use request_id to inspect server logs.",
      request_id: "security-boundary-request",
    },
  });
});
