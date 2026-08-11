import crypto from "node:crypto";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import type { RawData } from "ws";
import { db, parseJson } from "./db.js";

const CLIENT_MAX_PAYLOAD_BYTES = 64 * 1024;
const MAX_OUTBOUND_FRAME_BYTES = 4 * 1024 * 1024;
const MAX_BUFFERED_BYTES = 8 * 1024 * 1024;
const MAX_REPLAY_BUFFER_EVENTS = 50_000;
const REPLAY_PAGE_SIZE = 250;
const SEND_TIMEOUT_MS = 15_000;
const CLOSE_GRACE_MS = 1_000;

const serverId = crypto.randomUUID();
const ledgerMetadata = db.prepare("SELECT ledger_id FROM ledger_metadata WHERE id = 1").get() as {
  ledger_id: string;
} | undefined;
if (!ledgerMetadata || typeof ledgerMetadata.ledger_id !== "string" || ledgerMetadata.ledger_id.length === 0) {
  throw new Error("persistent ledger metadata is missing or invalid");
}
const ledgerId = ledgerMetadata.ledger_id;

export interface AuditRow {
  seq: number | bigint;
  event_id: string;
  event_type: string;
  repository_id: string | null;
  task_id: string | null;
  run_id: string | null;
  payload_json: string;
  provenance_kind: string;
  provenance_source: string;
  provenance_digest: string | null;
  occurred_at: number | bigint;
}

export interface SerializedAuditEvent {
  seq: number;
  id: string;
  type: string;
  task_id: string | null;
  repository_id: string | null;
  run_id: string | null;
  occurred_at: number;
  payload: unknown;
  provenance: {
    kind: string;
    source: string;
    digest: string | null;
    seq: number;
  };
}

type LedgerEventReference = number | bigint | { seq: number | bigint };
type ClientPhase = "replaying" | "live" | "closing";
type SendWaiter = (error: Error) => void;

interface ClientState {
  ws: WebSocket;
  phase: ClientPhase;
  afterSeq: number;
  lastSentSeq: number;
  lastAckSeq: number;
  bufferedSeqs: Set<number>;
  pendingBytes: number;
  sendWaiters: Set<SendWaiter>;
}

interface LastSeqRow {
  last_seq: number | bigint;
}

let wss: WebSocketServer | null = null;
let attachedServer: HttpServer | null = null;
let upgradeHandler: ((request: IncomingMessage, socket: Duplex, head: Buffer) => void) | null = null;

const clients = new Map<WebSocket, ClientState>();
const requestCursors = new WeakMap<IncomingMessage, number>();
const lastSeqStatement = db.prepare("SELECT COALESCE(MAX(seq), 0) AS last_seq FROM audit_events");
const eventBySeqStatement = db.prepare(`
  SELECT
    seq,
    event_id,
    event_type,
    repository_id,
    task_id,
    run_id,
    payload_json,
    provenance_kind,
    provenance_source,
    provenance_digest,
    occurred_at
  FROM audit_events
  WHERE seq = ?
`);
const replayPageStatement = db.prepare(`
  SELECT
    seq,
    event_id,
    event_type,
    repository_id,
    task_id,
    run_id,
    payload_json,
    provenance_kind,
    provenance_source,
    provenance_digest,
    occurred_at
  FROM audit_events
  WHERE seq > ? AND seq <= ?
  ORDER BY seq ASC
  LIMIT ?
`);

function safeInteger(value: unknown, field: string, minimum: number): number {
  let numberValue: number;
  if (typeof value === "bigint") {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new RangeError(`${field} is outside the JavaScript safe integer range`);
    }
    numberValue = Number(value);
  } else if (typeof value === "number") {
    numberValue = value;
  } else {
    throw new TypeError(`${field} must be an integer`);
  }

  if (!Number.isSafeInteger(numberValue) || numberValue < minimum) {
    throw new RangeError(`${field} must be a safe integer greater than or equal to ${minimum}`);
  }
  return numberValue;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new TypeError(`${field} must be a string or null`);
  return value;
}

export function serializeAuditRow(row: AuditRow): SerializedAuditEvent {
  if (!row || typeof row !== "object") throw new TypeError("audit row must be an object");

  const seq = safeInteger(row.seq, "audit_events.seq", 1);
  const invalidJson = Symbol("invalid audit payload");
  const payload = parseJson<unknown | typeof invalidJson>(
    requiredString(row.payload_json, "audit_events.payload_json"),
    invalidJson,
  );
  if (payload === invalidJson) throw new TypeError(`audit event ${seq} has invalid payload_json`);

  return {
    seq,
    id: requiredString(row.event_id, "audit_events.event_id"),
    type: requiredString(row.event_type, "audit_events.event_type"),
    task_id: nullableString(row.task_id, "audit_events.task_id"),
    repository_id: nullableString(row.repository_id, "audit_events.repository_id"),
    run_id: nullableString(row.run_id, "audit_events.run_id"),
    occurred_at: safeInteger(row.occurred_at, "audit_events.occurred_at", Number.MIN_SAFE_INTEGER),
    payload,
    provenance: {
      kind: requiredString(row.provenance_kind, "audit_events.provenance_kind"),
      source: requiredString(row.provenance_source, "audit_events.provenance_source"),
      digest: nullableString(row.provenance_digest, "audit_events.provenance_digest"),
      seq,
    },
  };
}

function currentLastSeq(): number {
  const row = lastSeqStatement.get() as LastSeqRow | undefined;
  if (!row) throw new Error("audit ledger MAX(seq) query returned no row");
  return safeInteger(row.last_seq, "audit ledger last_seq", 0);
}

function readAuditEvent(seq: number): SerializedAuditEvent {
  const row = eventBySeqStatement.get(seq) as AuditRow | undefined;
  if (!row) throw new Error(`audit event seq ${seq} does not exist`);
  return serializeAuditRow(row);
}

function readReplayPage(afterSeq: number, throughSeq: number): SerializedAuditEvent[] {
  const rows = replayPageStatement.all(afterSeq, throughSeq, REPLAY_PAGE_SIZE) as AuditRow[];
  const events = rows.map(serializeAuditRow);
  let expectedSeq = afterSeq + 1;
  for (const event of events) {
    if (event.seq !== expectedSeq) {
      throw new Error(`audit ledger sequence gap: expected ${expectedSeq}, received ${event.seq}`);
    }
    expectedSeq += 1;
  }
  return events;
}

function referenceSeq(reference: LedgerEventReference): number {
  if (typeof reference === "number" || typeof reference === "bigint") {
    return safeInteger(reference, "audit event seq", 1);
  }
  if (reference && typeof reference === "object" && "seq" in reference) {
    return safeInteger(reference.seq, "audit event seq", 1);
  }
  throw new TypeError("publishLedgerEvent requires an audit row or seq");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function cleanupClient(state: ClientState, error: Error): void {
  if (state.phase === "closing") return;
  state.phase = "closing";
  clients.delete(state.ws);
  state.bufferedSeqs.clear();
  const waiters = Array.from(state.sendWaiters);
  state.sendWaiters.clear();
  for (const waiter of waiters) waiter(error);
  state.pendingBytes = 0;
}

function closeClient(state: ClientState, code: number, reason: string, terminate = false): void {
  const socket = state.ws;
  cleanupClient(state, new Error(`WebSocket closed: ${code} ${reason}`));

  try {
    if (socket.readyState === WebSocket.CLOSED) return;
    if (terminate) {
      socket.terminate();
      return;
    }
    socket.close(code, reason);
    const timer = setTimeout(() => {
      if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
    }, CLOSE_GRACE_MS);
    timer.unref();
  } catch {
    try {
      socket.terminate();
    } catch {
      // The socket is already unavailable; state cleanup above is authoritative.
    }
  }
}

function serializedEnvelope(envelope: unknown): { payload: string; bytes: number } {
  const payload = JSON.stringify(envelope);
  if (payload === undefined) throw new TypeError("WebSocket envelope is not JSON serializable");
  return { payload, bytes: Buffer.byteLength(payload) };
}

function sendEnvelope(state: ClientState, envelope: unknown): Promise<void> {
  if (state.phase === "closing" || state.ws.readyState !== WebSocket.OPEN) {
    const error = new Error("WebSocket is not open");
    cleanupClient(state, error);
    return Promise.reject(error);
  }

  let encoded: { payload: string; bytes: number };
  try {
    encoded = serializedEnvelope(envelope);
  } catch (error) {
    closeClient(state, 1011, "envelope serialization failed");
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }

  if (encoded.bytes > MAX_OUTBOUND_FRAME_BYTES) {
    const error = new Error(`outbound WebSocket frame exceeds ${MAX_OUTBOUND_FRAME_BYTES} bytes`);
    closeClient(state, 1009, "ledger event is too large");
    return Promise.reject(error);
  }
  if (state.pendingBytes + state.ws.bufferedAmount + encoded.bytes > MAX_BUFFERED_BYTES) {
    const error = new Error("WebSocket backpressure limit exceeded");
    closeClient(state, 1013, "client is not consuming events");
    return Promise.reject(error);
  }

  state.pendingBytes += encoded.bytes;
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      state.sendWaiters.delete(abort);
      state.pendingBytes = Math.max(0, state.pendingBytes - encoded.bytes);
      if (error) reject(error);
      else resolve();
    };
    const abort: SendWaiter = (error) => finish(error);
    const timer = setTimeout(() => {
      const error = new Error("WebSocket send timed out");
      finish(error);
      closeClient(state, 1013, "client send timed out", true);
    }, SEND_TIMEOUT_MS);
    timer.unref();
    state.sendWaiters.add(abort);

    try {
      state.ws.send(encoded.payload, { binary: false, compress: false }, (error) => {
        if (error) {
          const sendError = error instanceof Error ? error : new Error(String(error));
          finish(sendError);
          closeClient(state, 1011, "WebSocket send failed", true);
          return;
        }
        finish();
      });
    } catch (error) {
      const sendError = error instanceof Error ? error : new Error(String(error));
      finish(sendError);
      closeClient(state, 1011, "WebSocket send failed", true);
    }
  });
}

function pruneBufferedSeqs(state: ClientState): void {
  for (const seq of state.bufferedSeqs) {
    if (seq <= state.lastSentSeq) state.bufferedSeqs.delete(seq);
  }
}

function takeBufferedSeqs(state: ClientState): number[] {
  const sequences = Array.from(state.bufferedSeqs)
    .filter((seq) => seq > state.lastSentSeq)
    .sort((left, right) => left - right);
  state.bufferedSeqs.clear();
  return sequences;
}

async function sendReplayEvents(state: ClientState, events: SerializedAuditEvent[]): Promise<void> {
  let batch: SerializedAuditEvent[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    const lastSeq = batch[batch.length - 1]!.seq;
    await sendEnvelope(state, { type: "replay", events: batch, last_seq: lastSeq });
    state.lastSentSeq = lastSeq;
    pruneBufferedSeqs(state);
    batch = [];
  };

  for (const event of events) {
    if (event.seq <= state.lastSentSeq) continue;
    const candidate = [...batch, event];
    const candidateBytes = serializedEnvelope({
      type: "replay",
      events: candidate,
      last_seq: event.seq,
    }).bytes;
    if (candidateBytes <= MAX_OUTBOUND_FRAME_BYTES) {
      batch = candidate;
      continue;
    }

    await flush();
    const singleBytes = serializedEnvelope({
      type: "replay",
      events: [event],
      last_seq: event.seq,
    }).bytes;
    if (singleBytes > MAX_OUTBOUND_FRAME_BYTES) {
      closeClient(state, 1009, "ledger event is too large");
      throw new Error(`audit event seq ${event.seq} exceeds the outbound frame limit`);
    }
    batch = [event];
  }

  await flush();
}

async function replayThrough(state: ClientState, throughSeq: number, sendEmpty: boolean): Promise<void> {
  let sentAny = false;
  while (state.phase === "replaying" && state.lastSentSeq < throughSeq) {
    const page = readReplayPage(state.lastSentSeq, throughSeq);
    if (page.length === 0) {
      throw new Error(
        `audit ledger changed during replay: no rows after ${state.lastSentSeq} through ${throughSeq}`,
      );
    }
    let previousSeq = state.lastSentSeq;
    for (const event of page) {
      if (event.seq <= previousSeq || event.seq > throughSeq) {
        throw new Error(`audit ledger returned an out-of-order replay row at seq ${event.seq}`);
      }
      previousSeq = event.seq;
    }
    await sendReplayEvents(state, page);
    sentAny = true;
  }

  if (sendEmpty && !sentAny && state.phase === "replaying") {
    await sendEnvelope(state, { type: "replay", events: [], last_seq: state.lastSentSeq });
  }
}

async function initializeConnection(state: ClientState): Promise<void> {
  const helloLastSeq = currentLastSeq();
  await sendEnvelope(state, {
    type: "hello",
    server_id: serverId,
    ledger_id: ledgerId,
    last_seq: helloLastSeq,
    // There is no persistent process identity in the existing schema, so restart
    // detection must conservatively report true for every process connection.
    restarted: true,
  });

  if (state.afterSeq > helloLastSeq) {
    await sendEnvelope(state, {
      type: "resync_required",
      reason: "after_seq_ahead_of_ledger",
      after_seq: state.afterSeq,
      last_seq: helloLastSeq,
    });
    closeClient(state, 1008, "after_seq exceeds ledger last_seq");
    return;
  }

  await replayThrough(state, helloLastSeq, true);

  while (state.phase === "replaying") {
    const bufferedSeqs = takeBufferedSeqs(state);
    if (bufferedSeqs.length > 0) {
      const bufferedThroughSeq = bufferedSeqs[bufferedSeqs.length - 1]!;
      await replayThrough(state, bufferedThroughSeq, false);
      continue;
    }

    const catchupLastSeq = currentLastSeq();
    if (catchupLastSeq > state.lastSentSeq) {
      await replayThrough(state, catchupLastSeq, false);
      continue;
    }

    // sendEnvelope queues synchronously. Changing phase before awaiting its callback
    // makes ready precede every subsequent live send without an event-loop race.
    const readySend = sendEnvelope(state, { type: "ready", last_seq: state.lastSentSeq });
    if (state.phase !== "replaying") {
      await readySend;
      return;
    }
    state.phase = "live";
    await readySend;
    return;
  }
}

function rawDataToUtf8(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  throw new TypeError("unsupported WebSocket message payload");
}

function unsupportedClientMessage(state: ClientState, reason: string): void {
  closeClient(state, 1003, reason);
}

function handleClientMessage(state: ClientState, data: RawData, isBinary: boolean): void {
  if (state.phase === "closing") return;
  if (isBinary) {
    unsupportedClientMessage(state, "JSON text messages only");
    return;
  }

  let value: unknown;
  try {
    value = JSON.parse(rawDataToUtf8(data)) as unknown;
  } catch {
    unsupportedClientMessage(state, "invalid JSON message");
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    unsupportedClientMessage(state, "ping or ack JSON required");
    return;
  }

  const message = value as Record<string, unknown>;
  if (message.type === "ping") {
    void sendEnvelope(state, {
      type: "pong",
      server_id: serverId,
      last_seq: state.lastSentSeq,
    }).catch(() => undefined);
    return;
  }
  if (message.type === "ack") {
    let ackSeq: number;
    try {
      ackSeq = safeInteger(message.seq, "ack.seq", 0);
    } catch {
      unsupportedClientMessage(state, "ack requires a valid seq");
      return;
    }
    if (ackSeq > state.lastSentSeq) {
      unsupportedClientMessage(state, "ack seq exceeds sent seq");
      return;
    }
    state.lastAckSeq = Math.max(state.lastAckSeq, ackSeq);
    return;
  }

  unsupportedClientMessage(state, "unsupported client message");
}

function registerConnection(ws: WebSocket, request: IncomingMessage): void {
  const afterSeq = requestCursors.get(request);
  requestCursors.delete(request);
  if (afterSeq === undefined) {
    ws.close(1008, "missing validated after_seq");
    return;
  }

  const state: ClientState = {
    ws,
    phase: "replaying",
    afterSeq,
    lastSentSeq: afterSeq,
    lastAckSeq: afterSeq,
    bufferedSeqs: new Set<number>(),
    pendingBytes: 0,
    sendWaiters: new Set<SendWaiter>(),
  };
  clients.set(ws, state);

  ws.on("message", (data, isBinary) => handleClientMessage(state, data, isBinary));
  ws.on("close", (code, reason) => {
    cleanupClient(state, new Error(`peer closed WebSocket: ${code} ${reason.toString()}`));
  });
  ws.on("error", (error) => {
    console.error(`[ws] client error: ${errorMessage(error)}`);
    cleanupClient(state, error instanceof Error ? error : new Error(String(error)));
    try {
      ws.terminate();
    } catch {
      // The error may already have destroyed the socket.
    }
  });

  void initializeConnection(state).catch(async (error) => {
    console.error(`[ws] ledger replay failed: ${errorMessage(error)}`);
    if (state.phase !== "closing" && ws.readyState === WebSocket.OPEN) {
      try {
        await sendEnvelope(state, {
          type: "error",
          code: "ledger_replay_failed",
          message: "persistent ledger replay failed",
          retryable: true,
        });
      } catch {
        // sendEnvelope already cleaned up the failed connection.
      }
    }
    closeClient(state, 1011, "persistent ledger replay failed");
  });
}

function browserOriginAllowed(request: IncomingMessage): boolean {
  const originHeader = request.headers.origin;
  if (originHeader === undefined) return true;
  if (Array.isArray(originHeader) || originHeader.includes(",")) return false;
  const hostHeader = request.headers.host;
  if (typeof hostHeader !== "string" || hostHeader.length === 0) return false;
  try {
    const origin = new URL(originHeader);
    return (origin.protocol === "http:" || origin.protocol === "https:") && origin.host === hostHeader;
  } catch {
    return false;
  }
}

function parseAfterSeq(requestUrl: URL): number | null {
  const values = requestUrl.searchParams.getAll("after_seq");
  if (values.length === 0) return 0;
  if (values.length !== 1 || !/^\d+$/.test(values[0]!)) return null;
  const value = Number(values[0]);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function rejectUpgrade(socket: Duplex, status: number, statusText: string, body: string): void {
  if (socket.destroyed) return;
  const responseBody = `${body}\n`;
  const response = [
    `HTTP/1.1 ${status} ${statusText}`,
    "Connection: close",
    "Content-Type: text/plain; charset=utf-8",
    `Content-Length: ${Buffer.byteLength(responseBody)}`,
    "",
    responseBody,
  ].join("\r\n");

  const forceDestroy = setTimeout(() => socket.destroy(), CLOSE_GRACE_MS);
  forceDestroy.unref();
  try {
    socket.end(response, () => {
      clearTimeout(forceDestroy);
      socket.destroy();
    });
  } catch {
    clearTimeout(forceDestroy);
    socket.destroy();
  }
}

export function attachWs(server: HttpServer): WebSocketServer {
  if (wss || attachedServer || upgradeHandler) {
    throw new Error("WebSocket server is already attached");
  }

  const instance = new WebSocketServer({
    noServer: true,
    clientTracking: true,
    perMessageDeflate: false,
    maxPayload: CLIENT_MAX_PAYLOAD_BYTES,
  });

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    let requestUrl: URL;
    try {
      requestUrl = new URL(request.url ?? "", "http://localhost");
    } catch {
      rejectUpgrade(socket, 400, "Bad Request", "invalid WebSocket request URL");
      return;
    }

    if (requestUrl.pathname !== "/ws") {
      rejectUpgrade(socket, 404, "Not Found", "WebSocket endpoint not found");
      return;
    }
    if (request.method !== "GET") {
      rejectUpgrade(socket, 405, "Method Not Allowed", "WebSocket upgrade requires GET");
      return;
    }
    if (!browserOriginAllowed(request)) {
      rejectUpgrade(socket, 403, "Forbidden", "WebSocket Origin must match the HTTP Host");
      return;
    }

    const afterSeq = parseAfterSeq(requestUrl);
    if (afterSeq === null) {
      rejectUpgrade(socket, 400, "Bad Request", "after_seq must be one non-negative safe integer");
      return;
    }
    requestCursors.set(request, afterSeq);

    try {
      instance.handleUpgrade(request, socket, head, (ws) => {
        if (wss !== instance) {
          ws.terminate();
          return;
        }
        instance.emit("connection", ws, request);
      });
    } catch (error) {
      requestCursors.delete(request);
      console.error(`[ws] WebSocket upgrade failed: ${errorMessage(error)}`);
      socket.destroy();
    }
  };

  instance.on("connection", registerConnection);
  instance.on("error", (error) => {
    console.error(`[ws] server error: ${errorMessage(error)}`);
  });
  server.on("upgrade", onUpgrade);

  wss = instance;
  attachedServer = server;
  upgradeHandler = onUpgrade;
  return instance;
}

function queueLiveThrough(state: ClientState, throughSeq: number): void {
  while (state.phase === "live" && state.lastSentSeq < throughSeq) {
    const events = readReplayPage(state.lastSentSeq, throughSeq);
    if (events.length === 0) {
      closeClient(state, 1011, "ledger live sequence is unavailable");
      return;
    }
    for (const event of events) {
      if (state.phase !== "live") return;
      if (event.seq <= state.lastSentSeq || event.seq > throughSeq) {
        closeClient(state, 1011, "ledger live sequence is invalid");
        return;
      }
      const send = sendEnvelope(state, { type: "live", event });
      if (state.phase !== "live") {
        void send.catch(() => undefined);
        return;
      }
      state.lastSentSeq = event.seq;
      void send.catch(() => undefined);
    }
  }
}

export function publishLedgerEvent(reference: LedgerEventReference): SerializedAuditEvent {
  const seq = referenceSeq(reference);
  let event: SerializedAuditEvent;
  try {
    // Always re-read, even when the caller supplied a row. SQLite is the only
    // authoritative event source; caller-owned objects never become history.
    event = readAuditEvent(seq);
  } catch (error) {
    console.error(`[ws] published ledger event could not be read: ${errorMessage(error)}`);
    for (const state of Array.from(clients.values())) {
      closeClient(state, 1011, "persistent ledger read failed");
    }
    throw error;
  }

  for (const state of Array.from(clients.values())) {
    if (state.phase === "replaying") {
      state.bufferedSeqs.add(seq);
      if (state.bufferedSeqs.size > MAX_REPLAY_BUFFER_EVENTS) {
        closeClient(state, 1013, "replay buffer limit exceeded");
      }
      continue;
    }
    if (state.phase === "live" && seq > state.lastSentSeq) {
      try {
        queueLiveThrough(state, seq);
      } catch (error) {
        console.error(`[ws] live ledger read failed: ${errorMessage(error)}`);
        closeClient(state, 1011, "persistent ledger read failed");
      }
    }
  }

  return event;
}

// Kept for compatibility with legacy callers. Only persisted audit references
// are eligible for WebSocket publication; arbitrary in-memory messages are not.
export function broadcast(message: unknown): void {
  if (typeof message === "number" || typeof message === "bigint") {
    publishLedgerEvent(message);
    return;
  }
  if (
    message &&
    typeof message === "object" &&
    "seq" in message &&
    (typeof (message as { seq?: unknown }).seq === "number" ||
      typeof (message as { seq?: unknown }).seq === "bigint")
  ) {
    publishLedgerEvent(message as { seq: number | bigint });
  }
}

export async function closeWs(): Promise<void> {
  const instance = wss;
  const server = attachedServer;
  const onUpgrade = upgradeHandler;

  wss = null;
  attachedServer = null;
  upgradeHandler = null;
  if (server && onUpgrade) server.off("upgrade", onUpgrade);
  if (!instance) return;

  for (const state of Array.from(clients.values())) {
    closeClient(state, 1001, "server shutting down");
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(forceTimer);
      if (error) reject(error);
      else resolve();
    };
    const forceTimer = setTimeout(() => {
      for (const client of instance.clients) {
        try {
          client.terminate();
        } catch {
          // Continue terminating the remaining clients.
        }
      }
      finish();
    }, CLOSE_GRACE_MS);

    try {
      instance.close((error) => finish(error));
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
