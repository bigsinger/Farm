import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { isWorktreePathAllowed } from "../../../server/src/agent.js";
import { errorMiddleware } from "../../../server/src/errors.js";
import { sanitizeForAudit } from "../../../server/src/ledger.js";
import { createHarness, SERVER_ROOT } from "../../lib/harness.js";
import { LedgerCollector } from "../../lib/ws-ledger.js";

interface WsClient {
  once(event: "open", listener: () => void): this;
  once(event: "error", listener: (error: Error) => void): this;
  once(event: "unexpected-response", listener: (_request: unknown, response: { statusCode?: number }) => void): this;
  close(): void;
  terminate(): void;
}

interface WsConstructor {
  new (url: string, options?: { origin?: string }): WsClient;
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

async function rejectedOriginStatus(url: string, origin: string): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const socket = new WebSocket(url, { origin });
    socket.once("open", () => {
      socket.terminate();
      reject(new Error("cross-origin WebSocket unexpectedly opened"));
    });
    socket.once("unexpected-response", (_request, response) => {
      socket.terminate();
      resolve(response.statusCode ?? 0);
    });
    socket.once("error", (error) => {
      if (!/Unexpected server response: 403/i.test(error.message)) reject(error);
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
    assert.equal(await rejectedOriginStatus(server.wsUrl, "https://attacker.example"), 403);
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

test("local project art is served only on loopback bindings", { timeout: 2 * 60_000 }, async () => {
  const harness = await createHarness("asset-license-boundary");
  try {
    let server = await harness.startServer();
    const local = await fetch(`${server.baseUrl}/assets/BootScene.scene`);
    assert.equal(local.status, 200);
    assert.match(local.headers.get("content-type") ?? "", /json|octet-stream/);

    await harness.stopServer();
    server = await harness.restartServer({ HOST: "0.0.0.0" });
    const nonLoopback = await fetch(`${server.baseUrl}/assets/BootScene.scene`);
    assert.equal(nonLoopback.status, 404);
    const body = await nonLoopback.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, "route_not_found");
    assert.match(server.stdout(), /not served on non-loopback bindings/);
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
