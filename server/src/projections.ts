import crypto from "node:crypto";
import path from "node:path";
import { db, parseJson } from "./db.js";

export interface TaskRow {
  id: string;
  repository_id: string;
  title: string;
  prompt: string;
  status: string;
  base_branch: string | null;
  base_commit: string | null;
  branch_name: string | null;
  worktree_path: string | null;
  magnet_paths_json: string;
  blocking_reasons_json: string;
  auto_start: number;
  review_status: string | null;
  outcome_status: string | null;
  current_run_id: string | null;
  current_diff_digest: string | null;
  approved_diff_digest: string | null;
  pre_harvest_commit: string | null;
  harvest_commit: string | null;
  total_cost_usd: number | null;
  num_turns: number | null;
  duration_ms: number | null;
  provider_status: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  row_version: number;
  created_event_seq: number | null;
}

export interface RepositoryRow {
  id: string;
  root_path: string;
  git_dir: string | null;
  is_git: number;
  default_branch: string | null;
  head_commit: string | null;
  created_at: number;
  updated_at: number;
  row_version: number;
  last_error: string | null;
  created_event_seq: number | null;
  last_event_seq: number | null;
}

export interface AgentRunRow {
  id: string;
  task_id: string;
  attempt: number;
  status: string;
  provider_status: string;
  provider: string | null;
  retry_of_run_id: string | null;
  recovery_of_run_id: string | null;
  sdk_session_id: string | null;
  sdk_result_subtype: string | null;
  started_at: number | null;
  heartbeat_at: number | null;
  ended_at: number | null;
  cost_usd: number | null;
  num_turns: number | null;
  duration_ms: number | null;
  usage_json: string | null;
  model_usage_json: string | null;
  permission_denials_json: string | null;
  error_code: string | null;
  error_message: string | null;
  timeout_ms: number | null;
  max_budget_usd: number | null;
  created_at: number;
  source_event_seq: number;
  terminal_event_seq: number | null;
}

export interface ClaimRow {
  id: string;
  task_id: string;
  repository_id: string;
  path: string;
  normalized_path: string;
  mode: string;
  status: string;
  claimed_at: number;
  released_at: number | null;
  source_event_seq: number;
  release_event_seq: number | null;
}

export interface OverlapRow {
  id: string;
  repository_id: string;
  left_task_id: string;
  right_task_id: string;
  path: string;
  evidence_type: string;
  blocking: number;
  status: string;
  details_json: string;
  detected_at: number;
  resolved_at: number | null;
  resolution: string | null;
  source_event_seq: number;
  resolution_event_seq: number | null;
}

export interface ArtifactRow {
  id: string;
  task_id: string;
  run_id: string | null;
  kind: string;
  path: string;
  media_type: string;
  size_bytes: number;
  sha256: string;
  metadata_json: string;
  created_at: number;
  source_event_seq: number;
}

export interface ReviewRow {
  id: string;
  task_id: string;
  decision: string;
  diff_digest: string;
  summary: string | null;
  reviewer: string | null;
  created_at: number;
  source_event_seq: number;
}

export interface OutcomeRow {
  id: string;
  task_id: string;
  type: string;
  status: string;
  operation_id: string | null;
  commit_sha: string | null;
  diff_digest: string | null;
  reason: string | null;
  created_at: number;
  source_event_seq: number;
}

export interface DependencyRow {
  task_id: string;
  depends_on_task_id: string;
  created_at: number;
  source_event_seq: number;
}

export interface ProjectionProvenance {
  event_id: string;
  seq: number;
  kind: string;
  source: string;
  recorded_at: number;
  digest: string | null;
}

export interface RepositoryObservation {
  checkedAt: number;
  rootPath: string;
  gitDir: string | null;
  isGit: boolean;
  branch: string | null;
  headCommit: string | null;
  clean: boolean;
  error: string | null;
}

export interface RunProjection {
  id: string;
  task_id: string;
  attempt: number;
  status: string;
  provider_status: string;
  provider: string | null;
  session_id: string | null;
  result_subtype: string | null;
  created_at: number;
  started_at: number | null;
  heartbeat_at: number | null;
  finished_at: number | null;
  updated_at: number;
  cost_usd: number | null;
  num_turns: number | null;
  duration_ms: number | null;
  usage: unknown;
  model_usage: unknown;
  permission_denials: unknown[];
  error_code: string | null;
  error_message: string | null;
  blocking_reasons: string[];
  retry_of_run_id: string | null;
  recovery_of_run_id: string | null;
  timeout_ms: number | null;
  max_budget_usd: number | null;
  provenance: ProjectionProvenance | null;
  terminal_provenance: ProjectionProvenance | null;
}

export interface DependencyGroupProjection {
  id: string;
  state: "blocked" | "active" | "review" | "terminal";
  task_ids: string[];
  provenance: ProjectionProvenance;
}

export interface TaskSummaryProjection {
  id: string;
  repository_id: string;
  title: string;
  prompt: string;
  status: string;
  repo_path: string | null;
  repo_name: string | null;
  base_branch: string | null;
  base_commit: string | null;
  branch_name: string | null;
  worktree_path: string | null;
  created_at: number;
  updated_at: number;
  last_activity_at: number;
  cost_usd: number | null;
  num_turns: number | null;
  duration_ms: number | null;
  claims: ReturnType<typeof claimProjection>[];
  claim_count: number;
  dependency_ids: string[];
  dependent_ids: string[];
  blocking_reasons: string[];
  review_status: string | null;
  review_stale: boolean | null;
  outcome_status: string | null;
  row_version: number;
  group_id: string | null;
  group_state: DependencyGroupProjection["state"] | null;
  run: RunProjection | null;
  diff: ReturnType<typeof diffProjection>;
  artifact_summary: ReturnType<typeof artifactSummary>;
}

interface AuditEventProjectionRow {
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

interface MaxTimestampRow {
  value: number | null;
}

const taskByIdStatement = db.prepare("SELECT * FROM tasks WHERE id = ?");
const repositoryByIdStatement = db.prepare("SELECT * FROM repositories WHERE id = ?");
const latestRunStatement = db.prepare(`
  SELECT * FROM agent_runs
  WHERE task_id = ?
  ORDER BY attempt DESC, created_at DESC, id DESC
  LIMIT 1
`);
const provenanceBySeqStatement = db.prepare(`
  SELECT event_id, seq, provenance_kind AS kind, provenance_source AS source,
    occurred_at AS recorded_at, provenance_digest AS digest
  FROM audit_events
  WHERE seq = ?
`);

function uniqueStrings(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function jsonStringArray(value: string | null | undefined): string[] {
  const parsed = parseJson<unknown>(value, []);
  if (!Array.isArray(parsed)) return [];
  return uniqueStrings(parsed.filter((entry): entry is string => typeof entry === "string"));
}

function jsonObject(value: string): Record<string, unknown> {
  const parsed = parseJson<unknown>(value, {});
  return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

function metadataValue(metadata: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (metadata[key] !== undefined && metadata[key] !== null) return metadata[key];
  }
  return null;
}

function metadataNumber(metadata: Record<string, unknown>, keys: readonly string[]): number | null {
  const value = metadataValue(metadata, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function metadataBoolean(metadata: Record<string, unknown>, keys: readonly string[]): boolean | null {
  const value = metadataValue(metadata, keys);
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

function metadataStrings(metadata: Record<string, unknown>, keys: readonly string[]): string[] {
  const value = metadataValue(metadata, keys);
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.filter((entry): entry is string => typeof entry === "string"));
}

function provenanceFromAuditRow(row: AuditEventProjectionRow): ProjectionProvenance {
  return {
    event_id: row.event_id,
    seq: row.seq,
    kind: row.provenance_kind,
    source: row.provenance_source,
    recorded_at: row.occurred_at,
    digest: row.provenance_digest,
  };
}

export function getTaskRow(id: string): TaskRow | null {
  return (taskByIdStatement.get(id) as TaskRow | undefined) ?? null;
}

export function getRepositoryRow(id: string): RepositoryRow | null {
  return (repositoryByIdStatement.get(id) as RepositoryRow | undefined) ?? null;
}

export function latestRun(taskId: string): AgentRunRow | null {
  return (latestRunStatement.get(taskId) as AgentRunRow | undefined) ?? null;
}

export function provenanceForSeq(seq: number | null | undefined): ProjectionProvenance | null {
  if (seq === null || seq === undefined) return null;
  return (provenanceBySeqStatement.get(seq) as ProjectionProvenance | undefined) ?? null;
}

export function getTaskArtifacts(taskId: string): ArtifactRow[] {
  return db.prepare(`
    SELECT * FROM artifacts
    WHERE task_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(taskId) as ArtifactRow[];
}

export function getPatchArtifact(taskId: string, diffDigest?: string | null): ArtifactRow | null {
  if (diffDigest) {
    return (db.prepare(`
      SELECT * FROM artifacts
      WHERE task_id = ? AND kind = 'patch'
        AND json_extract(metadata_json, '$.diff_digest') = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(taskId, diffDigest) as ArtifactRow | undefined) ?? null;
  }
  return (db.prepare(`
    SELECT * FROM artifacts
    WHERE task_id = ? AND kind = 'patch'
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(taskId) as ArtifactRow | undefined) ?? null;
}

export function getLatestPatchArtifact(taskId: string): ArtifactRow | null {
  return getPatchArtifact(taskId);
}

function permissionDenialReasons(value: string | null): string[] {
  const parsed = parseJson<unknown>(value, []);
  if (!Array.isArray(parsed)) return [];
  const reasons: string[] = [];
  for (const entry of parsed) {
    if (typeof entry === "string") {
      reasons.push(entry);
      continue;
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const reason = [record.reason, record.message, record.permission, record.tool_name, record.toolName]
      .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
    if (reason) reasons.push(reason);
  }
  return uniqueStrings(reasons);
}

function runBlockingReasons(row: AgentRunRow): string[] {
  const reasons = permissionDenialReasons(row.permission_denials_json);
  const failed = ["failed", "timed_out", "provider_blocked", "sandbox_blocked", "crashed"].includes(row.status);
  if ((failed || row.provider_status === "blocked" || row.provider_status === "failed") && row.error_code) {
    reasons.push(row.error_code);
  } else if (row.provider_status === "blocked") {
    reasons.push("provider_status:blocked");
  }
  return uniqueStrings(reasons);
}

function runProjection(row: AgentRunRow): RunProjection {
  const activity = [row.created_at, row.started_at, row.heartbeat_at, row.ended_at]
    .filter((value): value is number => value !== null);
  return {
    id: row.id,
    task_id: row.task_id,
    attempt: row.attempt,
    status: row.status,
    provider_status: row.provider_status,
    provider: row.provider,
    session_id: row.sdk_session_id,
    result_subtype: row.sdk_result_subtype,
    created_at: row.created_at,
    started_at: row.started_at,
    heartbeat_at: row.heartbeat_at,
    finished_at: row.ended_at,
    updated_at: Math.max(...activity),
    cost_usd: row.cost_usd,
    num_turns: row.num_turns,
    duration_ms: row.duration_ms,
    usage: parseJson<unknown>(row.usage_json, null),
    model_usage: parseJson<unknown>(row.model_usage_json, null),
    permission_denials: parseJson<unknown[]>(row.permission_denials_json, []),
    error_code: row.error_code,
    error_message: row.error_message,
    blocking_reasons: runBlockingReasons(row),
    retry_of_run_id: row.retry_of_run_id,
    recovery_of_run_id: row.recovery_of_run_id,
    timeout_ms: row.timeout_ms,
    max_budget_usd: row.max_budget_usd,
    provenance: provenanceForSeq(row.source_event_seq),
    terminal_provenance: provenanceForSeq(row.terminal_event_seq),
  };
}

function claimsForTask(taskId: string): ClaimRow[] {
  return db.prepare(`
    SELECT * FROM path_claims
    WHERE task_id = ?
    ORDER BY claimed_at ASC, id ASC
  `).all(taskId) as ClaimRow[];
}

function claimProjection(row: ClaimRow) {
  return {
    id: row.id,
    task_id: row.task_id,
    repository_id: row.repository_id,
    path: row.path,
    normalized_path: row.normalized_path,
    mode: row.mode,
    status: row.status,
    created_at: row.claimed_at,
    claimed_at: row.claimed_at,
    released_at: row.released_at,
    provenance: provenanceForSeq(row.source_event_seq),
    release_provenance: provenanceForSeq(row.release_event_seq),
  };
}

function dependencyRows(taskId: string): DependencyRow[] {
  return db.prepare(`
    SELECT * FROM task_dependencies
    WHERE task_id = ?
    ORDER BY created_at ASC, depends_on_task_id ASC
  `).all(taskId) as DependencyRow[];
}

function dependentRows(taskId: string): DependencyRow[] {
  return db.prepare(`
    SELECT * FROM task_dependencies
    WHERE depends_on_task_id = ?
    ORDER BY created_at ASC, task_id ASC
  `).all(taskId) as DependencyRow[];
}

function taskLinks(taskId: string, direction: "dependencies" | "dependents") {
  const rows = direction === "dependencies" ? dependencyRows(taskId) : dependentRows(taskId);
  return rows.map((edge) => {
    const linkedTaskId = direction === "dependencies" ? edge.depends_on_task_id : edge.task_id;
    const linkedTask = getTaskRow(linkedTaskId);
    return {
      edge_id: null,
      task_id: linkedTaskId,
      title: linkedTask?.title ?? null,
      status: linkedTask?.status ?? null,
      created_at: edge.created_at,
      source_event_seq: edge.source_event_seq,
      provenance: provenanceForSeq(edge.source_event_seq),
    };
  });
}

function blockingReasons(task: TaskRow): string[] {
  const reasons = jsonStringArray(task.blocking_reasons_json);
  const dependencies = db.prepare(`
    SELECT dependency.depends_on_task_id AS id, dependency_task.status
    FROM task_dependencies dependency
    JOIN tasks dependency_task ON dependency_task.id = dependency.depends_on_task_id
    WHERE dependency.task_id = ? AND dependency_task.status <> 'harvested'
    ORDER BY dependency.depends_on_task_id ASC
  `).all(task.id) as Array<{ id: string; status: string }>;
  for (const dependency of dependencies) {
    reasons.push(`dependency_not_harvested:${dependency.id}:${dependency.status}`);
  }
  const overlaps = db.prepare(`
    SELECT id FROM overlap_evidence
    WHERE status = 'open' AND blocking = 1
      AND (left_task_id = ? OR right_task_id = ?)
    ORDER BY id ASC
  `).all(task.id, task.id) as Array<{ id: string }>;
  for (const overlap of overlaps) reasons.push(`blocking_overlap:${overlap.id}`);
  return uniqueStrings(reasons);
}

function latestManifest(taskId: string): ArtifactRow | null {
  return (db.prepare(`
    SELECT * FROM artifacts
    WHERE task_id = ? AND kind = 'manifest'
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(taskId) as ArtifactRow | undefined) ?? null;
}

function diffProjection(task: TaskRow) {
  if (task.current_diff_digest === null) return null;
  const manifest = latestManifest(task.id);
  const metadata = manifest ? jsonObject(manifest.metadata_json) : {};
  const metadataDigest = metadataValue(metadata, ["diff_digest", "digest"]);
  const metadataMatches = typeof metadataDigest !== "string" || metadataDigest === task.current_diff_digest;
  const currentMetadata = metadataMatches ? metadata : {};
  return {
    digest: task.current_diff_digest,
    changed_paths: metadataStrings(currentMetadata, ["changed_paths", "paths"]),
    file_count: metadataNumber(currentMetadata, ["file_count", "files_changed"]),
    additions: metadataNumber(currentMetadata, ["additions", "lines_added"]),
    deletions: metadataNumber(currentMetadata, ["deletions", "lines_deleted"]),
    binary: metadataBoolean(currentMetadata, ["has_binary", "binary"]),
    large: metadataBoolean(currentMetadata, ["large", "too_large", "truncated"]),
    captured_at: metadataMatches ? manifest?.created_at ?? null : null,
    manifest_artifact_id: metadataMatches ? manifest?.id ?? null : null,
    manifest_digest: metadataMatches ? manifest?.sha256 ?? null : null,
  };
}

function artifactSummary(taskId: string) {
  const rows = db.prepare(`
    SELECT kind, sha256, created_at, id
    FROM artifacts
    WHERE task_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(taskId) as Array<{ kind: string; sha256: string; created_at: number; id: string }>;
  return {
    count: rows.length,
    latest_digest: rows[0]?.sha256 ?? null,
    latest_at: rows[0]?.created_at ?? null,
    types: uniqueStrings(rows.map((row) => row.kind)).sort((left, right) => left.localeCompare(right)),
  };
}

function lastActivityAt(task: TaskRow): number {
  const row = db.prepare(`
    SELECT MAX(occurred_at) AS value
    FROM audit_events
    WHERE task_id = ?
  `).get(task.id) as MaxTimestampRow;
  return row.value === null ? task.updated_at : Math.max(task.updated_at, row.value);
}

function reviewIsStale(task: TaskRow): boolean | null {
  if (task.review_status === "stale") return true;
  if (task.approved_diff_digest !== null && task.approved_diff_digest !== task.current_diff_digest) return true;
  if (task.review_status !== "approved" || task.approved_diff_digest === null) return false;
  // A matching persisted digest only proves what was last captured. Callers that
  // have not refreshed the live worktree must not claim that approval is current.
  return null;
}

function groupState(statuses: string[]): DependencyGroupProjection["state"] {
  if (statuses.some((status) => ["blocked", "failed", "recovery_required"].includes(status))) return "blocked";
  if (statuses.some((status) => ["seeded", "preparing", "running", "harvesting", "wilting"].includes(status))) return "active";
  if (statuses.some((status) => ["review_pending", "review_rejected"].includes(status))) return "review";
  return "terminal";
}

export function dependencyGroup(taskId: string): DependencyGroupProjection | null {
  if (getTaskRow(taskId) === null) return null;
  const visited = new Set<string>([taskId]);
  const pending = [taskId];
  const edges = new Map<string, DependencyRow>();

  while (pending.length > 0) {
    const current = pending.shift()!;
    const incident = db.prepare(`
      SELECT * FROM task_dependencies
      WHERE task_id = ? OR depends_on_task_id = ?
      ORDER BY source_event_seq ASC, task_id ASC, depends_on_task_id ASC
    `).all(current, current) as DependencyRow[];
    for (const edge of incident) {
      const key = `${edge.task_id}\0${edge.depends_on_task_id}`;
      edges.set(key, edge);
      for (const neighbor of [edge.task_id, edge.depends_on_task_id]) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        pending.push(neighbor);
      }
    }
  }

  if (edges.size === 0) return null;
  const taskIds = [...visited].sort((left, right) => left.localeCompare(right));
  const rows = db.prepare(`
    SELECT id, status FROM tasks
    WHERE id IN (SELECT value FROM json_each(?))
  `).all(JSON.stringify(taskIds)) as Array<{ id: string; status: string }>;
  const statusesById = new Map(rows.map((row) => [row.id, row.status]));
  const statuses = taskIds.map((id) => statusesById.get(id)).filter((status): status is string => status !== undefined);
  const earliestSeq = Math.min(...[...edges.values()].map((edge) => edge.source_event_seq));
  const provenance = provenanceForSeq(earliestSeq);
  if (provenance === null) {
    throw new Error(`dependency group for task '${taskId}' references missing audit event seq ${earliestSeq}`);
  }
  return {
    id: crypto.createHash("sha256").update(taskIds.join("\n")).digest("hex").slice(0, 16),
    state: groupState(statuses),
    task_ids: taskIds,
    provenance,
  };
}

export function taskSummary(row: TaskRow, diffVerified?: boolean): TaskSummaryProjection;
export function taskSummary(id: string, diffVerified?: boolean): TaskSummaryProjection | null;
export function taskSummary(rowOrId: TaskRow | string, diffVerified = false): TaskSummaryProjection | null {
  const task = typeof rowOrId === "string" ? getTaskRow(rowOrId) : rowOrId;
  if (task === null) return null;
  const repository = getRepositoryRow(task.repository_id);
  const claims = claimsForTask(task.id).map(claimProjection);
  const dependencies = dependencyRows(task.id);
  const dependents = dependentRows(task.id);
  const group = dependencyGroup(task.id);
  const run = latestRun(task.id);
  return {
    id: task.id,
    repository_id: task.repository_id,
    title: task.title,
    prompt: task.prompt,
    status: task.status,
    repo_path: repository?.root_path ?? null,
    repo_name: repository ? path.basename(path.resolve(repository.root_path)) : null,
    base_branch: task.base_branch,
    base_commit: task.base_commit,
    branch_name: task.branch_name,
    worktree_path: task.worktree_path,
    created_at: task.created_at,
    updated_at: task.updated_at,
    last_activity_at: lastActivityAt(task),
    cost_usd: task.total_cost_usd,
    num_turns: task.num_turns,
    duration_ms: task.duration_ms,
    claims,
    claim_count: claims.length,
    dependency_ids: dependencies.map((edge) => edge.depends_on_task_id),
    dependent_ids: dependents.map((edge) => edge.task_id),
    blocking_reasons: blockingReasons(task),
    review_status: task.review_status,
    review_stale: diffVerified && task.review_status === "approved" && task.approved_diff_digest === task.current_diff_digest
      ? false
      : reviewIsStale(task),
    outcome_status: task.outcome_status,
    row_version: task.row_version,
    group_id: group?.id ?? null,
    group_state: group?.state ?? null,
    run: run ? runProjection(run) : null,
    diff: diffProjection(task),
    artifact_summary: artifactSummary(task.id),
  };
}

export function listTaskSummaries(): TaskSummaryProjection[] {
  const rows = db.prepare(`
    SELECT * FROM tasks
    ORDER BY created_at DESC, id DESC
  `).all() as TaskRow[];
  return rows.map((row) => taskSummary(row));
}

function repositoryObservationDigest(observation: RepositoryObservation): string {
  return crypto.createHash("sha256").update(JSON.stringify({
    root_path: observation.rootPath,
    git_dir: observation.gitDir,
    is_git: observation.isGit,
    branch: observation.branch,
    head_commit: observation.headCommit,
    clean: observation.clean,
    error: observation.error,
  })).digest("hex");
}

function repositoryProjection(row: RepositoryRow, observation?: RepositoryObservation) {
  const observed = observation ?? null;
  const isGit = observed?.isGit ?? row.is_git === 1;
  const branch = observed?.branch ?? null;
  const headCommit = observed?.headCommit ?? row.head_commit;
  const lastError = observed ? observed.error : row.last_error;
  return {
    id: row.id,
    path: row.root_path,
    repo_path: row.root_path,
    name: path.basename(path.resolve(row.root_path)),
    default_branch: observed?.branch ?? row.default_branch,
    branch,
    gitless: !isGit,
    is_git: isGit,
    git_dir: observed?.gitDir ?? row.git_dir,
    head_commit: headCommit,
    clean: observed?.clean ?? null,
    dirty: observed ? !observed.clean : null,
    checked_at: observed?.checkedAt ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_error: lastError,
    provenance: provenanceForSeq(row.last_event_seq ?? row.created_event_seq),
    observation_provenance: observed ? {
      kind: "git_repository_inspection",
      source: "git",
      digest: repositoryObservationDigest(observed),
      recorded_at: observed.checkedAt,
    } : null,
  };
}

function overlapProjection(row: OverlapRow) {
  return {
    id: row.id,
    repository_id: row.repository_id,
    left_task_id: row.left_task_id,
    right_task_id: row.right_task_id,
    path: row.path,
    evidence_type: row.evidence_type,
    type: row.evidence_type,
    blocking: row.blocking === 1,
    severity: row.blocking === 1 ? "blocking" : "warning",
    status: row.status,
    details: jsonObject(row.details_json),
    detected_at: row.detected_at,
    resolved_at: row.resolved_at,
    resolution: row.resolution,
    provenance: provenanceForSeq(row.source_event_seq),
    resolution_provenance: provenanceForSeq(row.resolution_event_seq),
  };
}

function artifactProjection(row: ArtifactRow) {
  const metadata = jsonObject(row.metadata_json);
  return {
    id: row.id,
    task_id: row.task_id,
    run_id: row.run_id,
    type: row.kind,
    kind: row.kind,
    path: row.path,
    digest: row.sha256,
    sha256: row.sha256,
    created_at: row.created_at,
    size_bytes: row.size_bytes,
    media_type: row.media_type,
    changed_paths: metadataStrings(metadata, ["changed_paths", "paths"]),
    metadata,
    provenance: provenanceForSeq(row.source_event_seq),
  };
}

function reviewProjection(row: ReviewRow, currentDiffDigest: string | null, diffVerified: boolean) {
  const stale = row.decision !== "approved"
    ? false
    : row.diff_digest !== currentDiffDigest
      ? true
      : diffVerified
        ? false
        : null;
  return {
    id: row.id,
    task_id: row.task_id,
    decision: row.decision,
    summary: row.summary,
    diff_digest: row.diff_digest,
    stale,
    created_at: row.created_at,
    reviewer: row.reviewer,
    provenance: provenanceForSeq(row.source_event_seq),
  };
}

function outcomeProjection(row: OutcomeRow) {
  return {
    id: row.id,
    task_id: row.task_id,
    type: row.type,
    status: row.status,
    operation_id: row.operation_id,
    reason: row.reason,
    summary: row.reason,
    commit: row.commit_sha,
    commit_sha: row.commit_sha,
    diff_digest: row.diff_digest,
    created_at: row.created_at,
    provenance: provenanceForSeq(row.source_event_seq),
  };
}

function taskTimeline(taskId: string) {
  const rows = db.prepare(`
    SELECT * FROM audit_events
    WHERE task_id = ?
    ORDER BY seq ASC
  `).all(taskId) as AuditEventProjectionRow[];
  return rows.map((row) => ({
    seq: row.seq,
    id: row.event_id,
    event_id: row.event_id,
    type: row.event_type,
    event_type: row.event_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    repository_id: row.repository_id,
    task_id: row.task_id,
    run_id: row.run_id,
    actor: row.actor,
    occurred_at: row.occurred_at,
    payload: parseJson<unknown>(row.payload_json, null),
    provenance: provenanceFromAuditRow(row),
  }));
}

export function taskDetailBase(
  id: string,
  options: { repositoryObservation?: RepositoryObservation; diffVerified?: boolean } = {},
) {
  const task = getTaskRow(id);
  if (task === null) return null;
  const repository = getRepositoryRow(task.repository_id);
  const claims = claimsForTask(id);
  const overlaps = db.prepare(`
    SELECT * FROM overlap_evidence
    WHERE left_task_id = ? OR right_task_id = ?
    ORDER BY detected_at ASC, id ASC
  `).all(id, id) as OverlapRow[];
  const runs = db.prepare(`
    SELECT * FROM agent_runs
    WHERE task_id = ?
    ORDER BY attempt ASC, created_at ASC, id ASC
  `).all(id) as AgentRunRow[];
  const artifacts = db.prepare(`
    SELECT * FROM artifacts
    WHERE task_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(id) as ArtifactRow[];
  const reviews = db.prepare(`
    SELECT * FROM reviews
    WHERE task_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(id) as ReviewRow[];
  const outcomes = db.prepare(`
    SELECT * FROM outcomes
    WHERE task_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(id) as OutcomeRow[];

  return {
    task: taskSummary(task, options.diffVerified === true),
    repository: repository ? repositoryProjection(repository, options.repositoryObservation) : null,
    dependencies: taskLinks(id, "dependencies"),
    dependents: taskLinks(id, "dependents"),
    claims: claims.map(claimProjection),
    overlaps: overlaps.map(overlapProjection),
    runs: runs.map(runProjection),
    artifacts: artifacts.map(artifactProjection),
    reviews: reviews.map((review) => reviewProjection(review, task.current_diff_digest, options.diffVerified === true)),
    outcomes: outcomes.map(outcomeProjection),
    timeline: taskTimeline(id),
    group: dependencyGroup(id),
    eligibility: null,
    worktree_health: null,
    residual_health: null,
  };
}
