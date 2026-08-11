import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { BENCHMARKS_DIR, WORKTREES_DIR, db, parseJson, stringifyJson } from "./db.js";
import { listRegisteredWorktrees } from "./git.js";
import {
  appendAuditEvent,
  canonicalJson,
  committedMutation,
  recordAuditEvent,
  sha256,
} from "./ledger.js";

export const RESIDUAL_SCHEMA_VERSION = "agent-farm.residual-benchmark.v1";

export type ResidualType =
  | "orphan_worktree"
  | "orphan_run"
  | "dangling_task"
  | "double_terminal"
  | "review_merge_mismatch"
  | "stale_run"
  | "cost_event_mismatch";
export type ResidualSeverity = "info" | "warning" | "blocking";

export interface ResidualFinding {
  id: string;
  type: ResidualType;
  severity: ResidualSeverity;
  task_id?: string;
  run_id?: string;
  repository_id?: string;
  detected_at: string;
  source_event_seq: number;
  provenance: {
    kind: string;
    source: string;
    observed_at: string;
    digest?: string;
  };
  evidence: Record<string, unknown>;
  remediation: string;
}

export interface ProviderProof {
  status: "verified" | "blocked" | "not_run";
  reason?: string;
  run_ids?: string[];
  cost_usd?: number;
}

export interface ResidualBenchmark {
  schema_version: typeof RESIDUAL_SCHEMA_VERSION;
  artifact_id: string;
  generated_at: string;
  sha256: string;
  ledger: { first_seq: number; last_seq: number; event_count: number };
  scope: { repository_ids: string[]; task_ids: string[] };
  summary: {
    total: number;
    by_type: Record<string, number>;
    by_severity: Record<string, number>;
  };
  residuals: ResidualFinding[];
  cleanup_proof: { checked_paths: string[]; remaining_paths: string[] };
  provider_proof: ProviderProof;
}

interface RepositoryRow {
  id: string;
  root_path: string;
  is_git: number;
  default_branch: string | null;
  created_event_seq: number | null;
  last_event_seq: number | null;
}

interface TaskRow {
  id: string;
  repository_id: string;
  status: string;
  base_branch: string | null;
  base_commit: string | null;
  branch_name: string | null;
  worktree_path: string | null;
  current_diff_digest: string | null;
  approved_diff_digest: string | null;
  harvest_commit: string | null;
  total_cost_usd: number | null;
  created_event_seq: number | null;
}

interface RunRow {
  id: string;
  task_id: string;
  status: string;
  provider_status: string;
  heartbeat_at: number | null;
  cost_usd: number | null;
  source_event_seq: number;
  terminal_event_seq: number | null;
}

const exec = promisify(execFile);
const GIT_MAX_BUFFER = 16 * 1024 * 1024;
const TASK_TRAILER = "Agent-Farm-Task";
const SHA_PATTERN = /^[0-9a-f]{40,64}$/;
const TERMINAL_TASKS = new Set(["harvested", "wilted", "cancelled"]);
const WORKTREE_REQUIRED_TASKS = new Set([
  "seeded",
  "preparing",
  "blocked",
  "running",
  "review_pending",
  "review_rejected",
  "harvesting",
  "wilting",
  "failed",
  "recovery_required",
]);
const RESIDUAL_TYPES: ResidualType[] = [
  "orphan_worktree",
  "orphan_run",
  "dangling_task",
  "double_terminal",
  "review_merge_mismatch",
  "stale_run",
  "cost_event_mismatch",
];
const SEVERITIES: ResidualSeverity[] = ["info", "warning", "blocking"];

function normalizedPath(value: string): string {
  return path.normalize(path.resolve(value));
}

async function canonicalPath(value: string): Promise<string> {
  const absolute = normalizedPath(value);
  try {
    return path.normalize(await fs.realpath(absolute));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const remainder: string[] = [];
    let ancestor = absolute;
    for (;;) {
      const parent = path.dirname(ancestor);
      if (parent === ancestor) return absolute;
      remainder.unshift(path.basename(ancestor));
      ancestor = parent;
      try {
        const canonicalAncestor = path.normalize(await fs.realpath(ancestor));
        return path.normalize(path.resolve(canonicalAncestor, ...remainder));
      } catch (ancestorError) {
        if ((ancestorError as NodeJS.ErrnoException).code !== "ENOENT") throw ancestorError;
      }
    }
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.lstat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function repositoryEventSeq(repository: RepositoryRow): number | undefined {
  return repository.last_event_seq ?? repository.created_event_seq ?? undefined;
}

function finding(input: Omit<ResidualFinding, "id" | "detected_at" | "provenance" | "source_event_seq"> & {
  observedAt: number;
  source_event_seq?: number;
  fallbackEventSeq: number;
  provenanceKind: string;
  provenanceSource: string;
}): ResidualFinding {
  const identity = canonicalJson({
    type: input.type,
    task_id: input.task_id ?? null,
    run_id: input.run_id ?? null,
    repository_id: input.repository_id ?? null,
    evidence: input.evidence,
  });
  const digest = sha256(identity);
  return {
    id: `res_${digest.slice(0, 32)}`,
    type: input.type,
    severity: input.severity,
    ...(input.task_id ? { task_id: input.task_id } : {}),
    ...(input.run_id ? { run_id: input.run_id } : {}),
    ...(input.repository_id ? { repository_id: input.repository_id } : {}),
    detected_at: new Date(input.observedAt).toISOString(),
    source_event_seq: input.source_event_seq ?? input.fallbackEventSeq,
    provenance: {
      kind: input.provenanceKind,
      source: input.provenanceSource,
      observed_at: new Date(input.observedAt).toISOString(),
      digest,
    },
    evidence: input.evidence,
    remediation: input.remediation,
  };
}

function latestResultCost(runId: string): { seq: number; cost: number | null } | null {
  const rows = db.prepare(`
    SELECT seq, payload_json FROM audit_events
    WHERE run_id = ? AND event_type LIKE 'agent.sdk.result.%'
    ORDER BY seq DESC
  `).all(runId) as Array<{ seq: number; payload_json: string }>;
  for (const row of rows) {
    const payload = parseJson<Record<string, unknown>>(row.payload_json, {});
    const value = payload.total_cost_usd;
    if (typeof value === "number" && Number.isFinite(value)) return { seq: row.seq, cost: value };
    if (value === null || value === undefined) return { seq: row.seq, cost: null };
  }
  return null;
}

function costEqual(left: number | null, right: number | null): boolean {
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) <= 1e-9;
}

async function scanWorktrees(
  repositories: RepositoryRow[],
  tasks: TaskRow[],
  observedAt: number,
  fallbackEventSeq: number,
): Promise<{ findings: ResidualFinding[]; checked: string[]; remaining: string[] }> {
  const findings: ResidualFinding[] = [];
  const makeFinding = (
    input: Omit<Parameters<typeof finding>[0], "fallbackEventSeq">,
  ) => finding({ ...input, fallbackEventSeq });
  const checked = new Set<string>();
  const remaining = new Set<string>();
  const expected = new Map<string, TaskRow>();
  for (const task of tasks) {
    if (task.worktree_path) expected.set(await canonicalPath(task.worktree_path), task);
  }
  const worktreesRoot = await canonicalPath(WORKTREES_DIR);

  let diskEntries: string[] = [];
  try {
    diskEntries = await Promise.all(
      (await fs.readdir(WORKTREES_DIR)).map((entry) => canonicalPath(path.join(WORKTREES_DIR, entry))),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const diskPath of diskEntries) {
    checked.add(diskPath);
    const task = expected.get(diskPath);
    if (!task) {
      remaining.add(diskPath);
      findings.push(makeFinding({
        type: "orphan_worktree",
        severity: "warning",
        observedAt,
        provenanceKind: "filesystem_scan",
        provenanceSource: worktreesRoot,
        evidence: { path: diskPath, registered: null, reason: "directory_has_no_task_projection" },
        remediation: "Verify the directory is not in use, then remove it through the repository's git worktree cleanup flow.",
      }));
    } else if (TERMINAL_TASKS.has(task.status)) {
      remaining.add(diskPath);
      findings.push(makeFinding({
        type: "orphan_worktree",
        severity: "warning",
        task_id: task.id,
        repository_id: task.repository_id,
        source_event_seq: task.created_event_seq ?? undefined,
        observedAt,
        provenanceKind: "filesystem_projection_mismatch",
        provenanceSource: worktreesRoot,
        evidence: { path: diskPath, task_status: task.status, reason: "terminal_task_retains_worktree" },
        remediation: "Run idempotent task cleanup and verify the branch and registered worktree are both gone.",
      }));
    }
  }

  for (const repository of repositories.filter((row) => row.is_git === 1)) {
    let registered: Awaited<ReturnType<typeof listRegisteredWorktrees>>;
    try {
      registered = await listRegisteredWorktrees(repository.root_path);
    } catch (error) {
      findings.push(makeFinding({
        type: "dangling_task",
        severity: "blocking",
        repository_id: repository.id,
        source_event_seq: repositoryEventSeq(repository),
        observedAt,
        provenanceKind: "git_worktree_scan_error",
        provenanceSource: repository.root_path,
        evidence: { repository_path: repository.root_path, error: error instanceof Error ? error.message : String(error) },
        remediation: "Restore repository access and rerun reconciliation before harvesting any task in this repository.",
      }));
      continue;
    }
    const repositoryPath = await canonicalPath(repository.root_path);
    for (const entry of registered) {
      const registeredPath = await canonicalPath(entry.worktreePath);
      if (registeredPath === repositoryPath) continue;
      checked.add(registeredPath);
      const task = expected.get(registeredPath);
      if (!task) {
        remaining.add(registeredPath);
        findings.push(makeFinding({
          type: "orphan_worktree",
          severity: "warning",
          repository_id: repository.id,
          source_event_seq: repositoryEventSeq(repository),
          observedAt,
          provenanceKind: "git_worktree_registry_scan",
          provenanceSource: repository.root_path,
          evidence: {
            path: registeredPath,
            branch_name: entry.branchName,
            head_commit: entry.headCommit,
            prunable: entry.prunable,
            reason: "registered_worktree_has_no_task_projection",
          },
          remediation: "Confirm ownership, then remove the registered worktree with git worktree remove and prune its task branch.",
        }));
      }
    }
  }

  for (const task of tasks) {
    if (!WORKTREE_REQUIRED_TASKS.has(task.status) || !task.worktree_path) continue;
    const projectedPath = normalizedPath(task.worktree_path);
    const taskPath = await canonicalPath(projectedPath);
    checked.add(taskPath);
    if (!(await exists(projectedPath))) {
      findings.push(makeFinding({
        type: "dangling_task",
        severity: "blocking",
        task_id: task.id,
        repository_id: task.repository_id,
        source_event_seq: task.created_event_seq ?? undefined,
        observedAt,
        provenanceKind: "filesystem_projection_mismatch",
        provenanceSource: taskPath,
        evidence: { path: taskPath, task_status: task.status, reason: "projected_worktree_is_missing" },
        remediation: "Use explicit recovery if the task can be reconstructed from its base commit, otherwise wilt it and record cleanup proof.",
      }));
    }
  }
  return { findings, checked: [...checked].sort(), remaining: [...remaining].sort() };
}

interface AuditProofRow {
  seq: number;
  event_type: string;
  entity_type: string;
  entity_id: string;
  repository_id: string | null;
  task_id: string | null;
  run_id: string | null;
  payload_json: string;
  provenance_kind: string;
  provenance_source: string;
  provenance_digest: string | null;
}

interface GitLineageEvidence {
  repository_path: string;
  base_branch: string | null;
  base_branch_exists: boolean;
  commit: string | null;
  commit_exists: boolean;
  commit_on_base_branch: boolean;
  exact_task_trailer: boolean;
  error: string | null;
}

function auditProofForSeq(seq: number | null | undefined): AuditProofRow | null {
  if (seq === null || seq === undefined) return null;
  return (db.prepare(`
    SELECT seq, event_type, entity_type, entity_id, repository_id, task_id, run_id,
      payload_json, provenance_kind, provenance_source, provenance_digest
    FROM audit_events WHERE seq = ?
  `).get(seq) as AuditProofRow | undefined) ?? null;
}

function auditProofEvidence(row: AuditProofRow | null): Record<string, unknown> | null {
  if (!row) return null;
  return {
    seq: row.seq,
    event_type: row.event_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    repository_id: row.repository_id,
    task_id: row.task_id,
    run_id: row.run_id,
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    provenance: {
      kind: row.provenance_kind,
      source: row.provenance_source,
      digest: row.provenance_digest,
    },
  };
}

function exactTaskTrailer(message: string, taskId: string): boolean {
  const expected = `${TASK_TRAILER}: ${taskId}`;
  const normalized = message.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  const separator = normalized.lastIndexOf("\n\n");
  if (separator < 0) return false;
  const trailerBlock = normalized.slice(separator + 2).split("\n");
  return trailerBlock.filter((line) => line === expected).length === 1 && trailerBlock.at(-1) === expected;
}

async function gitOutput(cwd: string, args: readonly string[], trim = true): Promise<string> {
  const { stdout } = await exec("git", [...args], { cwd, encoding: "utf8", maxBuffer: GIT_MAX_BUFFER });
  return trim ? stdout.trim() : stdout;
}

async function gitSucceeds(cwd: string, args: readonly string[]): Promise<boolean> {
  try {
    await gitOutput(cwd, args);
    return true;
  } catch {
    return false;
  }
}

async function verifyHarvestGitLineage(
  repository: RepositoryRow | undefined,
  task: TaskRow,
  commit: string | null,
): Promise<GitLineageEvidence> {
  const repositoryPath = repository?.root_path ?? "";
  const baseBranch = task.base_branch ?? repository?.default_branch ?? null;
  const evidence: GitLineageEvidence = {
    repository_path: repositoryPath,
    base_branch: baseBranch,
    base_branch_exists: false,
    commit,
    commit_exists: false,
    commit_on_base_branch: false,
    exact_task_trailer: false,
    error: null,
  };
  if (!repository || repository.is_git !== 1) {
    evidence.error = "repository_is_not_a_projected_git_repository";
    return evidence;
  }
  try {
    const root = await canonicalPath(repository.root_path);
    evidence.repository_path = root;
    if (!baseBranch) {
      evidence.error = "base_branch_is_not_projected";
      return evidence;
    }
    if (!(await gitSucceeds(root, ["check-ref-format", `refs/heads/${baseBranch}`]))) {
      evidence.error = "base_branch_name_is_invalid";
      return evidence;
    }
    const baseReference = `refs/heads/${baseBranch}`;
    evidence.base_branch_exists = await gitSucceeds(root, ["rev-parse", "--verify", `${baseReference}^{commit}`]);
    if (!evidence.base_branch_exists) {
      evidence.error = "base_branch_commit_is_unresolvable";
      return evidence;
    }
    if (!commit || !SHA_PATTERN.test(commit)) return evidence;
    evidence.commit_exists = await gitSucceeds(root, ["cat-file", "-e", `${commit}^{commit}`]);
    if (!evidence.commit_exists) return evidence;
    evidence.commit_on_base_branch = await gitSucceeds(root, ["merge-base", "--is-ancestor", commit, baseReference]);
    const message = await gitOutput(root, ["show", "--no-patch", "--format=%B", commit], false);
    evidence.exact_task_trailer = exactTaskTrailer(message, task.id);
    return evidence;
  } catch (error) {
    evidence.error = error instanceof Error ? error.message : String(error);
    return evidence;
  }
}

async function scanRows(
  repositories: RepositoryRow[],
  tasks: TaskRow[],
  runs: RunRow[],
  observedAt: number,
  fallbackEventSeq: number,
): Promise<ResidualFinding[]> {
  const findings: ResidualFinding[] = [];
  const makeFinding = (
    input: Omit<Parameters<typeof finding>[0], "fallbackEventSeq">,
  ) => finding({ ...input, fallbackEventSeq });
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const repositoryById = new Map(repositories.map((repository) => [repository.id, repository]));
  const staleThreshold = Number(process.env.AGENT_FARM_STALE_RUN_MS ?? 5 * 60_000);

  for (const run of runs) {
    const task = taskById.get(run.task_id);
    if (!task) {
      findings.push(makeFinding({
        type: "orphan_run",
        severity: "blocking",
        run_id: run.id,
        source_event_seq: run.source_event_seq,
        observedAt,
        provenanceKind: "sqlite_foreign_key_audit",
        provenanceSource: "agent_runs",
        evidence: { task_id: run.task_id, run_status: run.status },
        remediation: "Quarantine the orphan row, reconstruct its source task from the audit ledger, and restore foreign-key integrity.",
      }));
      continue;
    }
    if (["queued", "running"].includes(run.status) && (run.heartbeat_at ?? 0) < observedAt - staleThreshold) {
      findings.push(makeFinding({
        type: "stale_run",
        severity: "blocking",
        task_id: task.id,
        run_id: run.id,
        repository_id: task.repository_id,
        source_event_seq: run.terminal_event_seq ?? run.source_event_seq,
        observedAt,
        provenanceKind: "heartbeat_threshold",
        provenanceSource: "agent_runs",
        evidence: { status: run.status, heartbeat_at: run.heartbeat_at, stale_threshold_ms: staleThreshold },
        remediation: "Reconcile the process state, mark the run crashed if no process owns it, then require an explicit retry or recovery run.",
      }));
    }

    if (!["queued", "running", "provider_blocked"].includes(run.status)) {
      const result = latestResultCost(run.id);
      const costMismatch = result
        ? !costEqual(run.cost_usd, result.cost)
        : run.cost_usd !== null;
      if (costMismatch) {
        findings.push(makeFinding({
          type: "cost_event_mismatch",
          severity: "warning",
          task_id: task.id,
          run_id: run.id,
          repository_id: task.repository_id,
          source_event_seq: result?.seq ?? run.terminal_event_seq ?? run.source_event_seq,
          observedAt,
          provenanceKind: "cost_ledger_comparison",
          provenanceSource: "agent_runs+audit_events",
          evidence: { projected_cost_usd: run.cost_usd, result_event_cost_usd: result?.cost ?? null, result_event_found: result !== null },
          remediation: "Rebuild the run cost projection from the authoritative SDK result event; do not substitute zero for absent cost data.",
        }));
      }
    }
  }

  for (const task of tasks) {
    const terminals = db.prepare(`
      SELECT id, type, status, operation_id, commit_sha, diff_digest, created_at, source_event_seq
      FROM outcomes
      WHERE task_id = ? AND status IN ('succeeded', 'confirmed')
      ORDER BY created_at ASC, id ASC
    `).all(task.id) as Array<{
      id: string;
      type: string;
      status: string;
      operation_id: string | null;
      commit_sha: string | null;
      diff_digest: string | null;
      created_at: number;
      source_event_seq: number;
    }>;
    const terminalKinds = [...new Set(terminals.map((row) => row.type))];
    const terminalCounts = Object.fromEntries(
      terminalKinds.map((kind) => [kind, terminals.filter((row) => row.type === kind).length]),
    );
    if (terminalKinds.length > 1 || Object.values(terminalCounts).some((count) => count > 1)) {
      findings.push(makeFinding({
        type: "double_terminal",
        severity: "blocking",
        task_id: task.id,
        repository_id: task.repository_id,
        source_event_seq: terminals.at(-1)?.source_event_seq ?? task.created_event_seq ?? undefined,
        observedAt,
        provenanceKind: "terminal_outcome_cardinality",
        provenanceSource: "outcomes",
        evidence: { task_status: task.status, outcomes: terminals, terminal_kinds: terminalKinds, terminal_counts: terminalCounts },
        remediation: "Stop further operations, establish the authoritative terminal event from Git and the append-only ledger, and reconcile the materialized task projection.",
      }));
    }

    if (task.status === "harvested") {
      const harvest = terminals.filter((row) => row.type === "harvest").at(-1);
      const latestApproval = db.prepare(`
        SELECT id, diff_digest, source_event_seq FROM reviews
        WHERE task_id = ? AND decision = 'approved'
        ORDER BY created_at DESC, id DESC LIMIT 1
      `).get(task.id) as { id: string; diff_digest: string; source_event_seq: number } | undefined;
      const latestPatch = db.prepare(`
        SELECT id, run_id, sha256, metadata_json, source_event_seq FROM artifacts
        WHERE task_id = ? AND kind = 'patch'
        ORDER BY created_at DESC, id DESC LIMIT 1
      `).get(task.id) as {
        id: string;
        run_id: string | null;
        sha256: string;
        metadata_json: string;
        source_event_seq: number;
      } | undefined;
      const patchMetadata = latestPatch
        ? parseJson<Record<string, unknown>>(latestPatch.metadata_json, {})
        : null;
      const patchMetadataDigest = typeof patchMetadata?.diff_digest === "string"
        ? patchMetadata.diff_digest
        : null;
      const approvalEvent = auditProofForSeq(latestApproval?.source_event_seq);
      const patchEvent = auditProofForSeq(latestPatch?.source_event_seq);
      const outcomeEvent = auditProofForSeq(harvest?.source_event_seq);
      const terminalEvent = db.prepare(`
        SELECT seq, event_type, entity_type, entity_id, repository_id, task_id, run_id,
          payload_json, provenance_kind, provenance_source, provenance_digest
        FROM audit_events
        WHERE task_id = ?
          AND event_type IN ('task.harvest.succeeded', 'task.harvest.reconciled')
          AND (? IS NULL OR entity_id = ?)
        ORDER BY seq DESC LIMIT 1
      `).get(task.id, harvest?.operation_id ?? null, harvest?.operation_id ?? null) as AuditProofRow | undefined;
      const approvalPayload = approvalEvent
        ? parseJson<Record<string, unknown>>(approvalEvent.payload_json, {})
        : null;
      const patchPayload = patchEvent
        ? parseJson<Record<string, unknown>>(patchEvent.payload_json, {})
        : null;
      const patchPayloadMetadata = patchPayload?.metadata &&
        typeof patchPayload.metadata === "object" &&
        !Array.isArray(patchPayload.metadata)
        ? patchPayload.metadata as Record<string, unknown>
        : null;
      const outcomePayload = outcomeEvent
        ? parseJson<Record<string, unknown>>(outcomeEvent.payload_json, {})
        : null;
      const terminalPayload = terminalEvent
        ? parseJson<Record<string, unknown>>(terminalEvent.payload_json, {})
        : null;
      const projectedCommit = task.harvest_commit;
      const gitLineage = await verifyHarvestGitLineage(repositoryById.get(task.repository_id), task, projectedCommit);
      const digestValues = [
        task.current_diff_digest,
        task.approved_diff_digest,
        harvest?.diff_digest ?? null,
        latestApproval?.diff_digest ?? null,
        latestPatch?.sha256 ?? null,
        patchMetadataDigest,
      ];
      const completeDigestLineage = digestValues.every((value): value is string => typeof value === "string" && value.length > 0);
      const digestSet = new Set(digestValues.filter((value): value is string => typeof value === "string" && value.length > 0));
      const diffProvenanceValid = Boolean(
        latestPatch &&
        patchEvent &&
        patchEvent.event_type === "task.artifact.created" &&
        patchEvent.entity_type === "artifact" &&
        patchEvent.entity_id === latestPatch.id &&
        patchEvent.repository_id === task.repository_id &&
        patchEvent.task_id === task.id &&
        patchEvent.run_id === latestPatch.run_id &&
        patchEvent.provenance_kind === "git_artifact" &&
        patchEvent.provenance_source === "git_diff" &&
        patchEvent.provenance_digest === latestPatch.sha256 &&
        patchPayload?.kind === "patch" &&
        patchPayload.sha256 === latestPatch.sha256 &&
        patchPayloadMetadata?.diff_digest === patchMetadataDigest,
      );
      const approvalProvenanceValid = Boolean(
        latestApproval &&
        approvalEvent &&
        approvalEvent.event_type === "task.review.approved" &&
        approvalEvent.entity_type === "review" &&
        approvalEvent.entity_id === latestApproval.id &&
        approvalEvent.repository_id === task.repository_id &&
        approvalEvent.task_id === task.id &&
        approvalEvent.provenance_kind === "human_review" &&
        approvalEvent.provenance_digest === latestApproval.diff_digest &&
        approvalPayload?.decision === "approved" &&
        approvalPayload.diff_digest === latestApproval.diff_digest,
      );
      const outcomeProvenanceValid = Boolean(
        harvest &&
        outcomeEvent &&
        outcomeEvent.event_type === "task.harvest.started" &&
        outcomeEvent.entity_type === "operation" &&
        outcomeEvent.repository_id === task.repository_id &&
        outcomeEvent.task_id === task.id &&
        (!harvest.operation_id || outcomeEvent.entity_id === harvest.operation_id) &&
        outcomeEvent.provenance_kind === "human_confirmation" &&
        outcomeEvent.provenance_source === "http_api" &&
        outcomeEvent.provenance_digest === harvest.diff_digest &&
        outcomePayload?.diff_digest === harvest.diff_digest,
      );
      const terminalProvenanceValid = Boolean(
        terminalEvent &&
        terminalEvent.repository_id === task.repository_id &&
        terminalEvent.task_id === task.id &&
        (!harvest?.operation_id || terminalEvent.entity_id === harvest.operation_id) &&
        ["task.harvest.succeeded", "task.harvest.reconciled"].includes(terminalEvent.event_type) &&
        terminalEvent.entity_type === "outcome" &&
        terminalEvent.provenance_kind === (terminalEvent.event_type === "task.harvest.reconciled" ? "git_commit_trailer" : "git_commit") &&
        terminalEvent.provenance_source === "git" &&
        terminalEvent.provenance_digest === projectedCommit &&
        terminalPayload?.commit === projectedCommit &&
        terminalPayload.diff_digest === harvest?.diff_digest,
      );
      const reasons: string[] = [];
      if (!projectedCommit) reasons.push("task_harvest_commit_missing");
      if (!harvest?.commit_sha) reasons.push("harvest_outcome_commit_missing");
      if (projectedCommit && harvest?.commit_sha && projectedCommit !== harvest.commit_sha) {
        reasons.push("task_and_outcome_commit_disagree");
      }
      if (!completeDigestLineage) reasons.push("diff_lineage_incomplete");
      else if (digestSet.size !== 1) reasons.push("diff_lineage_mismatch");
      if (!diffProvenanceValid) reasons.push("diff_provenance_mismatch");
      if (!approvalProvenanceValid) reasons.push("approval_provenance_mismatch");
      if (!outcomeProvenanceValid) reasons.push("outcome_provenance_mismatch");
      if (!terminalProvenanceValid) reasons.push("terminal_provenance_mismatch");
      if (!gitLineage.base_branch_exists) reasons.push("base_branch_missing");
      if (!gitLineage.commit_exists) reasons.push("harvest_commit_missing");
      else {
        if (!gitLineage.commit_on_base_branch) reasons.push("harvest_commit_not_on_base_branch");
        if (!gitLineage.exact_task_trailer) reasons.push("harvest_commit_missing_exact_task_trailer");
      }
      if (reasons.length > 0) {
        findings.push(makeFinding({
          type: "review_merge_mismatch",
          severity: "blocking",
          task_id: task.id,
          repository_id: task.repository_id,
          source_event_seq: terminalEvent?.seq ?? harvest?.source_event_seq ?? latestApproval?.source_event_seq ?? task.created_event_seq ?? undefined,
          observedAt,
          provenanceKind: "review_merge_lineage_comparison",
          provenanceSource: "tasks+reviews+outcomes+artifacts+audit_events+git",
          evidence: {
            reasons,
            task_harvest_commit: projectedCommit,
            outcome_commit: harvest?.commit_sha ?? null,
            current_diff_digest: task.current_diff_digest,
            approved_diff_digest: task.approved_diff_digest,
            latest_review_digest: latestApproval?.diff_digest ?? null,
            latest_patch_digest: latestPatch?.sha256 ?? null,
            latest_patch_metadata_digest: patchMetadataDigest,
            outcome_diff_digest: harvest?.diff_digest ?? null,
            lineage_checks: {
              complete_digest_lineage: completeDigestLineage,
              digest_lineage_equal: completeDigestLineage && digestSet.size === 1,
              diff_provenance_valid: diffProvenanceValid,
              approval_provenance_valid: approvalProvenanceValid,
              outcome_provenance_valid: outcomeProvenanceValid,
              terminal_provenance_valid: terminalProvenanceValid,
            },
            source_events: {
              patch: auditProofEvidence(patchEvent),
              approval: auditProofEvidence(approvalEvent),
              outcome: auditProofEvidence(outcomeEvent),
              terminal: auditProofEvidence(terminalEvent ?? null),
            },
            git: gitLineage,
          },
          remediation: "Block further harvest claims and reconcile the approved digest, harvest outcome, authoritative audit provenance, and exact Git commit lineage before treating the task as harvested.",
        }));
      }
    }
  }
  return findings;
}

function providerProof(runs: RunRow[]): ProviderProof {
  const verified = runs.filter((run) => run.status === "succeeded" && run.provider_status === "verified");
  if (verified.length > 0) {
    const costs = verified.map((run) => run.cost_usd).filter((value): value is number => value !== null);
    return {
      status: "verified",
      run_ids: verified.map((run) => run.id),
      ...(costs.length === verified.length ? { cost_usd: costs.reduce((sum, value) => sum + value, 0) } : {}),
    };
  }
  const blocked = runs.filter((run) => run.status === "provider_blocked");
  if (blocked.length > 0) {
    return {
      status: "blocked",
      reason: "Real provider-backed Agent SDK execution was blocked by provider authentication.",
      run_ids: blocked.map((run) => run.id),
    };
  }
  return {
    status: "not_run",
    reason: runs.length === 0
      ? "No Agent SDK run has been recorded."
      : "No successful provider-verified Agent SDK run has been recorded.",
    run_ids: runs.map((run) => run.id),
  };
}

function benchmarkDigest(artifact: ResidualBenchmark): string {
  return sha256(`${JSON.stringify({ ...artifact, sha256: "" })}\n`);
}

function validateStoredArtifact(artifact: ResidualBenchmark): ResidualBenchmark {
  if (artifact.schema_version !== RESIDUAL_SCHEMA_VERSION) {
    throw new Error(`unsupported residual benchmark schema: ${String(artifact.schema_version)}`);
  }
  const digest = benchmarkDigest(artifact);
  if (digest !== artifact.sha256) throw new Error(`residual benchmark digest mismatch for ${artifact.artifact_id}`);
  return artifact;
}

export async function generateResidualBenchmark(providerOverride?: ProviderProof): Promise<ResidualBenchmark> {
  const generatedAt = Date.now();
  const artifactId = crypto.randomUUID();
  const scanStarted = appendAuditEvent({
    eventType: "benchmark.residual.scan_started",
    entityType: "benchmark_artifact",
    entityId: artifactId,
    payload: { schema_version: RESIDUAL_SCHEMA_VERSION },
    provenance: { kind: "residual_scan", source: "sqlite+git+filesystem" },
    occurredAt: generatedAt,
  });
  const repositories = db.prepare("SELECT * FROM repositories ORDER BY id").all() as RepositoryRow[];
  const tasks = db.prepare("SELECT * FROM tasks ORDER BY id").all() as TaskRow[];
  const runs = db.prepare(`
    SELECT run.* FROM agent_runs run
    LEFT JOIN tasks task ON task.id = run.task_id
    ORDER BY run.id
  `).all() as RunRow[];
  const ledger = db.prepare(`
    SELECT COALESCE(MIN(seq), 0) AS first_seq, COALESCE(MAX(seq), 0) AS last_seq, COUNT(*) AS event_count
    FROM audit_events
  `).get() as { first_seq: number; last_seq: number; event_count: number };

  const worktrees = await scanWorktrees(repositories, tasks, generatedAt, scanStarted.seq);
  const residuals = [...worktrees.findings, ...await scanRows(repositories, tasks, runs, generatedAt, scanStarted.seq)]
    .sort((left, right) => left.type.localeCompare(right.type) || left.id.localeCompare(right.id));
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const residual of residuals) {
    byType[residual.type] = (byType[residual.type] ?? 0) + 1;
    bySeverity[residual.severity] = (bySeverity[residual.severity] ?? 0) + 1;
  }
  const artifact: ResidualBenchmark = {
    schema_version: RESIDUAL_SCHEMA_VERSION,
    artifact_id: artifactId,
    generated_at: new Date(generatedAt).toISOString(),
    sha256: "",
    ledger,
    scope: {
      repository_ids: repositories.map((row) => row.id),
      task_ids: tasks.map((row) => row.id),
    },
    summary: { total: residuals.length, by_type: byType, by_severity: bySeverity },
    residuals,
    cleanup_proof: {
      checked_paths: worktrees.checked,
      remaining_paths: worktrees.remaining,
    },
    provider_proof: providerOverride ?? providerProof(runs),
  };
  artifact.sha256 = benchmarkDigest(artifact);

  const finalPath = path.join(BENCHMARKS_DIR, `${artifactId}.json`);
  const temporaryPath = `${finalPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const contents = `${JSON.stringify(artifact, null, 2)}\n`;
  await fs.writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await fs.rename(temporaryPath, finalPath);
  try {
    committedMutation((collector) => {
      const event = recordAuditEvent(collector, {
        eventType: "benchmark.residual.generated",
        entityType: "benchmark_artifact",
        entityId: artifactId,
        payload: {
          schema_version: artifact.schema_version,
          sha256: artifact.sha256,
          summary: artifact.summary,
          ledger: artifact.ledger,
          provider_proof: artifact.provider_proof,
        },
        provenance: { kind: "residual_scan", source: "sqlite+git+filesystem", digest: artifact.sha256 },
        occurredAt: generatedAt,
      });
      db.prepare(`
        INSERT INTO benchmark_artifacts (
          id, schema_version, generated_at, sha256, path, size_bytes,
          first_seq, last_seq, event_count, artifact_json, source_event_seq
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        artifactId,
        artifact.schema_version,
        generatedAt,
        artifact.sha256,
        finalPath,
        Buffer.byteLength(contents),
        ledger.first_seq,
        ledger.last_seq,
        ledger.event_count,
        stringifyJson(artifact),
        event.seq,
      );
    });
  } catch (error) {
    await fs.rm(finalPath, { force: true });
    throw error;
  }
  return artifact;
}

export function getLatestResidualBenchmark(): ResidualBenchmark | null {
  const row = db.prepare(`
    SELECT artifact_json FROM benchmark_artifacts
    WHERE schema_version = ? ORDER BY generated_at DESC, id DESC LIMIT 1
  `).get(RESIDUAL_SCHEMA_VERSION) as { artifact_json: string } | undefined;
  if (!row) return null;
  return validateStoredArtifact(parseJson<ResidualBenchmark>(row.artifact_json, null as unknown as ResidualBenchmark));
}

export function taskResidualHealth(taskId: string): {
  artifact_id: string;
  schema_version: string;
  total: number;
  blocking: number;
  residual_ids: string[];
} | null {
  const artifact = getLatestResidualBenchmark();
  if (!artifact) return null;
  const residuals = artifact.residuals.filter((row) => row.task_id === taskId);
  return {
    artifact_id: artifact.artifact_id,
    schema_version: artifact.schema_version,
    total: residuals.length,
    blocking: residuals.filter((row) => row.severity === "blocking").length,
    residual_ids: residuals.map((row) => row.id),
  };
}
