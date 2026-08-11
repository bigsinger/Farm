import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { createRequire } from "node:module";
import { cp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { ApiClient, asObject } from "../../lib/api.js";
import { FarmApi } from "../../lib/farm-api.js";
import { createHarness, git, reservePort, run, SERVER_ROOT } from "../../lib/harness.js";
import { applyControlledCorruptionFixture, findSqliteDatabase, sqliteJson } from "../../lib/sqlite.js";
import { LedgerCollector } from "../../lib/ws-ledger.js";
import {
  ProtocolError,
  acceptsLedgerEvents,
  getEventPage,
  getEvents,
  ledgerCursorRequiresReset,
  type LedgerEvent,
} from "../../../web-app/src/api.js";

type JsonObject = Record<string, unknown>;
type SqlParameter = string | number | null;

interface SocketLike {
  readonly OPEN: number;
  readonly readyState: number;
  send(data: string): void;
  terminate(): void;
}

interface WebSocketServerLike {
  clients: Set<SocketLike>;
  on(event: "connection", listener: (socket: SocketLike, request: IncomingMessage) => void): void;
  close(callback: () => void): void;
}

interface WebSocketServerConstructor {
  new (options: { server: Server; path: string }): WebSocketServerLike;
}

const serverRequire = createRequire(join(SERVER_ROOT, "package.json"));
const { WebSocketServer } = serverRequire("ws") as { WebSocketServer: WebSocketServerConstructor };
const AUDIT_INSERT = `
  INSERT INTO audit_events (
    event_id, event_type, entity_type, entity_id, repository_id, task_id, run_id,
    actor, payload_json, provenance_kind, provenance_source, provenance_digest, occurred_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function ledgerEvent(seq: number): LedgerEvent {
  return {
    seq,
    id: `event-${seq}`,
    type: "fixture_event",
    taskId: null,
    occurredAt: new Date(seq).toISOString(),
    payload: {},
    provenance: {
      eventId: `event-${seq}`,
      seq,
      kind: "fixture",
      source: "e2e",
      recordedAt: new Date(seq).toISOString(),
      digest: null,
    },
  };
}

async function hello(wsUrl: string, afterSeq = 0): Promise<JsonObject> {
  const socket = new WebSocket(`${wsUrl}?after_seq=${afterSeq}`);
  try {
    return await new Promise<JsonObject>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out waiting for WebSocket hello")), 10_000);
      socket.addEventListener("message", (message) => {
        if (typeof message.data !== "string") return;
        const frame = JSON.parse(message.data) as JsonObject;
        if (frame.type !== "hello") return;
        clearTimeout(timer);
        resolve(frame);
      });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("WebSocket failed before hello"));
      });
    });
  } finally {
    socket.close(1000, "hello captured");
  }
}

async function jsonServer(
  handler: (request: IncomingMessage) => JsonObject,
): Promise<{ baseUrl: string; close(): Promise<void> }> {
  const port = await reservePort();
  const server = createServer((request, response) => {
    const body = JSON.stringify(handler(request));
    response.writeHead(200, {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
    });
    response.end(body);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test("durable ledger identity survives restart and changes when the same SQLite path is replaced", { timeout: 3 * 60_000 }, async () => {
  const harness = await createHarness("ledger-id-replacement");
  try {
    let server = await harness.startServer();
    const first = await hello(server.wsUrl);
    const firstLedgerId = String(first.ledger_id);
    assert.match(firstLedgerId, /^[0-9a-f-]{36}$/i);

    server = await harness.restartServer();
    const restarted = await hello(server.wsUrl);
    assert.equal(restarted.ledger_id, firstLedgerId, "process restart must retain persistent ledger identity");

    await harness.stopServer();
    const database = await findSqliteDatabase(harness.dataDir);
    for (const suffix of ["-wal", "-shm"] as const) await rm(`${database}${suffix}`, { force: true });
    const replacementDir = join(harness.root, "replacement-data");
    await mkdir(replacementDir, { recursive: true });
    const replacementDatabase = join(replacementDir, "db.sqlite");
    run(join(SERVER_ROOT, "node_modules", ".bin", "tsx"), ["-e", "import './src/db.ts'"], {
      cwd: SERVER_ROOT,
      env: { AGENT_FARM_DATA_DIR: replacementDir },
    });
    await rename(database, `${database}.old`);
    await cp(replacementDatabase, database);
    server = await harness.startServer();
    const replaced = await hello(server.wsUrl);
    assert.notEqual(replaced.ledger_id, firstLedgerId, "independent database at the same path must get a new ledger identity");

    assert.equal(ledgerCursorRequiresReset(firstLedgerId, String(replaced.ledger_id), 52), true);
    assert.equal(ledgerCursorRequiresReset(null, String(replaced.ledger_id), 52), true);
    assert.equal(ledgerCursorRequiresReset(String(replaced.ledger_id), String(replaced.ledger_id), 52), false);
  } finally {
    await harness.cleanup();
  }
});

test("REST pagination exposes page tail separately from ledger head and delivers 10052 events without gaps", { timeout: 3 * 60_000 }, async () => {
  const harness = await createHarness("events-pagination-10052");
  try {
    await harness.startServer();
    await harness.stopServer();
    const database = await findSqliteDatabase(harness.dataDir);
    const count = 10_052;
    const existing = (await sqliteJson<{ seq: number }>(
      database,
      harness.dataDir,
      "SELECT COALESCE(MAX(seq), 0) AS seq FROM audit_events;",
    ))[0]!.seq;
    const values = Array.from({ length: count }, (_, index) => {
      const seq = existing + index + 1;
      return `('bulk-${seq}', 'fixture.bulk', 'fixture', 'bulk-${seq}', NULL, NULL, NULL, 'e2e', '{}', 'fixture', 'sqlite', NULL, ${seq})`;
    });
    run("sqlite3", [database], {
      input: ["PRAGMA foreign_keys=ON;", "BEGIN IMMEDIATE;", `INSERT INTO audit_events (event_id, event_type, entity_type, entity_id, repository_id, task_id, run_id, actor, payload_json, provenance_kind, provenance_source, provenance_digest, occurred_at) VALUES ${values.join(",")};`, "COMMIT;"].join("\n"),
    });
    const server = await harness.startServer();
    const api = new ApiClient(server.baseUrl);
    const firstPage = asObject((await api.get("/api/events?after_seq=0", 200)).body, "events first page");
    assert.equal((firstPage.events as unknown[]).length, 10_000);
    assert.equal(firstPage.last_seq, 10_000);
    assert.equal(firstPage.has_more, true);
    const ledgerHead = Number(firstPage.ledger_last_seq);
    assert.ok(Number.isSafeInteger(ledgerHead) && ledgerHead >= existing + count);
    const secondPage = asObject((await api.get("/api/events?after_seq=10000", 200)).body, "events second page");
    assert.equal((secondPage.events as unknown[]).length, ledgerHead - 10_000);
    assert.equal(secondPage.last_seq, ledgerHead);
    assert.equal(secondPage.has_more, false);
    assert.equal(secondPage.ledger_last_seq, ledgerHead);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), server.baseUrl);
      return originalFetch(new URL(`${url.pathname}${url.search}`, server.baseUrl), init);
    }) as typeof fetch;
    try {
      const events = await getEvents(0);
      assert.equal(events.length, ledgerHead);
      assert.equal(events[0]?.seq, 1);
      assert.equal(events.at(-1)?.seq, ledgerHead);
      assert.equal(new Set(events.map((event) => event.seq)).size, ledgerHead);
      assert.equal(events.filter((event) => event.type === "fixture.bulk").length, count);
      assert.deepEqual(acceptsLedgerEvents(0, events), { accepted: events, lastSeq: ledgerHead, gapAt: null });
    } finally {
      globalThis.fetch = originalFetch;
    }
  } finally {
    await harness.cleanup();
  }
});

test("client rejects out-of-order REST pages and replay frames instead of sorting them", async () => {
  const rest = await jsonServer(() => ({
    events: [
      { seq: 2, id: "two", type: "fixture", occurred_at: 2, payload: {}, provenance: { kind: "fixture", source: "e2e", seq: 2 } },
      { seq: 1, id: "one", type: "fixture", occurred_at: 1, payload: {}, provenance: { kind: "fixture", source: "e2e", seq: 1 } },
    ],
    last_seq: 1,
    has_more: false,
    ledger_last_seq: 1,
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => originalFetch(new URL(String(input), rest.baseUrl), init)) as typeof fetch;
  try {
    await assert.rejects(getEventPage(0), (error) => error instanceof ProtocolError && /乱序|gap/.test(error.message));
  } finally {
    globalThis.fetch = originalFetch;
    await rest.close();
  }

  const accepted = acceptsLedgerEvents(0, [ledgerEvent(2), ledgerEvent(1)]);
  assert.deepEqual({ lastSeq: accepted.lastSeq, gapAt: accepted.gapAt, count: accepted.accepted.length }, { lastSeq: 0, gapAt: 2, count: 0 });

  const port = await reservePort();
  const http = createServer();
  const ws = new WebSocketServer({ server: http, path: "/ws" });
  ws.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "hello", server_id: "fixture", ledger_id: "fixture-ledger", last_seq: 2, restarted: false }));
    socket.send(JSON.stringify({ type: "replay", events: [
      { seq: 2, id: "two", type: "fixture", occurred_at: 2, payload: {}, provenance: { kind: "fixture", source: "e2e", seq: 2 } },
      { seq: 1, id: "one", type: "fixture", occurred_at: 1, payload: {}, provenance: { kind: "fixture", source: "e2e", seq: 1 } },
    ], last_seq: 1 }));
  });
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(port, "127.0.0.1", resolve);
  });
  const collector = new LedgerCollector(`ws://127.0.0.1:${port}/ws`, 0);
  try {
    await collector.connect();
    await assert.rejects(collector.waitUntilReady(2_000), /sequence gap/i);
    assert.equal(collector.lastSeq, 0);
  } finally {
    await collector.close().catch(() => undefined);
    for (const client of ws.clients) client.terminate();
    await new Promise<void>((resolve) => ws.close(resolve));
    await new Promise<void>((resolve) => http.close(() => resolve()));
  }
});

test("detail refresh invalidates a dirty approval and repository observations use live Git plus latest persisted provenance", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("dirty-review-repository-provenance");
  try {
    const fixture = await harness.createGitFixture({ "README.md": "initial\n" });
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const first = await farm.seed({ repoPath: fixture.repository, prompt: "First repository observation.", autoStart: false });
    const firstRepository = asObject(first.repository, "first repository projection");
    const firstProvenance = asObject(firstRepository.provenance, "first repository provenance");

    const second = await farm.seed({ repoPath: fixture.repository, prompt: "Second repository observation.", autoStart: false });
    const secondRepository = asObject(second.repository, "second repository projection");
    const secondProvenance = asObject(secondRepository.provenance, "second repository provenance");
    assert.ok(Number(secondProvenance.seq) > Number(firstProvenance.seq));
    assert.equal(secondProvenance.kind, "git_inspection");
    assert.equal(secondRepository.clean, true);
    const observation = asObject(secondRepository.observation_provenance, "repository observation provenance");
    assert.equal(observation.kind, "git_repository_inspection");
    assert.equal(observation.source, "git");
    assert.match(String(observation.digest), /^[a-f0-9]{64}$/);

    await writeFile(join(fixture.repository, "base-live.txt"), "live repository mutation\n");
    git(fixture.repository, "add", "base-live.txt");
    git(fixture.repository, "commit", "--quiet", "-m", "advance base repository");
    const advancedHead = git(fixture.repository, "rev-parse", "HEAD");
    const observed = await farm.task(second.task.id);
    const observedRepository = asObject(observed.repository, "live repository projection");
    assert.equal(observedRepository.head_commit, advancedHead);
    assert.equal(observedRepository.clean, true);
    assert.equal(asObject(observedRepository.provenance, "persisted provenance").seq, secondProvenance.seq);

    const taskId = first.task.id;
    assert.ok(first.task.worktree_path);
    await writeFile(join(first.task.worktree_path!, "approved.txt"), "approved content\n");
    const diff = asObject((await farm.http.get(`/api/tasks/${taskId}/diff`, 200)).body, "approved diff");
    await harness.stopServer();
    const database = await findSqliteDatabase(harness.dataDir);
    const reviewId = randomUUID();
    const reviewEventId = `fixture-review-${randomUUID()}`;
    const now = Date.now();
    await applyControlledCorruptionFixture({
      database,
      dataDir: harness.dataDir,
      artifactDir: harness.artifactDir,
      purpose: "establish a digest-bound approved projection, then verify real dirty worktree drift invalidates it",
      statements: [
        {
          sql: AUDIT_INSERT,
          parameters: [reviewEventId, "task.review.approved", "review", reviewId, first.task.repository_id, taskId, null, "e2e", JSON.stringify({ decision: "approved", diff_digest: diff.digest }), "human_review", "http_api", String(diff.digest), now],
        },
        {
          sql: "INSERT INTO reviews (id, task_id, decision, diff_digest, summary, reviewer, created_at, source_event_seq) VALUES (?, ?, 'approved', ?, 'fixture approval', 'e2e', ?, (SELECT seq FROM audit_events WHERE event_id = ?))",
          parameters: [reviewId, taskId, String(diff.digest), now, reviewEventId],
        },
        {
          sql: "UPDATE tasks SET status = 'review_pending', review_status = 'approved', current_diff_digest = ?, approved_diff_digest = ?, row_version = row_version + 1 WHERE id = ?",
          parameters: [String(diff.digest), String(diff.digest), taskId],
        },
      ],
      corruption_fixture: true,
    });
    await harness.startServer();
    const approved = await farm.task(taskId);
    assert.equal(approved.task.review_stale, false);
    assert.equal(asObject(approved.reviews.at(-1), "approved review").stale, false);

    await writeFile(join(first.task.worktree_path!, "approved.txt"), "approved content changed after review\n");
    const stale = await farm.task(taskId);
    assert.equal(stale.task.review_status, "stale");
    assert.equal(stale.task.review_stale, true);
    assert.equal(asObject(stale.reviews.at(-1), "stale review").stale, true);
    assert.ok((stale.eligibility.reasons as string[]).includes("review_stale") || (stale.eligibility.reasons as string[]).includes("review_not_approved"));
  } finally {
    await harness.cleanup();
  }
});

test("concurrent wilt/detail never returns a seeded task with wilted eligibility", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("concurrent-wilt-detail");
  try {
    const fixture = await harness.createGitFixture();
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const task = await farm.seed({ repoPath: fixture.repository, prompt: "Concurrent wilt detail snapshot.", autoStart: false });
    const detailRequests = Array.from({ length: 40 }, () => fetch(`${server.baseUrl}/api/tasks/${task.task.id}`));
    const wiltRequest = fetch(`${server.baseUrl}/api/tasks/${task.task.id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "concurrent boundary" }),
    });
    const [wilt, ...details] = await Promise.all([wiltRequest, ...detailRequests]);
    assert.equal(wilt.status, 200);
    for (const response of details) {
      assert.ok(response.status === 200 || response.status === 409, `unexpected detail status ${response.status}`);
      if (response.status === 409) {
        const body = asObject(await response.json(), "snapshot conflict");
        assert.equal(asObject(body.error, "snapshot conflict error").code, "task_snapshot_changed");
        continue;
      }
      const detail = asObject(await response.json(), "concurrent detail");
      const projectedTask = asObject(detail.task, "concurrent task");
      const eligibility = asObject(detail.eligibility, "concurrent eligibility");
      const reasons = eligibility.reasons as string[];
      assert.equal(projectedTask.status === "seeded" && reasons.includes("status:wilted"), false);
      assert.equal(projectedTask.status === "wilted" && !reasons.includes("status:wilted"), false);
    }
  } finally {
    await harness.cleanup();
  }
});

test("terminal detail/diff reads the retained artifact after worktree cleanup and truncates CJK at a valid UTF-8 byte boundary", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("terminal-artifact-cjk");
  try {
    const fixture = await harness.createGitFixture();
    let server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const task = await farm.seed({ repoPath: fixture.repository, prompt: "Terminal retained artifact and CJK truncation.", autoStart: false });
    assert.ok(task.task.worktree_path);
    const cjk = "农田账本".repeat(32);
    await writeFile(join(task.task.worktree_path!, "cjk.txt"), `${cjk}\n`);
    const captured = asObject((await farm.http.get(`/api/tasks/${task.task.id}/diff`, 200)).body, "captured CJK diff");
    const fullPatch = String(captured.patch);
    const fullDigest = String(captured.digest);
    assert.match(fullPatch, /农田账本/);

    await harness.stopServer();
    const database = await findSqliteDatabase(harness.dataDir);
    const now = Date.now();
    const terminalEventId = `fixture-terminal-${randomUUID()}`;
    await applyControlledCorruptionFixture({
      database,
      dataDir: harness.dataDir,
      artifactDir: harness.artifactDir,
      purpose: "mark the task terminal while preserving its real captured patch, then remove the worktree as production cleanup does",
      statements: [
        {
          sql: AUDIT_INSERT,
          parameters: [terminalEventId, "task.wilt.succeeded", "outcome", task.task.id, task.task.repository_id, task.task.id, null, "e2e", JSON.stringify({ reason: "terminal artifact fixture", cleanup_errors: [] }), "cleanup_proof", "git_worktree", null, now],
        },
        {
          sql: "UPDATE tasks SET status = 'wilted', outcome_status = 'succeeded', updated_at = ?, row_version = row_version + 1 WHERE id = ?",
          parameters: [now, task.task.id],
        },
      ],
      corruption_fixture: true,
    });
    git(fixture.repository, "worktree", "remove", "--force", task.task.worktree_path!);
    git(fixture.repository, "branch", "-D", task.task.branch_name!);

    server = await harness.startServer({ AGENT_FARM_DIFF_RESPONSE_MAX_BYTES: "100" });
    const terminalFarm = new FarmApi(server.baseUrl);
    const detail = await terminalFarm.task(task.task.id);
    assert.equal(detail.task.status, "wilted");
    assert.equal(asObject(detail.worktree_health, "terminal worktree observation").state, "missing");
    const terminalDiff = asObject((await terminalFarm.http.get(`/api/tasks/${task.task.id}/diff`, 200)).body, "terminal diff");
    assert.equal(terminalDiff.digest, fullDigest);
    assert.equal(terminalDiff.truncated, true);
    const prefix = String(terminalDiff.patch);
    assert.ok(Buffer.byteLength(prefix, "utf8") <= 100);
    assert.equal(prefix.includes("�"), false);
    assert.ok(fullPatch.startsWith(prefix));
  } finally {
    await harness.cleanup();
  }
});
