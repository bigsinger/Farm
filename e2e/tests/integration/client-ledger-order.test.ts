import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptsLedgerEvents,
  decodeTaskSummary,
  getEventPage,
  ProtocolError,
  type LedgerEvent,
  wiltTask,
} from "../../../web-app/src/api.js";

function event(seq: number): LedgerEvent {
  return {
    seq,
    id: `event-${seq}`,
    type: "test.event",
    taskId: null,
    occurredAt: null,
    payload: null,
    provenance: {
      eventId: `event-${seq}`,
      seq,
      kind: "test",
      source: "client-ledger-order",
      recordedAt: null,
      digest: null,
    },
  };
}

test("client ledger acceptance preserves wire order and rejects new duplicates", () => {
  assert.deepEqual(acceptsLedgerEvents(5, [event(4), event(5), event(6), event(7)]), {
    accepted: [event(6), event(7)],
    lastSeq: 7,
    gapAt: null,
  });
  assert.deepEqual(acceptsLedgerEvents(5, [event(7), event(6)]), {
    accepted: [],
    lastSeq: 5,
    gapAt: 7,
  });
  assert.deepEqual(acceptsLedgerEvents(5, [event(6), event(6), event(7)]), {
    accepted: [event(6)],
    lastSeq: 6,
    gapAt: 6,
  });
});

test("task decoder preserves the server row version", () => {
  const task = decodeTaskSummary({
    id: "task-row-version",
    title: "Row version",
    prompt: "Preserve the projection version.",
    status: "seeded",
    row_version: 7,
  });
  assert.equal(task.rowVersion, 7);
});

test("wilt fallback uses the declared DELETE route", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    requests.push({ url, method });
    if (requests.length === 1) {
      return new Response(JSON.stringify({ error: { code: "not_found", message: "missing", request_id: "request-1" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(null, { status: 204 });
  };
  try {
    await wiltTask("task / fallback", "operator cleanup");
    assert.deepEqual(requests, [
      { url: "/api/tasks/task%20%2F%20fallback", method: "DELETE" },
      { url: "/api/tasks/task%20%2F%20fallback/wilt", method: "DELETE" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("REST event page rejects an out-of-order wire response instead of sorting it", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    events: [
      { seq: 2, id: "event-2", type: "test.event" },
      { seq: 1, id: "event-1", type: "test.event" },
    ],
    last_seq: 1,
    has_more: true,
    ledger_last_seq: 2,
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  try {
    await assert.rejects(() => getEventPage(0), (error: unknown) => {
      assert.ok(error instanceof ProtocolError);
      assert.match(error.message, /seq gap|乱序/);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
