import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { join } from "node:path";
import { reservePort, SERVER_ROOT } from "../../lib/harness.js";
import { LedgerCollector } from "../../lib/ws-ledger.js";

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

interface LedgerSocketServer {
  http: Server;
  ws: WebSocketServerLike;
  url: string;
  events: Array<Record<string, unknown>>;
  broadcast(event: Record<string, unknown>): void;
  close(): Promise<void>;
}

async function startLedgerSocketServer(): Promise<LedgerSocketServer> {
  const port = await reservePort();
  const http = createServer();
  const ws = new WebSocketServer({ server: http, path: "/ws" });
  const events: Array<Record<string, unknown>> = [];
  ws.on("connection", (socket, request) => {
    const url = new URL(request.url ?? "/ws", `http://127.0.0.1:${port}`);
    const after = Number(url.searchParams.get("after_seq") ?? 0);
    for (const event of events) {
      if (typeof event.seq === "number" && event.seq > after) socket.send(JSON.stringify(event));
    }
  });
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(port, "127.0.0.1", () => resolve());
  });
  return {
    http,
    ws,
    url: `ws://127.0.0.1:${port}/ws`,
    events,
    broadcast(event) {
      events.push(event);
      const frame = JSON.stringify(event);
      for (const client of ws.clients) {
        if (client.readyState === client.OPEN) client.send(frame);
      }
    },
    async close() {
      for (const client of ws.clients) client.terminate();
      await new Promise<void>((resolve) => ws.close(() => resolve()));
      await new Promise<void>((resolve, reject) => http.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

let socketServer: LedgerSocketServer;

before(async () => {
  socketServer = await startLedgerSocketServer();
});

after(async () => {
  await socketServer.close();
});

test("ledger collector reconnects with after_seq and receives every event exactly once", async () => {
  const offset = socketServer.events.length;
  const first = new LedgerCollector(socketServer.url, offset);
  await first.connect();
  socketServer.broadcast({ seq: offset + 1, kind: "task_seeded", payload: { id: "real-frame-one" } });
  socketServer.broadcast({ seq: offset + 2, kind: "claim_acquired", payload: { id: "real-frame-two" } });
  await first.waitForSequence(offset + 2);
  first.assertContiguousThrough(offset + 2);

  await first.close(1000, "intentional e2e disconnect");
  socketServer.broadcast({ seq: offset + 3, kind: "task_blocked", payload: { reason: "dependency" } });
  socketServer.broadcast({ seq: offset + 4, kind: "task_unblocked", payload: { reason: "claim_released" } });
  const replay = new LedgerCollector(socketServer.url, offset + 2);
  await replay.connect();
  await replay.waitForSequence(offset + 4);
  replay.assertContiguousThrough(offset + 4);

  const allSequences = [...first.events, ...replay.events].map((event) => event.seq);
  assert.deepEqual(allSequences, [offset + 1, offset + 2, offset + 3, offset + 4]);
  assert.equal(new Set(allSequences).size, allSequences.length);
  assert.match(replay.collection.url, new RegExp(`after_seq=${offset + 2}`));
  await replay.close();
});

test("ledger collector rejects duplicate and gapped terminal history", async () => {
  const port = await reservePort();
  const http = createServer();
  const ws = new WebSocketServer({ server: http, path: "/ws" });
  ws.on("connection", (socket) => {
    socket.send(JSON.stringify({ seq: 1, kind: "seeded" }));
    socket.send(JSON.stringify({ seq: 3, kind: "terminal" }));
  });
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(port, "127.0.0.1", () => resolve());
  });
  const collector = new LedgerCollector(`ws://127.0.0.1:${port}/ws`, 0);
  try {
    await collector.connect();
    await assert.rejects(collector.waitForSequence(3, 5_000), /sequence gap/);
    assert.equal(collector.lastSeq, 1);
  } finally {
    await collector.close().catch(() => undefined);
    for (const client of ws.clients) client.terminate();
    await new Promise<void>((resolve) => ws.close(() => resolve()));
    await new Promise<void>((resolve) => http.close(() => resolve()));
  }
});
