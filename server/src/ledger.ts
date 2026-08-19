import crypto from "node:crypto";
import { db, parseJson, stringifyJson } from "./db.js";
import { publishLedgerEvent } from "./ws.js";
import { redactSensitiveText } from "./redaction.js";

export interface AuditProvenance {
  kind: string;
  source: string;
  digest?: string | null;
}

export interface AuditEventInput {
  eventType: string;
  entityType: string;
  entityId: string;
  repositoryId?: string | null;
  taskId?: string | null;
  runId?: string | null;
  actor?: string;
  payload?: unknown;
  provenance?: AuditProvenance;
  occurredAt?: number;
}

export interface AuditEventRow {
  seq: number;
  event_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  repository_id: string | null;
  task_id: string | null;
  run_id: string | null;
  actor: string;
  payload_json: string;
  provenance_kind: string;
  provenance_source: string;
  provenance_digest: string | null;
  occurred_at: number;
}

export interface AuditEventView {
  seq: number;
  id: string;
  type: string;
  entity_type: string;
  entity_id: string;
  repository_id: string | null;
  task_id: string | null;
  run_id: string | null;
  actor: string;
  occurred_at: number;
  payload: unknown;
  provenance: {
    kind: string;
    source: string;
    digest: string | null;
    seq: number;
  };
}

export interface EventCollector {
  rows: AuditEventRow[];
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value ?? null));
}

export function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const insertStatement = db.prepare(`
  INSERT INTO audit_events (
    event_id, event_type, entity_type, entity_id, repository_id, task_id,
    run_id, actor, payload_json, provenance_kind, provenance_source,
    provenance_digest, occurred_at
  ) VALUES (
    @event_id, @event_type, @entity_type, @entity_id, @repository_id, @task_id,
    @run_id, @actor, @payload_json, @provenance_kind, @provenance_source,
    @provenance_digest, @occurred_at
  )
`);
const eventBySeqStatement = db.prepare("SELECT * FROM audit_events WHERE seq = ?");

export function recordAuditEvent(collector: EventCollector, input: AuditEventInput): AuditEventRow {
  const payloadJson = canonicalJson(input.payload ?? {});
  const provenance = input.provenance ?? {
    kind: "agent-farm",
    source: "server",
  };
  const result = insertStatement.run({
    event_id: crypto.randomUUID(),
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    repository_id: input.repositoryId ?? null,
    task_id: input.taskId ?? null,
    run_id: input.runId ?? null,
    actor: input.actor ?? "system",
    payload_json: payloadJson,
    provenance_kind: provenance.kind,
    provenance_source: provenance.source,
    provenance_digest: provenance.digest ?? sha256(payloadJson),
    occurred_at: input.occurredAt ?? Date.now(),
  });
  const row = eventBySeqStatement.get(Number(result.lastInsertRowid)) as AuditEventRow | undefined;
  if (!row) throw new Error("audit event insert did not return a row");
  collector.rows.push(row);
  return row;
}

export function committedMutation<T>(mutate: (collector: EventCollector) => T): T {
  const collector: EventCollector = { rows: [] };
  const value = db.transaction(() => mutate(collector))();
  for (const row of collector.rows) publishLedgerEvent(row);
  return value;
}

export function appendAuditEvent(input: AuditEventInput): AuditEventRow {
  return committedMutation((collector) => recordAuditEvent(collector, input));
}

export function toAuditEventView(row: AuditEventRow): AuditEventView {
  return {
    seq: row.seq,
    id: row.event_id,
    type: row.event_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    repository_id: row.repository_id,
    task_id: row.task_id,
    run_id: row.run_id,
    actor: row.actor,
    occurred_at: row.occurred_at,
    payload: parseJson(row.payload_json, null),
    provenance: {
      kind: row.provenance_kind,
      source: row.provenance_source,
      digest: row.provenance_digest,
      seq: row.seq,
    },
  };
}

export function eventsAfter(afterSeq: number, limit = 1_000): AuditEventView[] {
  const rows = db.prepare(`
    SELECT * FROM audit_events
    WHERE seq > ?
    ORDER BY seq ASC
    LIMIT ?
  `).all(afterSeq, limit) as AuditEventRow[];
  return rows.map(toAuditEventView);
}

export function lastEventSeq(): number {
  const row = db.prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM audit_events").get() as { seq: number };
  return row.seq;
}

export function taskTimeline(taskId: string): AuditEventView[] {
  return (db.prepare(`
    SELECT * FROM audit_events
    WHERE task_id = ?
    ORDER BY seq ASC
  `).all(taskId) as AuditEventRow[]).map(toAuditEventView);
}

function sensitiveAuditKey(key: string, value: unknown): boolean {
  const normalized = key.toLowerCase();
  if (normalized.endsWith("_tokens") && typeof value === "number" && Number.isFinite(value)) return false;
  return (
    normalized.includes("token") ||
    /api[_-]?key|authorization|cookie|secret|password|passwd|private[_-]?key|client[_-]?secret|credential/i.test(normalized)
  );
}

export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[max-depth]";
  if (Array.isArray(value)) return value.slice(0, 500).map((entry) => sanitizeForAudit(entry, depth + 1));
  if (!value || typeof value !== "object") {
    if (typeof value === "string") {
      const truncated = value.length > 100_000 ? `${value.slice(0, 100_000)}…[truncated]` : value;
      return redactSensitiveText(truncated);
    }
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (sensitiveAuditKey(key, child)) {
      output[key] = "[redacted]";
    } else {
      output[key] = sanitizeForAudit(child, depth + 1);
    }
  }
  return output;
}

const AUDIT_PAYLOAD_MAX_BYTES = 64 * 1024;

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finiteOrNullCost(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return finiteNumber(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function usageAuditPayload(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const output: Record<string, number> = {};
  for (const key of [
    "input_tokens",
    "output_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
    "server_tool_use",
  ]) {
    const numeric = finiteNumber(record[key]);
    if (numeric !== null) output[key] = numeric;
  }
  // Nested server_tool_use objects are ignored; only flat numeric usage is retained.
  for (const [key, child] of Object.entries(record)) {
    if (key in output) continue;
    if (!/_tokens$|_requests$|_cost_usd$|^costUSD$/i.test(key)) continue;
    const numeric = finiteNumber(child);
    if (numeric !== null) output[key] = numeric;
  }
  return Object.keys(output).length > 0 ? output : null;
}

function modelUsageAuditPayload(value: unknown): Record<string, Record<string, number | string>> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const output: Record<string, Record<string, number | string>> = {};
  for (const [model, usage] of Object.entries(value as Record<string, unknown>)) {
    if (!usage || typeof usage !== "object" || Array.isArray(usage)) continue;
    const record = usage as Record<string, unknown>;
    const entry: Record<string, number | string> = {};
    for (const [key, child] of Object.entries(record)) {
      if (typeof child === "number" && Number.isFinite(child)) entry[key] = child;
      else if ((key === "canonicalModel" || key === "provider") && typeof child === "string") entry[key] = child;
    }
    if (Object.keys(entry).length > 0) output[model] = entry;
  }
  return Object.keys(output).length > 0 ? output : null;
}

function permissionDenialAuditPayload(value: unknown): Array<Record<string, string>> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map((entry) => {
    if (!entry || typeof entry !== "object") return { tool_name: "unknown" };
    const record = entry as Record<string, unknown>;
    return {
      tool_name: stringOrNull(record.tool_name) ?? "unknown",
      tool_use_id: stringOrNull(record.tool_use_id) ?? "",
    };
  }).map((entry) => {
    if (!entry.tool_use_id) {
      const { tool_use_id: _ignored, ...rest } = entry;
      return rest;
    }
    return entry;
  });
}

function contentBlockSummaries(value: unknown): Array<Record<string, string | number | null>> {
  if (!value || typeof value !== "object") return [];
  const message = (value as { message?: unknown }).message;
  const content = message && typeof message === "object"
    ? (message as { content?: unknown }).content
    : undefined;
  if (!Array.isArray(content)) return [];
  return content.slice(0, 50).map((block) => {
    const summary: Record<string, string | number | null> = {
      type: "unknown",
    };
    if (!block || typeof block !== "object") return summary;
    const record = block as Record<string, unknown>;
    const type = stringOrNull(record.type) ?? "unknown";
    summary.type = type;
    if (type === "tool_use") {
      summary.id = stringOrNull(record.id);
      summary.name = stringOrNull(record.name);
      return summary;
    }
    if (type === "tool_result") {
      summary.tool_use_id = stringOrNull(record.tool_use_id);
      summary.is_error = record.is_error === true ? 1 : 0;
      return summary;
    }
    return summary;
  });
}

/**
 * Structured allowlist for Agent SDK messages persisted to the append-only ledger.
 * Keeps cost/usage/status metadata and drops prompt, tool input/output, and command text.
 */
export function sdkAuditPayload(message: unknown): Record<string, unknown> {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return { type: "unknown", dropped: true };
  }
  const record = message as Record<string, unknown>;
  const type = stringOrNull(record.type) ?? "unknown";
  const base: Record<string, unknown> = {
    type,
    subtype: stringOrNull(record.subtype),
    session_id: stringOrNull(record.session_id),
    uuid: stringOrNull(record.uuid),
    parent_tool_use_id: stringOrNull(record.parent_tool_use_id),
  };

  if (type === "result") {
    Object.assign(base, {
      is_error: record.is_error === true,
      duration_ms: finiteNumber(record.duration_ms),
      duration_api_ms: finiteNumber(record.duration_api_ms),
      num_turns: finiteNumber(record.num_turns),
      total_cost_usd: finiteOrNullCost(record.total_cost_usd),
      stop_reason: stringOrNull(record.stop_reason),
      api_error_status: finiteNumber(record.api_error_status),
      usage: usageAuditPayload(record.usage),
      modelUsage: modelUsageAuditPayload(record.modelUsage),
      permission_denials: permissionDenialAuditPayload(record.permission_denials),
      error_count: Array.isArray(record.errors) ? record.errors.length : 0,
      has_result_text: typeof record.result === "string" && record.result.length > 0,
    });
  } else if (type === "assistant" || type === "user") {
    Object.assign(base, {
      error: stringOrNull(record.error),
      content_blocks: contentBlockSummaries(record),
      has_tool_use_result: record.tool_use_result !== undefined,
    });
  } else if (type === "system") {
    Object.assign(base, {
      tool_name: stringOrNull(record.tool_name),
      tool_use_id: stringOrNull(record.tool_use_id),
      decision_reason_type: stringOrNull(record.decision_reason_type),
      status: stringOrNull(record.status),
    });
  } else if (type === "stream_event") {
    const event = record.event && typeof record.event === "object"
      ? (record.event as Record<string, unknown>)
      : null;
    Object.assign(base, {
      stream_event_type: event ? stringOrNull(event.type) : null,
    });
  } else {
    base.dropped_fields = true;
  }

  const encoded = Buffer.byteLength(JSON.stringify(base), "utf8");
  if (encoded > AUDIT_PAYLOAD_MAX_BYTES) {
    return {
      type,
      subtype: base.subtype ?? null,
      session_id: base.session_id ?? null,
      truncated: true,
      original_bytes: encoded,
    };
  }
  return base;
}

export { stringifyJson };
