import { EventEmitter, once } from "node:events";

export interface LedgerEvent {
  seq: number;
  raw: Record<string, unknown>;
}

export interface LedgerCollection {
  url: string;
  afterSeq: number;
  events: LedgerEvent[];
  envelopes: Record<string, unknown>[];
  hello?: Record<string, unknown>;
  readyLastSeq?: number;
  openedAt: string;
  closedAt?: string;
}

function eventObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`WebSocket ledger frame must be a JSON object, got ${JSON.stringify(value)}`);
  }
  return value as Record<string, unknown>;
}

function extractSequence(frame: Record<string, unknown>): number {
  const direct = frame.seq;
  const nested = frame.event && typeof frame.event === "object" && !Array.isArray(frame.event)
    ? (frame.event as Record<string, unknown>).seq
    : undefined;
  const sequence = typeof direct === "number" ? direct : nested;
  if (typeof sequence !== "number" || !Number.isSafeInteger(sequence) || sequence < 1) {
    throw new TypeError(`Ledger frame has no positive integer seq: ${JSON.stringify(frame)}`);
  }
  return sequence;
}

function wsDataToText(data: unknown): Promise<string> | string {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  if (typeof Blob !== "undefined" && data instanceof Blob) return data.text();
  throw new TypeError(`Unsupported WebSocket frame type: ${Object.prototype.toString.call(data)}`);
}

export class LedgerCollector extends EventEmitter {
  readonly baseUrl: string;
  readonly afterSeq: number;
  readonly collection: LedgerCollection;
  #socket?: WebSocket;
  #failure?: Error;
  #seen = new Set<number>();
  #lastSeq: number;

  constructor(baseUrl: string, afterSeq = 0) {
    super();
    if (!Number.isSafeInteger(afterSeq) || afterSeq < 0) throw new TypeError(`Invalid after_seq: ${afterSeq}`);
    const url = new URL(baseUrl);
    url.searchParams.set("after_seq", String(afterSeq));
    this.baseUrl = baseUrl;
    this.afterSeq = afterSeq;
    this.#lastSeq = afterSeq;
    this.collection = { url: url.toString(), afterSeq, events: [], envelopes: [], openedAt: new Date().toISOString() };
  }

  get events(): readonly LedgerEvent[] {
    return this.collection.events;
  }

  get lastSeq(): number {
    return this.#lastSeq;
  }

  get failure(): Error | undefined {
    return this.#failure;
  }

  async connect(timeoutMs = 10_000): Promise<void> {
    if (this.#socket) throw new Error("LedgerCollector is already connected");
    const socket = new WebSocket(this.collection.url);
    this.#socket = socket;
    socket.addEventListener("message", (message) => {
      void this.#consume(message.data).catch((error) => {
        this.#failure = error instanceof Error ? error : new Error(String(error));
        this.emit("failure", this.#failure);
        socket.close(4002, "invalid ledger frame");
      });
    });
    socket.addEventListener("close", () => {
      this.collection.closedAt = new Date().toISOString();
      this.emit("closed");
    });
    socket.addEventListener("error", () => {
      const error = new Error(`WebSocket connection failed: ${this.collection.url}`);
      this.#failure = error;
      this.emit("failure", error);
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out opening ${this.collection.url}`));
      }, timeoutMs);
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(this.#failure ?? new Error(`WebSocket connection failed: ${this.collection.url}`));
      };
      const onClose = () => {
        cleanup();
        reject(new Error(`WebSocket closed before opening: ${this.collection.url}`));
      };
      const cleanup = () => {
        clearTimeout(timer);
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
      };
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onClose);
    });
  }

  async #consume(data: unknown): Promise<void> {
    const text = await wsDataToText(data);
    const frame = eventObject(JSON.parse(text) as unknown);
    this.collection.envelopes.push(frame);
    const type = frame.type;
    if (type === "hello") {
      this.collection.hello = frame;
      this.emit("hello", frame);
      return;
    }
    if (type === "ready") {
      if (typeof frame.last_seq !== "number" || !Number.isSafeInteger(frame.last_seq) || frame.last_seq < this.#lastSeq) {
        throw new Error(`Invalid ready last_seq: ${JSON.stringify(frame)}`);
      }
      if (frame.last_seq !== this.#lastSeq) {
        throw new Error(`Ready sequence gap: collector=${this.#lastSeq}, ready=${frame.last_seq}`);
      }
      this.collection.readyLastSeq = frame.last_seq;
      this.emit("ready", frame.last_seq);
      return;
    }
    const rawEvents = type === "replay"
      ? frame.events
      : type === "live"
        ? [frame.event]
        : [frame];
    if (!Array.isArray(rawEvents)) throw new TypeError(`Ledger envelope has no event array: ${JSON.stringify(frame)}`);
    for (const value of rawEvents) {
      const event = eventObject(value);
      const seq = extractSequence(event);
      if (seq <= this.afterSeq) throw new Error(`Replay violated after_seq=${this.afterSeq}: received ${seq}`);
      if (this.#seen.has(seq)) throw new Error(`Duplicate ledger sequence ${seq}`);
      if (seq !== this.#lastSeq + 1) throw new Error(`Ledger sequence gap: expected ${this.#lastSeq + 1}, received ${seq}`);
      this.#seen.add(seq);
      this.#lastSeq = seq;
      this.collection.events.push({ seq, raw: event });
      this.emit("event", seq);
    }
  }

  async waitUntilReady(timeoutMs = 30_000): Promise<number> {
    if (this.collection.readyLastSeq !== undefined) return this.collection.readyLastSeq;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for ready envelope from ${this.collection.url}`));
      }, timeoutMs);
      const onReady = () => { cleanup(); resolve(); };
      const onFailure = (error: Error) => { cleanup(); reject(error); };
      const cleanup = () => {
        clearTimeout(timer);
        this.off("ready", onReady);
        this.off("failure", onFailure);
      };
      this.once("ready", onReady);
      this.once("failure", onFailure);
    });
    return this.collection.readyLastSeq!;
  }

  async waitForSequence(sequence: number, timeoutMs = 30_000): Promise<LedgerEvent> {
    const existing = this.collection.events.find((event) => event.seq >= sequence);
    if (existing) return existing;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.#failure) throw this.#failure;
      const remaining = deadline - Date.now();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error(`Timed out waiting for ledger seq ${sequence}`));
        }, remaining);
        const onEvent = () => {
          cleanup();
          resolve();
        };
        const onFailure = (error: Error) => {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          clearTimeout(timer);
          this.off("event", onEvent);
          this.off("failure", onFailure);
        };
        this.once("event", onEvent);
        this.once("failure", onFailure);
      });
      const found = this.collection.events.find((event) => event.seq >= sequence);
      if (found) return found;
    }
    throw new Error(`Timed out waiting for ledger seq ${sequence}`);
  }

  async close(code = 1000, reason = "test complete"): Promise<void> {
    const socket = this.#socket;
    if (!socket || socket.readyState === WebSocket.CLOSED) return;
    const closed = once(this, "closed").then(() => undefined);
    socket.close(code, reason);
    await closed;
  }

  assertContiguousThrough(lastSeq: number): void {
    if (lastSeq < this.afterSeq) throw new Error(`lastSeq ${lastSeq} predates afterSeq ${this.afterSeq}`);
    const expected = lastSeq - this.afterSeq;
    if (this.collection.events.length !== expected) {
      throw new Error(`Expected ${expected} ledger events through ${lastSeq}, received ${this.collection.events.length}`);
    }
    for (let index = 0; index < this.collection.events.length; index += 1) {
      const expectedSeq = this.afterSeq + index + 1;
      if (this.collection.events[index]?.seq !== expectedSeq) {
        throw new Error(`Ledger replay mismatch at index ${index}: expected ${expectedSeq}, got ${this.collection.events[index]?.seq}`);
      }
    }
  }
}

export async function reconnectWithoutGaps(
  wsUrl: string,
  first: LedgerCollector,
  expectedLastSeq: number,
): Promise<LedgerCollector> {
  const resumeAfter = first.lastSeq;
  await first.close(1000, "intentional disconnect");
  const replay = new LedgerCollector(wsUrl, resumeAfter);
  await replay.connect();
  if (expectedLastSeq > resumeAfter) await replay.waitForSequence(expectedLastSeq);
  replay.assertContiguousThrough(expectedLastSeq);
  return replay;
}
