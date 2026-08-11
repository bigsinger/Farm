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

export { stringifyJson };
