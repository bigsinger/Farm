export type UnknownRecord = Record<string, unknown>;

export type TaskLane = "active" | "blocked" | "review" | "terminal";
export type WsState = "connecting" | "replaying" | "live" | "disconnected";

export interface AuditProvenance {
  eventId: string | null;
  seq: number | null;
  kind: string | null;
  source: string | null;
  recordedAt: string | null;
  digest: string | null;
}

export interface RepositoryRef {
  id: string | null;
  path: string | null;
  name: string | null;
  defaultBranch: string | null;
  gitless: boolean | null;
}

export interface RunSummary {
  id: string;
  status: string;
  provider: string | null;
  sessionId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string | null;
  costUsd: number | null;
  numTurns: number | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  blockingReasons: string[];
  retryOfRunId: string | null;
  recoveryOfRunId: string | null;
}

export interface Claim {
  id: string;
  taskId: string | null;
  path: string;
  mode: string;
  status: string;
  createdAt: string | null;
  releasedAt: string | null;
  provenance: AuditProvenance;
}

export interface DiffSummary {
  digest: string | null;
  changedPaths: string[];
  changedPathCount: number | null;
  fileCount: number | null;
  additions: number | null;
  deletions: number | null;
  binary: boolean | null;
  large: boolean | null;
  capturedAt: string | null;
}

export interface ArtifactSummary {
  count: number | null;
  latestDigest: string | null;
  latestAt: string | null;
  types: string[];
}

export interface TaskSummary {
  id: string;
  title: string | null;
  prompt: string;
  status: string;
  repoPath: string | null;
  repoName: string | null;
  baseBranch: string | null;
  baseCommit: string | null;
  branchName: string | null;
  worktreePath: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastActivityAt: string | null;
  rowVersion: number | null;
  costUsd: number | null;
  numTurns: number | null;
  durationMs: number | null;
  claims: Claim[];
  claimCount: number | null;
  dependencyIds: string[];
  dependencyCount: number | null;
  dependentIds: string[];
  dependentCount: number | null;
  blockingReasons: string[];
  reviewStatus: string | null;
  reviewStale: boolean | null;
  outcomeStatus: string | null;
  groupId: string | null;
  groupState: string | null;
  run: RunSummary | null;
  diff: DiffSummary | null;
  artifacts: ArtifactSummary | null;
}

export interface TaskLink {
  edgeId: string | null;
  taskId: string;
  title: string | null;
  status: string | null;
  provenance: AuditProvenance;
}

export interface OverlapEvidence {
  id: string;
  type: string;
  severity: string;
  path: string | null;
  leftTaskId: string;
  rightTaskId: string;
  detectedAt: string | null;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
  provenance: AuditProvenance;
  details: UnknownRecord | null;
}

export interface Artifact {
  id: string;
  type: string;
  path: string | null;
  digest: string | null;
  createdAt: string | null;
  sizeBytes: number | null;
  mediaType: string | null;
  changedPaths: string[];
  metadata: UnknownRecord | null;
}

export interface Review {
  id: string;
  decision: string;
  summary: string | null;
  diffDigest: string | null;
  stale: boolean | null;
  createdAt: string | null;
  reviewer: string | null;
  provenance: AuditProvenance;
}

export interface Outcome {
  id: string;
  status: string;
  summary: string | null;
  commit: string | null;
  createdAt: string | null;
  rollbackCommit: string | null;
  provenance: AuditProvenance;
}

export interface TimelineEvent {
  seq: number;
  id: string | null;
  type: string;
  taskId: string | null;
  occurredAt: string | null;
  payload: UnknownRecord | null;
  provenance: AuditProvenance;
}

export interface DependencyGroup {
  id: string;
  state: string;
  taskIds: string[];
  provenance: AuditProvenance;
}

export interface Eligibility {
  canHarvest: boolean;
  reasons: string[];
  evaluatedAt: string | null;
  provenance: AuditProvenance;
}

export interface WorktreeHealth {
  state: string;
  healthy: boolean | null;
  exists: boolean | null;
  dirty: boolean | null;
  blockingReasons: string[];
  checkedAt: string | null;
  provenance: AuditProvenance;
}

export const RESIDUAL_CATEGORIES = [
  "orphan_worktree",
  "orphan_run",
  "dangling_task",
  "double_terminal",
  "review_merge_mismatch",
  "stale_run",
  "cost_event_mismatch",
] as const;

export type ResidualCategory = (typeof RESIDUAL_CATEGORIES)[number];

export interface ResidualIssue {
  id: string | null;
  category: ResidualCategory;
  taskId: string | null;
  runId: string | null;
  repositoryId: string | null;
  worktreePath: string | null;
  severity: string;
  message: string;
  detectedAt: string | null;
  sourceEventSeq: number | null;
  remediation: string | null;
  details: UnknownRecord | null;
  provenance: AuditProvenance;
}

export interface ResidualCategoryReport {
  category: ResidualCategory;
  reportedCount: number | null;
  issues: ResidualIssue[];
}

export interface ResidualHealth {
  schemaVersion: string;
  generatedAt: string;
  artifactId: string | null;
  artifactDigest: string | null;
  benchmarkName: string | null;
  source: string | null;
  ledger: {
    firstSeq: number | null;
    lastSeq: number | null;
    eventCount: number | null;
  };
  scope: { repositoryIds: string[]; taskIds: string[] };
  summary: {
    total: number | null;
    bySeverity: Record<string, number>;
  };
  categories: ResidualCategoryReport[];
  cleanupProof: { checkedPaths: string[]; remainingPaths: string[] } | null;
  providerProof: {
    status: string;
    reason: string | null;
    runIds: string[];
    costUsd: number | null;
  } | null;
  provenance: AuditProvenance;
}

export interface ResidualHealthRef {
  artifactId: string;
  schemaVersion: string;
  total: number | null;
  blocking: number | null;
  residualIds: string[];
}

export interface TaskDetail {
  task: TaskSummary;
  repository: RepositoryRef | null;
  dependencies: TaskLink[];
  dependents: TaskLink[];
  claims: Claim[];
  overlaps: OverlapEvidence[];
  runs: RunSummary[];
  artifacts: Artifact[];
  reviews: Review[];
  outcomes: Outcome[];
  timeline: TimelineEvent[];
  group: DependencyGroup | null;
  eligibility: Eligibility | null;
  worktreeHealth: WorktreeHealth | null;
  residualHealth: ResidualHealthRef | null;
}

export interface TaskSnapshot {
  tasks: TaskSummary[];
  lastSeq: number | null;
  generatedAt: string | null;
  residualHealth: ResidualHealth | null;
}

export interface DiffArtifact {
  kind: "patch" | "empty" | "binary" | "large";
  text: string;
  digest: string | null;
  artifactDigest: string | null;
  changedPaths: string[];
  manifest: Artifact[];
  truncated: boolean;
  mediaType: string | null;
}

export interface CreateTaskInput {
  repoPath: string;
  prompt: string;
  title?: string;
  dependencies: string[];
  claims: Array<{ path: string; mode: string }>;
  magnetPaths: string[];
}

export interface LedgerEvent extends TimelineEvent {}

export interface EventPage {
  events: LedgerEvent[];
  lastSeq: number;
  hasMore: boolean;
  ledgerLastSeq: number;
}

export function ledgerCursorRequiresReset(
  previousLedgerId: string | null,
  currentLedgerId: string,
  cursor: number,
): boolean {
  return previousLedgerId ? previousLedgerId !== currentLedgerId : cursor > 0;
}

export function acceptsLedgerEvents(startingSeq: number, events: LedgerEvent[]): {
  accepted: LedgerEvent[];
  lastSeq: number;
  gapAt: number | null;
} {
  let cursor = startingSeq;
  const accepted: LedgerEvent[] = [];
  for (const event of events) {
    if (event.seq <= startingSeq) continue;
    if (event.seq !== cursor + 1) return { accepted, lastSeq: cursor, gapAt: event.seq };
    accepted.push(event);
    cursor = event.seq;
  }
  return { accepted, lastSeq: cursor, gapAt: null };
}

export type WsEnvelope =
  | {
      kind: "hello";
      serverId: string | null;
      ledgerId: string | null;
      lastSeq: number | null;
      restarted: boolean | null;
    }
  | { kind: "replay"; events: LedgerEvent[]; lastSeq: number | null }
  | { kind: "ready"; lastSeq: number | null }
  | { kind: "live"; event: LedgerEvent };

export class ProtocolError extends Error {
  readonly payload: unknown;

  constructor(message: string, payload: unknown) {
    super(message);
    this.name = "ProtocolError";
    this.payload = payload;
  }
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  readonly requestId: string | null;
  readonly guidance: string;

  constructor(options: {
    code: string;
    message: string;
    status: number;
    details?: unknown;
    requestId?: string | null;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.requestId = options.requestId ?? null;
    this.guidance = guidanceForError(options.code, options.status, options.message);
  }
}

function guidanceForError(code: string, status: number, message: string): string {
  const signal = `${code} ${message}`.toLowerCase();
  if (status === 409 && signal.includes("harvest")) {
    return "另一项 harvest 或仓库写操作正在进行。刷新任务投影，核对目标分支后再试。";
  }
  if (signal.includes("merge") && signal.includes("conflict")) {
    return "worktree 与目标分支存在真实合并冲突。先在任务详情查看冲突路径，解决并生成新的 diff/review。";
  }
  if (signal.includes("provider") && (signal.includes("auth") || signal.includes("credential"))) {
    return "Provider 鉴权阻塞了真实 Agent SDK/E2E 运行。修复服务端 provider 凭据后使用恢复运行；不要把当前状态当作成功。";
  }
  if (signal.includes("worktree") && signal.includes("missing")) {
    return "服务端找不到该 worktree。先运行 residual scan 并确认未被外部清理，再选择恢复或 wilt。";
  }
  if (signal.includes("dirty")) {
    return "worktree 有未归档改动。刷新 diff，确认改动归属并重新 review 后再 harvest。";
  }
  if (signal.includes("stale") && signal.includes("review")) {
    return "已审批 digest 与当前 diff 不一致。刷新 diff 并重新审批。";
  }
  if (signal.includes("auth") || status === 401 || status === 403) {
    return "当前身份无权执行此操作。检查服务端认证与仓库权限后重试。";
  }
  if (status >= 500) {
    return "服务端未完成操作。保留 request id，检查服务日志与真实投影后重试。";
  }
  if (status === 404) {
    return "资源或端点不存在。刷新任务列表；若仍出现，请核对前后端契约版本。";
  }
  if (status === 422 || status === 400) {
    return "按错误详情修正字段或状态前置条件，然后重新提交。";
  }
  return "刷新任务投影，核对阻塞原因后重试；若持续失败，请使用 request id 查询服务日志。";
}

export function errorPresentation(error: unknown): {
  title: string;
  message: string;
  guidance: string;
  requestId: string | null;
  details: unknown;
} {
  if (error instanceof ApiError) {
    return {
      title: `${error.code} · HTTP ${error.status}`,
      message: error.message,
      guidance: error.guidance,
      requestId: error.requestId,
      details: error.details,
    };
  }
  if (error instanceof ProtocolError) {
    return {
      title: "响应契约无效",
      message: error.message,
      guidance: "客户端已停止使用该 payload 并触发重新同步。核对服务端 schema version 与运行日志。",
      requestId: null,
      details: null,
    };
  }
  return {
    title: "请求未完成",
    message: error instanceof Error ? error.message : String(error),
    guidance: "检查服务连接与浏览器网络日志，然后重试。",
    requestId: null,
    details: null,
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(record: UnknownRecord, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function readString(record: UnknownRecord, keys: readonly string[]): string | null {
  return stringValue(pick(record, keys));
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readNumber(record: UnknownRecord, keys: readonly string[]): number | null {
  return numberValue(pick(record, keys));
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

function readBoolean(record: UnknownRecord, keys: readonly string[]): boolean | null {
  return booleanValue(pick(record, keys));
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(stringValue).filter((item): item is string => item !== null)));
}

function readStringArray(record: UnknownRecord, keys: readonly string[]): string[] {
  const value = pick(record, keys);
  if (Array.isArray(value)) {
    const ids = value.map((entry) => {
      if (isRecord(entry)) return readString(entry, ["id", "task_id", "taskId", "path", "name"]);
      return stringValue(entry);
    });
    return Array.from(new Set(ids.filter((item): item is string => item !== null)));
  }
  return [];
}

function recordArray(record: UnknownRecord, keys: readonly string[]): unknown[] {
  const value = pick(record, keys);
  return Array.isArray(value) ? value : [];
}

function timestampValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
  }
  return null;
}

function readTimestamp(record: UnknownRecord, keys: readonly string[]): string | null {
  return timestampValue(pick(record, keys));
}

function normalizedStatus(value: unknown, fallback = "unknown"): string {
  const status = stringValue(value);
  return status ? status.toLowerCase().replace(/[\s-]+/g, "_") : fallback;
}

function unwrapData(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.data !== undefined) return value.data;
  if (value.result !== undefined) return value.result;
  return value;
}

function decodeProvenance(value: unknown, fallback?: UnknownRecord): AuditProvenance {
  const record = isRecord(value) ? value : {};
  const sourceEvent = isRecord(record.source_event) ? record.source_event : {};
  const base = fallback ?? {};
  return {
    eventId:
      readString(record, ["event_id", "eventId", "audit_event_id", "auditEventId"]) ??
      readString(sourceEvent, ["id", "event_id", "eventId"]) ??
      readString(base, ["source_event_id", "audit_event_id"]),
    seq:
      readNumber(record, ["seq", "event_seq", "eventSeq", "source_seq"]) ??
      readNumber(sourceEvent, ["seq"]) ??
      readNumber(base, ["source_event_seq", "event_seq"]),
    kind:
      readString(record, ["kind", "type", "event_type"]) ??
      readString(sourceEvent, ["kind", "type", "event_type"]) ??
      readString(base, ["provenance_kind"]),
    source:
      readString(record, ["source", "producer", "projection", "origin"]) ??
      readString(sourceEvent, ["source", "producer", "type"]) ??
      readString(base, ["provenance_source", "source"]),
    recordedAt:
      readTimestamp(record, ["recorded_at", "recordedAt", "observed_at", "observedAt", "created_at", "createdAt", "occurred_at"]) ??
      readTimestamp(sourceEvent, ["recorded_at", "observed_at", "created_at", "occurred_at", "ts"]) ??
      readTimestamp(base, ["source_event_at", "recorded_at", "observed_at"]),
    digest:
      readString(record, ["digest", "event_digest", "eventDigest"]) ??
      readString(sourceEvent, ["digest"]) ??
      readString(base, ["source_event_digest", "provenance_digest"]),
  };
}

function nestedRecord(record: UnknownRecord, keys: readonly string[]): UnknownRecord | null {
  const value = pick(record, keys);
  return isRecord(value) ? value : null;
}

function decodeRun(value: unknown): RunSummary {
  if (!isRecord(value)) throw new ProtocolError("run 必须是对象", value);
  const id = readString(value, ["id", "run_id", "runId"]);
  if (!id) throw new ProtocolError("run 缺少 id", value);
  const error = nestedRecord(value, ["error", "failure"]);
  return {
    id,
    status: normalizedStatus(pick(value, ["status", "state"])),
    provider: readString(value, ["provider", "provider_name", "agent_provider"]),
    sessionId: readString(value, ["session_id", "sessionId", "agent_session_id"]),
    startedAt: readTimestamp(value, ["started_at", "startedAt"]),
    finishedAt: readTimestamp(value, ["finished_at", "finishedAt", "ended_at"]),
    updatedAt: readTimestamp(value, ["updated_at", "updatedAt", "last_activity_at"]),
    costUsd: readNumber(value, ["cost_usd", "costUsd", "cost"]),
    numTurns: readNumber(value, ["num_turns", "numTurns", "turns"]),
    durationMs: readNumber(value, ["duration_ms", "durationMs", "duration"]),
    errorCode:
      readString(value, ["error_code", "errorCode"]) ??
      (error ? readString(error, ["code", "error_code"]) : null),
    errorMessage:
      readString(value, ["error_message", "errorMessage"]) ??
      (error ? readString(error, ["message", "error"]) : null),
    blockingReasons: readStringArray(value, ["blocking_reasons", "blockingReasons", "reasons"]),
    retryOfRunId: readString(value, ["retry_of_run_id", "retryOfRunId"]),
    recoveryOfRunId: readString(value, ["recovery_of_run_id", "recoveryOfRunId"]),
  };
}

function decodeClaim(value: unknown): Claim {
  if (!isRecord(value)) throw new ProtocolError("claim 必须是对象", value);
  const path = readString(value, ["path", "claim_path", "pattern"]);
  if (!path) throw new ProtocolError("claim 缺少 path", value);
  return {
    id: readString(value, ["id", "claim_id", "claimId"]) ?? `${path}:${readString(value, ["mode"]) ?? "unknown"}`,
    taskId: readString(value, ["task_id", "taskId", "owner_task_id"]),
    path,
    mode: normalizedStatus(pick(value, ["mode", "claim_mode"]), "unknown"),
    status: normalizedStatus(pick(value, ["status", "state"]), "active"),
    createdAt: readTimestamp(value, ["created_at", "createdAt", "claimed_at"]),
    releasedAt: readTimestamp(value, ["released_at", "releasedAt"]),
    provenance: decodeProvenance(pick(value, ["provenance", "source_event"]), value),
  };
}

function decodeDiffSummary(value: unknown): DiffSummary | null {
  if (!isRecord(value)) return null;
  const changedPathsValue = pick(value, ["changed_paths", "changedPaths", "paths"]);
  const changedPaths = readStringArray(value, ["changed_paths", "changedPaths", "paths"]);
  return {
    digest: readString(value, ["digest", "diff_digest", "sha256"]),
    changedPaths,
    changedPathCount: Array.isArray(changedPathsValue) ? changedPaths.length : readNumber(value, ["changed_path_count", "changedPathsCount"]),
    fileCount: readNumber(value, ["file_count", "fileCount", "files_changed"]),
    additions: readNumber(value, ["additions", "lines_added"]),
    deletions: readNumber(value, ["deletions", "lines_deleted"]),
    binary: readBoolean(value, ["binary", "has_binary"]),
    large: readBoolean(value, ["large", "too_large", "truncated"]),
    capturedAt: readTimestamp(value, ["captured_at", "created_at", "generated_at"]),
  };
}

function decodeArtifactSummary(value: unknown): ArtifactSummary | null {
  if (Array.isArray(value)) {
    const records = value.filter(isRecord);
    const digests = records.map((entry) => readString(entry, ["digest", "sha256"])).filter((item): item is string => !!item);
    const timestamps = records.map((entry) => readTimestamp(entry, ["created_at", "generated_at"])).filter((item): item is string => !!item);
    return {
      count: records.length,
      latestDigest: digests.at(-1) ?? null,
      latestAt: timestamps.at(-1) ?? null,
      types: Array.from(new Set(records.map((entry) => readString(entry, ["type", "kind"])).filter((item): item is string => !!item))),
    };
  }
  if (!isRecord(value)) return null;
  return {
    count: readNumber(value, ["count", "artifact_count"]),
    latestDigest: readString(value, ["latest_digest", "digest"]),
    latestAt: readTimestamp(value, ["latest_at", "created_at"]),
    types: readStringArray(value, ["types", "artifact_types"]),
  };
}

export function decodeTaskSummary(value: unknown): TaskSummary {
  if (!isRecord(value)) throw new ProtocolError("task 必须是对象", value);
  const taskRecord = isRecord(value.task) ? { ...value, ...value.task } : value;
  const id = readString(taskRecord, ["id", "task_id", "taskId", "workspace_id"]);
  if (!id) throw new ProtocolError("task 缺少 id", value);
  const repository = nestedRecord(taskRecord, ["repository", "repo"]);
  const group = nestedRecord(taskRecord, ["group", "dependency_group"]);
  const review = nestedRecord(taskRecord, ["review", "latest_review"]);
  const outcome = nestedRecord(taskRecord, ["outcome", "latest_outcome"]);
  const worktree = nestedRecord(taskRecord, ["worktree", "worktree_health"]);
  const eligibility = nestedRecord(taskRecord, ["eligibility", "harvest_eligibility"]);
  const runs = recordArray(taskRecord, ["runs", "agent_runs"]);
  const activeRunRaw = pick(taskRecord, ["active_run", "latest_run", "run"]);
  let run: RunSummary | null = null;
  if (isRecord(activeRunRaw)) run = decodeRun(activeRunRaw);
  else if (runs.length > 0) run = decodeRun(runs[runs.length - 1]);
  const claimsValue = pick(taskRecord, ["claims", "path_claims"]);
  const dependencyValue = pick(taskRecord, ["dependency_ids", "dependencies", "depends_on"]);
  const dependentValue = pick(taskRecord, ["dependent_ids", "dependents"]);
  const claimsRaw = Array.isArray(claimsValue) ? claimsValue : [];
  const dependencies = readStringArray(taskRecord, ["dependency_ids", "dependencies", "depends_on"]);
  const dependents = readStringArray(taskRecord, ["dependent_ids", "dependents"]);
  const blockers = [
    ...readStringArray(taskRecord, ["blocking_reasons", "blockers", "reasons"]),
    ...(worktree ? readStringArray(worktree, ["blocking_reasons", "reasons"]) : []),
    ...(eligibility ? readStringArray(eligibility, ["reasons", "blocking_reasons"]) : []),
  ];
  return {
    id,
    title: readString(taskRecord, ["title", "name"]),
    prompt: readString(taskRecord, ["prompt", "instruction", "description"]) ?? "",
    status: normalizedStatus(pick(taskRecord, ["status", "state"])),
    repoPath:
      readString(taskRecord, ["repo_path", "repoPath", "repository_path"]) ??
      (repository ? readString(repository, ["path", "repo_path"]) : null),
    repoName:
      readString(taskRecord, ["repo_name", "repository_name"]) ??
      (repository ? readString(repository, ["name", "slug"]) : null),
    baseBranch: readString(taskRecord, ["base_branch", "baseBranch"]),
    baseCommit: readString(taskRecord, ["base_commit", "baseCommit"]),
    branchName: readString(taskRecord, ["branch_name", "branchName", "branch"]),
    worktreePath:
      readString(taskRecord, ["worktree_path", "worktreePath"]) ??
      (worktree ? readString(worktree, ["path", "worktree_path"]) : null),
    createdAt: readTimestamp(taskRecord, ["created_at", "createdAt"]),
    updatedAt: readTimestamp(taskRecord, ["updated_at", "updatedAt"]),
    lastActivityAt: readTimestamp(taskRecord, ["last_activity_at", "lastActivityAt", "updated_at"]),
    rowVersion: readNumber(taskRecord, ["row_version", "rowVersion"]),
    costUsd: readNumber(taskRecord, ["cost_usd", "costUsd", "cost"]),
    numTurns: readNumber(taskRecord, ["num_turns", "numTurns", "turns"]),
    durationMs: readNumber(taskRecord, ["duration_ms", "durationMs", "duration"]),
    claims: claimsRaw.map(decodeClaim),
    claimCount: readNumber(taskRecord, ["claim_count", "claims_count"]) ?? (Array.isArray(claimsValue) ? claimsRaw.length : null),
    dependencyIds: dependencies,
    dependencyCount: readNumber(taskRecord, ["dependency_count", "dependencies_count"]) ?? (Array.isArray(dependencyValue) ? dependencies.length : null),
    dependentIds: dependents,
    dependentCount: readNumber(taskRecord, ["dependent_count", "dependents_count"]) ?? (Array.isArray(dependentValue) ? dependents.length : null),
    blockingReasons: Array.from(new Set(blockers)),
    reviewStatus:
      readString(taskRecord, ["review_status", "reviewStatus"]) ??
      (review ? readString(review, ["decision", "status", "state"]) : null),
    reviewStale:
      readBoolean(taskRecord, ["review_stale", "reviewStale"]) ??
      (review ? readBoolean(review, ["stale", "is_stale"]) : null),
    outcomeStatus:
      readString(taskRecord, ["outcome_status", "outcomeStatus"]) ??
      (outcome ? readString(outcome, ["status", "state"]) : null),
    groupId:
      readString(taskRecord, ["group_id", "dependency_group_id"]) ??
      (group ? readString(group, ["id", "group_id"]) : null),
    groupState:
      readString(taskRecord, ["group_state", "dependency_group_state"]) ??
      (group ? readString(group, ["state", "status"]) : null),
    run,
    diff: decodeDiffSummary(pick(taskRecord, ["diff", "diff_summary", "latest_diff"])),
    artifacts: decodeArtifactSummary(pick(taskRecord, ["artifact_summary", "artifacts"])),
  };
}

function decodeTaskLink(value: unknown): TaskLink {
  if (typeof value === "string" || typeof value === "number") {
    return {
      edgeId: null,
      taskId: String(value),
      title: null,
      status: null,
      provenance: decodeProvenance(null),
    };
  }
  if (!isRecord(value)) throw new ProtocolError("dependency edge 必须是对象或 task id", value);
  const taskRecord = isRecord(value.task) ? value.task : value;
  const taskId =
    readString(value, ["task_id", "taskId", "dependency_id", "dependent_id", "id"]) ??
    readString(taskRecord, ["id", "task_id"]);
  if (!taskId) throw new ProtocolError("dependency edge 缺少 task id", value);
  return {
    edgeId: readString(value, ["edge_id", "edgeId", "relation_id"]),
    taskId,
    title: readString(taskRecord, ["title", "name"]),
    status: readString(taskRecord, ["status", "state"]),
    provenance: decodeProvenance(pick(value, ["provenance", "source_event"]), value),
  };
}

function decodeOverlap(value: unknown): OverlapEvidence {
  if (!isRecord(value)) throw new ProtocolError("overlap evidence 必须是对象", value);
  const taskIds = readStringArray(value, ["task_ids", "tasks", "parties"]);
  const leftTaskId = readString(value, ["left_task_id", "task_a_id", "source_task_id"]) ?? taskIds[0];
  const rightTaskId = readString(value, ["right_task_id", "task_b_id", "target_task_id"]) ?? taskIds[1];
  if (!leftTaskId || !rightTaskId) throw new ProtocolError("overlap evidence 缺少双方 task id", value);
  const details = nestedRecord(value, ["details", "evidence", "metadata"]);
  return {
    id: readString(value, ["id", "overlap_id", "evidence_id"]) ?? `${leftTaskId}:${rightTaskId}:${readString(value, ["path"]) ?? "overlap"}`,
    type: normalizedStatus(pick(value, ["evidence_type", "type", "kind"]), "unknown"),
    severity: normalizedStatus(pick(value, ["severity", "level"]), "unknown"),
    path: readString(value, ["path", "file_path", "magnet_path", "claim_path"]),
    leftTaskId,
    rightTaskId,
    detectedAt: readTimestamp(value, ["detected_at", "created_at", "occurred_at"]),
    status: normalizedStatus(pick(value, ["status", "state"]), "open"),
    resolution: readString(value, ["resolution", "resolution_note", "resolved_as"]),
    resolvedAt: readTimestamp(value, ["resolved_at", "resolution_at"]),
    provenance: decodeProvenance(pick(value, ["provenance", "source_event"]), value),
    details,
  };
}

function decodeArtifact(value: unknown): Artifact {
  if (!isRecord(value)) throw new ProtocolError("artifact 必须是对象", value);
  return {
    id: readString(value, ["id", "artifact_id"]) ?? readString(value, ["digest", "path"]) ?? "unidentified-artifact",
    type: normalizedStatus(pick(value, ["type", "kind", "artifact_type"]), "unknown"),
    path: readString(value, ["path", "uri", "file_path"]),
    digest: readString(value, ["digest", "sha256", "content_digest"]),
    createdAt: readTimestamp(value, ["created_at", "generated_at", "captured_at"]),
    sizeBytes: readNumber(value, ["size_bytes", "size", "bytes"]),
    mediaType: readString(value, ["media_type", "content_type", "mime_type"]),
    changedPaths: readStringArray(value, ["changed_paths", "paths"]),
    metadata: nestedRecord(value, ["metadata", "manifest", "details"]),
  };
}

function decodeReview(value: unknown): Review {
  if (!isRecord(value)) throw new ProtocolError("review 必须是对象", value);
  return {
    id: readString(value, ["id", "review_id"]) ?? readString(value, ["event_id"]) ?? "unidentified-review",
    decision: normalizedStatus(pick(value, ["decision", "status", "state"])),
    summary: readString(value, ["summary", "note", "message"]),
    diffDigest: readString(value, ["diff_digest", "digest", "reviewed_digest"]),
    stale: readBoolean(value, ["stale", "is_stale", "review_stale"]),
    createdAt: readTimestamp(value, ["created_at", "reviewed_at", "occurred_at"]),
    reviewer: readString(value, ["reviewer", "reviewer_id", "actor"]),
    provenance: decodeProvenance(pick(value, ["provenance", "source_event"]), value),
  };
}

function decodeOutcome(value: unknown): Outcome {
  if (!isRecord(value)) throw new ProtocolError("outcome 必须是对象", value);
  return {
    id: readString(value, ["id", "outcome_id"]) ?? readString(value, ["event_id"]) ?? "unidentified-outcome",
    status: normalizedStatus(pick(value, ["status", "state", "type"])),
    summary: readString(value, ["summary", "message", "reason"]),
    commit: readString(value, ["commit", "commit_sha", "merge_commit"]),
    createdAt: readTimestamp(value, ["created_at", "occurred_at", "finished_at"]),
    rollbackCommit: readString(value, ["rollback_commit", "rollback_commit_sha"]),
    provenance: decodeProvenance(pick(value, ["provenance", "source_event"]), value),
  };
}

export function decodeLedgerEvent(value: unknown): LedgerEvent {
  const unwrapped = isRecord(value) && isRecord(value.event) ? value.event : value;
  if (!isRecord(unwrapped)) throw new ProtocolError("ledger event 必须是对象", value);
  const seq = readNumber(unwrapped, ["seq", "sequence", "event_seq"]);
  const type = readString(unwrapped, ["type", "event_type", "kind"]);
  if (seq === null || !Number.isInteger(seq) || seq < 0) throw new ProtocolError("ledger event 缺少有效全局 seq", value);
  if (!type) throw new ProtocolError("ledger event 缺少 type", value);
  const rawPayload = pick(unwrapped, ["payload", "data", "details"]);
  return {
    seq,
    id: readString(unwrapped, ["id", "event_id", "eventId"]),
    type: normalizedStatus(type),
    taskId: readString(unwrapped, ["task_id", "taskId", "workspace_id", "entity_id"]),
    occurredAt: readTimestamp(unwrapped, ["occurred_at", "created_at", "timestamp", "ts"]),
    payload: isRecord(rawPayload) ? rawPayload : null,
    provenance: decodeProvenance(pick(unwrapped, ["provenance", "source_event"]), unwrapped),
  };
}

function decodeGroup(value: unknown): DependencyGroup | null {
  if (!isRecord(value)) return null;
  const id = readString(value, ["id", "group_id"]);
  if (!id) throw new ProtocolError("dependency group 缺少 id", value);
  return {
    id,
    state: normalizedStatus(pick(value, ["state", "status"])),
    taskIds: readStringArray(value, ["task_ids", "tasks"]),
    provenance: decodeProvenance(pick(value, ["provenance", "source_event"]), value),
  };
}

function decodeEligibility(value: unknown): Eligibility | null {
  if (!isRecord(value)) return null;
  const canHarvest = readBoolean(value, ["can_harvest", "canHarvest", "eligible"]);
  if (canHarvest === null) throw new ProtocolError("eligibility 缺少 can_harvest", value);
  return {
    canHarvest,
    reasons: readStringArray(value, ["reasons", "blocking_reasons"]),
    evaluatedAt: readTimestamp(value, ["evaluated_at", "checked_at", "generated_at"]),
    provenance: decodeProvenance(pick(value, ["provenance", "source_event"]), value),
  };
}

function decodeWorktreeHealth(value: unknown): WorktreeHealth | null {
  if (!isRecord(value)) return null;
  return {
    state: normalizedStatus(pick(value, ["state", "status"])),
    healthy: readBoolean(value, ["healthy", "ok"]),
    exists: readBoolean(value, ["exists", "worktree_exists"]),
    dirty: readBoolean(value, ["dirty", "is_dirty"]),
    blockingReasons: readStringArray(value, ["blocking_reasons", "reasons", "issues"]),
    checkedAt: readTimestamp(value, ["checked_at", "generated_at", "updated_at"]),
    provenance: decodeProvenance(pick(value, ["provenance", "source_event"]), value),
  };
}

function residualCategory(value: unknown): ResidualCategory | null {
  const normalized = normalizedStatus(value, "");
  const aliases: Record<string, ResidualCategory> = {
    orphan_worktrees: "orphan_worktree",
    orphan_worktree: "orphan_worktree",
    orphan_runs: "orphan_run",
    orphan_run: "orphan_run",
    dangling_tasks: "dangling_task",
    dangling_task: "dangling_task",
    double_terminals: "double_terminal",
    double_terminal: "double_terminal",
    review_merge_mismatches: "review_merge_mismatch",
    review_merge_mismatch: "review_merge_mismatch",
    stale_runs: "stale_run",
    stale_run: "stale_run",
    cost_event_mismatches: "cost_event_mismatch",
    cost_event_mismatch: "cost_event_mismatch",
  };
  return aliases[normalized] ?? null;
}

function decodeResidualIssue(value: unknown, forcedCategory?: ResidualCategory): ResidualIssue {
  if (!isRecord(value)) throw new ProtocolError("residual issue 必须是对象", value);
  const category = forcedCategory ?? residualCategory(pick(value, ["category", "type", "kind"]));
  if (!category) throw new ProtocolError("residual issue 的 category 不受支持", value);
  return {
    id: readString(value, ["id", "issue_id"]),
    category,
    taskId: readString(value, ["task_id", "taskId"]),
    runId: readString(value, ["run_id", "runId"]),
    repositoryId: readString(value, ["repository_id", "repositoryId", "repo_id"]),
    worktreePath: readString(value, ["worktree_path", "path"]),
    severity: normalizedStatus(pick(value, ["severity", "level"]), "unknown"),
    message: readString(value, ["message", "summary", "reason"]) ?? category,
    detectedAt: readTimestamp(value, ["detected_at", "created_at", "generated_at"]),
    sourceEventSeq: readNumber(value, ["source_event_seq", "event_seq"]),
    remediation: readString(value, ["remediation", "recommended_action"]),
    details: nestedRecord(value, ["evidence", "details", "metadata"]),
    provenance: decodeProvenance(pick(value, ["provenance", "source_event"]), value),
  };
}

export function decodeResidualHealth(value: unknown): ResidualHealth {
  let payload = unwrapData(value);
  if (isRecord(payload) && isRecord(payload.artifact)) payload = payload.artifact;
  if (!isRecord(payload)) throw new ProtocolError("residual health artifact 必须是对象", value);
  const report = nestedRecord(payload, ["report", "payload", "benchmark", "result"]) ?? payload;
  const schemaVersion =
    readString(report, ["schema_version", "schemaVersion"]) ??
    readString(payload, ["schema_version", "schemaVersion"]);
  const generatedAt =
    readTimestamp(report, ["generated_at", "generatedAt", "scanned_at"]) ??
    readTimestamp(payload, ["generated_at", "created_at"]);
  if (!schemaVersion || !generatedAt) {
    throw new ProtocolError("residual health artifact 缺少 schema_version 或 generated_at", value);
  }

  if (schemaVersion !== "agent-farm.residual-benchmark.v1") {
    throw new ProtocolError(`不支持 residual benchmark schema: ${schemaVersion}`, value);
  }

  const artifactId = readString(payload, ["artifact_id", "id"]);
  const artifactDigest = readString(payload, ["sha256", "digest", "artifact_digest"]);
  const summary = nestedRecord(report, ["summary"]);
  const byType = summary ? nestedRecord(summary, ["by_type", "byType"]) : null;
  const bySeverityRaw = summary ? nestedRecord(summary, ["by_severity", "bySeverity"]) : null;
  const total = summary ? readNumber(summary, ["total"]) : null;
  const ledger = nestedRecord(report, ["ledger"]);
  const scope = nestedRecord(report, ["scope"]);
  const cleanup = nestedRecord(report, ["cleanup_proof", "cleanupProof"]);
  const provider = nestedRecord(report, ["provider_proof", "providerProof"]);
  const rawResiduals = pick(report, ["residuals"]);
  const firstSeq = ledger ? readNumber(ledger, ["first_seq", "firstSeq"]) : null;
  const lastSeq = ledger ? readNumber(ledger, ["last_seq", "lastSeq"]) : null;
  const eventCount = ledger ? readNumber(ledger, ["event_count", "eventCount"]) : null;
  const repositoryIdsValue = scope ? pick(scope, ["repository_ids", "repositoryIds"]) : null;
  const taskIdsValue = scope ? pick(scope, ["task_ids", "taskIds"]) : null;
  const checkedPathsValue = cleanup ? pick(cleanup, ["checked_paths", "checkedPaths"]) : null;
  const remainingPathsValue = cleanup ? pick(cleanup, ["remaining_paths", "remainingPaths"]) : null;
  const providerStatus = provider ? normalizedStatus(pick(provider, ["status", "state"]), "") : "";

  if (
    !artifactId ||
    !artifactDigest ||
    !summary ||
    !byType ||
    !bySeverityRaw ||
    !ledger ||
    !scope ||
    !cleanup ||
    !provider ||
    !Array.isArray(rawResiduals) ||
    !Array.isArray(repositoryIdsValue) ||
    !Array.isArray(taskIdsValue) ||
    !Array.isArray(checkedPathsValue) ||
    !Array.isArray(remainingPathsValue)
  ) {
    throw new ProtocolError("residual benchmark v1 缺少 artifact/ledger/scope/summary/residuals/cleanup_proof/provider_proof 必填字段", value);
  }
  if (
    total === null || !Number.isInteger(total) || total < 0 ||
    firstSeq === null || !Number.isInteger(firstSeq) || firstSeq < 0 ||
    lastSeq === null || !Number.isInteger(lastSeq) || lastSeq < firstSeq ||
    eventCount === null || !Number.isInteger(eventCount) || eventCount < 0
  ) {
    throw new ProtocolError("residual benchmark v1 的 total 或 ledger 数字无效", value);
  }
  if (!["verified", "blocked", "not_run"].includes(providerStatus)) {
    throw new ProtocolError("residual benchmark v1 provider_proof.status 无效", value);
  }
  const providerReason = readString(provider, ["reason", "message"]);
  const providerRunIds = readStringArray(provider, ["run_ids", "runIds"]);
  const providerCost = readNumber(provider, ["cost_usd", "costUsd"]);
  const bySeverity: Record<string, number> = {};
  for (const [key, raw] of Object.entries(bySeverityRaw)) {
    const count = numberValue(raw);
    if (count === null || !Number.isInteger(count) || count < 0) {
      throw new ProtocolError(`residual benchmark v1 by_severity.${key} 无效`, value);
    }
    bySeverity[normalizedStatus(key)] = count;
  }

  const flatIssues = rawResiduals.map((entry) => decodeResidualIssue(entry));
  for (const issue of flatIssues) {
    if (
      !issue.id ||
      !["info", "warning", "blocking"].includes(issue.severity) ||
      !issue.detectedAt ||
      !issue.remediation ||
      !issue.details ||
      !issue.provenance.kind ||
      !issue.provenance.source ||
      !issue.provenance.recordedAt
    ) {
      throw new ProtocolError("residual benchmark v1 residual 缺少 id/severity/detected_at/provenance/evidence/remediation", value);
    }
  }

  const categories = RESIDUAL_CATEGORIES.map((category) => {
    const issues = flatIssues.filter((issue) => issue.category === category);
    const reportedCount = numberValue(pick(byType, [category]));
    if (reportedCount === null || !Number.isInteger(reportedCount) || reportedCount < 0) {
      throw new ProtocolError(`residual benchmark v1 summary.by_type.${category} 缺失或无效`, value);
    }
    if (reportedCount !== issues.length) {
      throw new ProtocolError(`residual benchmark v1 ${category} count 与 residuals 不一致`, value);
    }
    return { category, reportedCount, issues };
  });
  const typeTotal = categories.reduce((sum, category) => sum + (category.reportedCount ?? 0), 0);
  const severityTotal = Object.values(bySeverity).reduce((sum, count) => sum + count, 0);
  if (flatIssues.length !== total || typeTotal !== total || severityTotal !== total) {
    throw new ProtocolError("residual benchmark v1 summary total、by_type、by_severity 与 residuals 不一致", value);
  }

  return {
    schemaVersion,
    generatedAt,
    artifactId,
    artifactDigest,
    benchmarkName:
      readString(report, ["benchmark_name", "name"]) ??
      readString(payload, ["benchmark_name", "name", "type"]),
    source: readString(payload, ["source", "producer", "uri", "path"]),
    ledger: { firstSeq, lastSeq, eventCount },
    scope: {
      repositoryIds: readStringArray(scope, ["repository_ids", "repositoryIds"]),
      taskIds: readStringArray(scope, ["task_ids", "taskIds"]),
    },
    summary: { total, bySeverity },
    categories,
    cleanupProof: {
      checkedPaths: readStringArray(cleanup, ["checked_paths", "checkedPaths"]),
      remainingPaths: readStringArray(cleanup, ["remaining_paths", "remainingPaths"]),
    },
    providerProof: {
      status: providerStatus,
      reason: providerReason,
      runIds: providerRunIds,
      costUsd: providerCost,
    },
    provenance: decodeProvenance(pick(payload, ["provenance", "source_event"]), payload),
  };
}

function decodeResidualHealthRef(value: unknown): ResidualHealthRef | null {
  if (!isRecord(value)) return null;
  const artifactId = readString(value, ["artifact_id", "artifactId", "id"]);
  const schemaVersion = readString(value, ["schema_version", "schemaVersion"]);
  if (!artifactId || !schemaVersion) throw new ProtocolError("task residual_health 缺少 artifact_id 或 schema_version", value);
  return {
    artifactId,
    schemaVersion,
    total: readNumber(value, ["total"]),
    blocking: readNumber(value, ["blocking", "blocking_count"]),
    residualIds: readStringArray(value, ["residual_ids", "residualIds"]),
  };
}

function decodeRepository(value: unknown): RepositoryRef | null {
  if (!isRecord(value)) return null;
  return {
    id: readString(value, ["id", "repository_id", "repo_id"]),
    path: readString(value, ["path", "repo_path", "repository_path"]),
    name: readString(value, ["name", "slug", "repo_name"]),
    defaultBranch: readString(value, ["default_branch", "base_branch"]),
    gitless: readBoolean(value, ["gitless", "is_gitless"]),
  };
}

function findResidualCandidate(record: UnknownRecord): unknown {
  return pick(record, ["residual_health", "residualHealth", "benchmark_artifact", "benchmarkArtifact", "residual_benchmark"]);
}

function decodeOptionalResidualArtifact(value: unknown): ResidualHealth | null {
  if (value === undefined || value === null) return null;
  const payload = unwrapData(value);
  const candidate = isRecord(payload) && isRecord(payload.artifact) ? payload.artifact : payload;
  if (!isRecord(candidate)) return null;
  const report = nestedRecord(candidate, ["report", "payload", "benchmark", "result"]) ?? candidate;
  const looksLikeArtifact =
    pick(report, ["generated_at", "generatedAt", "scanned_at"]) !== undefined &&
    (isRecord(pick(report, ["summary"])) || Array.isArray(pick(report, ["residuals"])));
  if (!looksLikeArtifact) return null;
  return decodeResidualHealth(value);
}

export function decodeTaskDetail(value: unknown): TaskDetail {
  const payload = unwrapData(value);
  if (!isRecord(payload)) throw new ProtocolError("task detail 必须是对象", value);
  const requiredArrays: Array<{ label: string; keys: string[] }> = [
    { label: "dependencies", keys: ["dependencies", "depends_on"] },
    { label: "dependents", keys: ["dependents"] },
    { label: "claims", keys: ["claims", "path_claims"] },
    { label: "overlaps", keys: ["overlaps", "overlap_evidence", "conflicts"] },
    { label: "runs", keys: ["runs", "agent_runs"] },
    { label: "artifacts", keys: ["artifacts", "artifact_manifest"] },
    { label: "reviews", keys: ["reviews"] },
    { label: "outcomes", keys: ["outcomes"] },
    { label: "timeline", keys: ["timeline", "events", "activity"] },
  ];
  for (const section of requiredArrays) {
    if (!Array.isArray(pick(payload, section.keys))) {
      throw new ProtocolError(`task detail 缺少 ${section.label} 数组`, value);
    }
  }
  const groupValue = pick(payload, ["group", "dependency_group"]);
  const eligibilityValue = pick(payload, ["eligibility", "harvest_eligibility"]);
  const worktreeHealthValue = pick(payload, ["worktree_health", "worktreeHealth", "worktree"]);
  if (!("group" in payload || "dependency_group" in payload) || (groupValue !== undefined && !isRecord(groupValue))) {
    throw new ProtocolError("task detail group 必须是对象或显式 null", value);
  }
  if (!("eligibility" in payload || "harvest_eligibility" in payload) || (eligibilityValue !== undefined && !isRecord(eligibilityValue))) {
    throw new ProtocolError("task detail eligibility 必须是对象或显式 null", value);
  }
  if (!("worktree_health" in payload || "worktreeHealth" in payload || "worktree" in payload) || (worktreeHealthValue !== undefined && !isRecord(worktreeHealthValue))) {
    throw new ProtocolError("task detail worktree health 必须是对象或显式 null", value);
  }
  const taskValue = payload.task ?? payload;
  const task = decodeTaskSummary(taskValue);
  const timelineRaw = recordArray(payload, ["timeline", "events", "activity"]);
  const detail: TaskDetail = {
    task,
    repository: decodeRepository(pick(payload, ["repository", "repo"])),
    dependencies: recordArray(payload, ["dependencies", "depends_on"]).map(decodeTaskLink),
    dependents: recordArray(payload, ["dependents"]).map(decodeTaskLink),
    claims: recordArray(payload, ["claims", "path_claims"]).map(decodeClaim),
    overlaps: recordArray(payload, ["overlaps", "overlap_evidence", "conflicts"]).map(decodeOverlap),
    runs: recordArray(payload, ["runs", "agent_runs"]).map(decodeRun),
    artifacts: recordArray(payload, ["artifacts", "artifact_manifest"]).map(decodeArtifact),
    reviews: recordArray(payload, ["reviews"]).map(decodeReview),
    outcomes: recordArray(payload, ["outcomes"]).map(decodeOutcome),
    timeline: timelineRaw.map(decodeLedgerEvent).sort((a, b) => a.seq - b.seq),
    group: decodeGroup(pick(payload, ["group", "dependency_group"])),
    eligibility: decodeEligibility(pick(payload, ["eligibility", "harvest_eligibility"])),
    worktreeHealth: decodeWorktreeHealth(pick(payload, ["worktree_health", "worktreeHealth", "worktree"])),
    residualHealth: decodeResidualHealthRef(findResidualCandidate(payload)),
  };
  return detail;
}

export function classifyTask(task: TaskSummary): TaskLane {
  const status = normalizedStatus(task.status);
  const review = normalizedStatus(task.reviewStatus, "");
  const terminalSignals = ["harvested", "wilted", "cancelled", "canceled", "failed", "completed", "merged", "rolled_back", "cleaned"];
  const blockedSignals = ["blocked", "conflict", "crashed", "timeout", "timed_out", "auth_blocked", "provider_auth_blocked", "missing", "dirty"];
  if (terminalSignals.some((signal) => status.includes(signal))) return "terminal";
  if (task.blockingReasons.length > 0 || blockedSignals.some((signal) => status.includes(signal))) return "blocked";
  if (status.includes("review") || status.includes("ripe") || review === "pending" || review === "approved" || review === "rejected") return "review";
  return "active";
}

interface RawResponse {
  body: unknown;
  response: Response;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try {
      return JSON.parse(text);
    } catch {
      throw new ProtocolError(`HTTP ${response.status} 返回了无效 JSON`, text.slice(0, 500));
    }
  }
  return text;
}

function decodeError(response: Response, body: unknown): ApiError {
  const envelope = isRecord(body) && isRecord(body.error) ? body.error : isRecord(body) ? body : null;
  const code = envelope ? readString(envelope, ["code", "error_code"]) : null;
  const message = envelope ? readString(envelope, ["message", "error", "detail"]) : null;
  const requestId =
    (envelope ? readString(envelope, ["request_id", "requestId"]) : null) ??
    response.headers.get("x-request-id");
  const details = envelope ? pick(envelope, ["details", "errors", "context"]) : body;
  return new ApiError({
    code: code ?? `http_${response.status}`,
    message: message ?? (typeof body === "string" && body.trim() ? body.trim() : response.statusText || "请求失败"),
    status: response.status,
    details,
    requestId,
  });
}

async function requestRaw(path: string, init: RequestInit = {}): Promise<RawResponse> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        accept: "application/json, text/plain;q=0.9",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError({
      code: "network_error",
      message: error instanceof Error ? error.message : "无法连接服务",
      status: 0,
      details: null,
    });
  }
  const body = await parseBody(response);
  if (!response.ok) throw decodeError(response, body);
  return { body, response };
}

async function requestFallback(paths: string[], init: RequestInit): Promise<RawResponse> {
  let lastError: unknown;
  for (let index = 0; index < paths.length; index += 1) {
    try {
      return await requestRaw(paths[index], init);
    } catch (error) {
      lastError = error;
      const canFallback = error instanceof ApiError && (error.status === 404 || error.status === 405) && index < paths.length - 1;
      if (!canFallback) throw error;
    }
  }
  throw lastError;
}

function encodeId(value: string): string {
  return encodeURIComponent(value);
}

export async function listTasks(signal?: AbortSignal): Promise<TaskSnapshot> {
  const { body } = await requestRaw("/api/tasks", { signal });
  const payload = unwrapData(body);
  let tasksRaw: unknown;
  let metadata: UnknownRecord | null = null;
  if (Array.isArray(payload)) tasksRaw = payload;
  else if (isRecord(payload)) {
    metadata = payload;
    tasksRaw = pick(payload, ["tasks", "items", "rows"]);
  }
  if (!Array.isArray(tasksRaw)) throw new ProtocolError("GET /api/tasks 缺少 tasks 数组", body);
  const tasks = tasksRaw.map(decodeTaskSummary);
  return {
    tasks,
    lastSeq: metadata ? readNumber(metadata, ["last_seq", "lastSeq", "seq"]) : null,
    generatedAt: metadata ? readTimestamp(metadata, ["generated_at", "snapshot_at", "updated_at"]) : null,
    residualHealth: metadata ? decodeOptionalResidualArtifact(findResidualCandidate(metadata)) : null,
  };
}

export async function getTask(id: string, signal?: AbortSignal): Promise<TaskDetail> {
  const { body } = await requestRaw(`/api/tasks/${encodeId(id)}`, { signal });
  return decodeTaskDetail(body);
}

export async function createTask(input: CreateTaskInput): Promise<TaskDetail | TaskSummary> {
  const body = {
    repo_path: input.repoPath,
    prompt: input.prompt,
    ...(input.title?.trim() ? { title: input.title.trim() } : {}),
    dependencies: input.dependencies,
    claims: input.claims.map((claim) => ({ path: claim.path, mode: claim.mode })),
    magnet_paths: input.magnetPaths,
  };
  const response = await requestRaw("/api/tasks", { method: "POST", body: JSON.stringify(body) });
  const payload = unwrapData(response.body);
  if (isRecord(payload) && (payload.dependencies !== undefined || payload.timeline !== undefined || payload.eligibility !== undefined)) {
    return decodeTaskDetail(payload);
  }
  return decodeTaskSummary(isRecord(payload) && payload.task !== undefined ? payload.task : payload);
}

export async function addDependency(id: string, dependencyId: string): Promise<void> {
  await requestFallback(
    [`/api/tasks/${encodeId(id)}/dependencies`, `/api/tasks/${encodeId(id)}/dependencies/${encodeId(dependencyId)}`],
    { method: "POST", body: JSON.stringify({ dependency_id: dependencyId }) },
  );
}

export async function removeDependency(id: string, dependencyId: string): Promise<void> {
  await requestFallback(
    [`/api/tasks/${encodeId(id)}/dependencies/${encodeId(dependencyId)}`, `/api/tasks/${encodeId(id)}/dependencies`],
    { method: "DELETE", body: JSON.stringify({ dependency_id: dependencyId }) },
  );
}

export async function addClaim(id: string, path: string, mode: string): Promise<void> {
  await requestRaw(`/api/tasks/${encodeId(id)}/claims`, {
    method: "POST",
    body: JSON.stringify({ path, mode }),
  });
}

export async function releaseClaim(id: string, claimId: string): Promise<void> {
  await requestFallback(
    [`/api/tasks/${encodeId(id)}/claims/${encodeId(claimId)}/release`, `/api/tasks/${encodeId(id)}/claims/${encodeId(claimId)}`],
    { method: "POST", body: "{}" },
  );
}

export async function startRun(id: string): Promise<void> {
  await requestFallback(
    [`/api/tasks/${encodeId(id)}/runs`, `/api/tasks/${encodeId(id)}/runs/start`],
    { method: "POST", body: "{}" },
  );
}

export async function recoverRun(id: string, runId?: string | null): Promise<void> {
  const paths = runId
    ? [`/api/tasks/${encodeId(id)}/runs/${encodeId(runId)}/recover`, `/api/tasks/${encodeId(id)}/runs/recover`]
    : [`/api/tasks/${encodeId(id)}/runs/recover`];
  await requestFallback(paths, { method: "POST", body: JSON.stringify(runId ? { run_id: runId } : {}) });
}

export async function cancelRun(id: string, runId?: string | null): Promise<void> {
  const paths = runId
    ? [`/api/tasks/${encodeId(id)}/runs/${encodeId(runId)}/cancel`, `/api/tasks/${encodeId(id)}/runs/cancel`]
    : [`/api/tasks/${encodeId(id)}/runs/cancel`];
  await requestFallback(paths, { method: "POST", body: JSON.stringify(runId ? { run_id: runId } : {}) });
}

export async function submitReview(
  id: string,
  decision: "approved" | "rejected",
  summary: string,
  diffDigest: string | null,
): Promise<void> {
  const body = JSON.stringify({
    decision,
    ...(summary.trim() ? { summary: summary.trim() } : {}),
    ...(diffDigest ? { diff_digest: diffDigest } : {}),
  });
  await requestFallback(
    [`/api/tasks/${encodeId(id)}/reviews`, `/api/tasks/${encodeId(id)}/reviews/${decision}`],
    { method: "POST", body },
  );
}

export async function harvestTask(id: string, diffDigest: string | null): Promise<void> {
  await requestRaw(`/api/tasks/${encodeId(id)}/harvest`, {
    method: "POST",
    body: JSON.stringify(diffDigest ? { diff_digest: diffDigest } : {}),
  });
}

export async function wiltTask(id: string, reason: string): Promise<void> {
  const body = JSON.stringify(reason.trim() ? { reason: reason.trim() } : {});
  try {
    await requestRaw(`/api/tasks/${encodeId(id)}`, { method: "DELETE", body });
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) throw error;
    await requestRaw(`/api/tasks/${encodeId(id)}/wilt`, { method: "DELETE", body });
  }
}

export async function resolveOverlap(id: string, overlapId: string, resolution: string): Promise<void> {
  await requestRaw(`/api/tasks/${encodeId(id)}/overlaps/${encodeId(overlapId)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ resolution: resolution.trim() }),
  });
}

function headerBoolean(headers: Headers, names: string[]): boolean | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value !== null) return booleanValue(value);
  }
  return null;
}

function headerPaths(headers: Headers): string[] {
  const value = headers.get("x-changed-paths") ?? headers.get("x-diff-paths");
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return stringArray(parsed);
  } catch {
    // A comma-delimited header is also supported.
  }
  return Array.from(new Set(value.split(",").map((part) => part.trim()).filter(Boolean)));
}

export async function getTaskDiff(id: string, signal?: AbortSignal): Promise<DiffArtifact> {
  const { body, response } = await requestRaw(`/api/tasks/${encodeId(id)}/diff`, {
    signal,
    headers: { accept: "application/json, text/plain, text/x-diff" },
  });
  const headers = response.headers;
  const contentType = headers.get("content-type");
  let text = typeof body === "string" ? body : "";
  let digest = headers.get("x-diff-digest") ?? headers.get("digest") ?? headers.get("etag")?.replace(/^W\//, "").replaceAll('"', "") ?? null;
  let artifactDigest = headers.get("x-artifact-digest");
  let changedPaths = headerPaths(headers);
  let manifest: Artifact[] = [];
  let binary = headerBoolean(headers, ["x-diff-binary", "x-binary"]);
  let large = headerBoolean(headers, ["x-diff-large", "x-too-large"]);
  let truncated = headerBoolean(headers, ["x-diff-truncated", "x-truncated"]) ?? false;

  if (isRecord(body)) {
    text = readString(body, ["patch", "diff", "text", "content"]) ?? "";
    digest = readString(body, ["digest", "diff_digest", "sha256"]) ?? digest;
    artifactDigest = readString(body, ["artifact_digest", "manifest_digest"]) ?? artifactDigest;
    changedPaths = readStringArray(body, ["changed_paths", "paths"]);
    const manifestRaw = recordArray(body, ["manifest", "artifacts"]);
    manifest = manifestRaw.map(decodeArtifact);
    binary = readBoolean(body, ["binary", "is_binary"]) ?? binary;
    large = readBoolean(body, ["large", "too_large"]) ?? large;
    truncated = readBoolean(body, ["truncated"]) ?? truncated;
  }

  const explicitKind = isRecord(body) ? normalizedStatus(pick(body, ["kind", "state"]), "") : "";
  const kind: DiffArtifact["kind"] =
    binary === true || explicitKind === "binary"
      ? "binary"
      : large === true || truncated || explicitKind === "large"
        ? "large"
        : text.trim()
          ? "patch"
          : "empty";
  return { kind, text, digest, artifactDigest, changedPaths, manifest, truncated, mediaType: contentType };
}

export async function getEventPage(afterSeq: number, signal?: AbortSignal): Promise<EventPage> {
  if (!Number.isSafeInteger(afterSeq) || afterSeq < 0) {
    throw new ProtocolError("GET /api/events after_seq 必须是非负安全整数", afterSeq);
  }
  const { body } = await requestRaw(`/api/events?after_seq=${encodeURIComponent(String(afterSeq))}`, { signal });
  const payload = unwrapData(body);
  if (!isRecord(payload)) throw new ProtocolError("GET /api/events 必须返回分页对象", body);
  const rawEvents = pick(payload, ["events", "items", "replay"]);
  if (!Array.isArray(rawEvents)) throw new ProtocolError("GET /api/events 缺少 events 数组", body);
  const events = rawEvents.map(decodeLedgerEvent);
  const lastSeq = readNumber(payload, ["last_seq", "lastSeq"]);
  const hasMore = readBoolean(payload, ["has_more", "hasMore"]);
  const ledgerLastSeq = readNumber(payload, ["ledger_last_seq", "ledgerLastSeq"]);
  if (
    lastSeq === null || !Number.isSafeInteger(lastSeq) || lastSeq < afterSeq ||
    hasMore === null ||
    ledgerLastSeq === null || !Number.isSafeInteger(ledgerLastSeq) || ledgerLastSeq < lastSeq
  ) {
    throw new ProtocolError("GET /api/events 分页 metadata 无效", body);
  }
  let expectedSeq = afterSeq + 1;
  for (const event of events) {
    if (event.seq !== expectedSeq) {
      throw new ProtocolError(`GET /api/events seq gap 或乱序：期望 ${expectedSeq}，收到 ${event.seq}`, body);
    }
    expectedSeq += 1;
  }
  const eventLastSeq = events.at(-1)?.seq ?? afterSeq;
  if (lastSeq !== eventLastSeq) {
    throw new ProtocolError(`GET /api/events last_seq ${lastSeq} 与页内末 event ${eventLastSeq} 不一致`, body);
  }
  if (hasMore !== (lastSeq < ledgerLastSeq)) {
    throw new ProtocolError("GET /api/events has_more 与 ledger_last_seq 不一致", body);
  }
  return { events, lastSeq, hasMore, ledgerLastSeq };
}

export async function getEvents(afterSeq: number, signal?: AbortSignal): Promise<LedgerEvent[]> {
  const events: LedgerEvent[] = [];
  let cursor = afterSeq;
  let ledgerLastSeq: number | null = null;
  do {
    const page = await getEventPage(cursor, signal);
    if (ledgerLastSeq !== null && page.ledgerLastSeq < ledgerLastSeq) {
      throw new ProtocolError("GET /api/events ledger_last_seq 在分页期间倒退", page);
    }
    ledgerLastSeq = page.ledgerLastSeq;
    for (const event of page.events) {
      if (event.seq !== cursor + 1) {
        throw new ProtocolError(`GET /api/events seq gap：期望 ${cursor + 1}，收到 ${event.seq}`, page);
      }
      events.push(event);
      cursor = event.seq;
    }
    if (cursor !== page.lastSeq) throw new ProtocolError("GET /api/events cursor 未到达 page last_seq", page);
    if (!page.hasMore) return events;
    if (page.events.length === 0) throw new ProtocolError("GET /api/events has_more=true 但分页为空", page);
  } while (true);
}

export async function getResidualHealth(signal?: AbortSignal): Promise<ResidualHealth | null> {
  try {
    const { body } = await requestRaw("/api/benchmarks/residual/latest", { signal });
    return decodeResidualHealth(body);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function runResidualReconciliation(): Promise<ResidualHealth> {
  const { body } = await requestRaw("/api/benchmarks/residual", {
    method: "POST",
    body: "{}",
  });
  return decodeResidualHealth(body);
}

export function decodeWsEnvelope(value: unknown): WsEnvelope {
  if (!isRecord(value)) throw new ProtocolError("WebSocket envelope 必须是对象", value);
  const rawKind = normalizedStatus(pick(value, ["type", "kind", "envelope_type"]), "");
  if (rawKind === "hello") {
    return {
      kind: "hello",
      serverId: readString(value, ["server_id", "serverId", "instance_id", "instanceId"]),
      ledgerId: readString(value, ["ledger_id", "ledgerId", "stream_id"]),
      lastSeq: readNumber(value, ["last_seq", "lastSeq", "seq"]),
      restarted: readBoolean(value, ["restarted", "server_restarted"]),
    };
  }
  if (rawKind === "replay") {
    const eventsValue = pick(value, ["events", "replay", "items"]);
    const events = Array.isArray(eventsValue)
      ? eventsValue.map(decodeLedgerEvent)
      : value.event !== undefined
        ? [decodeLedgerEvent(value.event)]
        : [];
    return { kind: "replay", events, lastSeq: readNumber(value, ["last_seq", "lastSeq"]) };
  }
  if (rawKind === "ready") {
    return { kind: "ready", lastSeq: readNumber(value, ["last_seq", "lastSeq", "seq"]) };
  }
  if (rawKind === "live") {
    return { kind: "live", event: decodeLedgerEvent(value.event ?? value.data) };
  }
  if (rawKind === "event" || (readNumber(value, ["seq"]) !== null && readString(value, ["event_type"]) !== null)) {
    return { kind: "live", event: decodeLedgerEvent(value.event ?? value) };
  }
  throw new ProtocolError(`未知 WebSocket envelope: ${rawKind || "(missing type)"}`, value);
}

export function makeWebSocketUrl(afterSeq: number): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL(`${protocol}//${window.location.host}/ws`);
  url.searchParams.set("after_seq", String(afterSeq));
  return url.toString();
}
