import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { db, ARTIFACTS_DIR, WORKTREES_DIR, parseJson, stringifyJson } from "./db.js";
import { AppError, badRequest, conflict, notFound } from "./errors.js";
import {
  appendAuditEvent,
  committedMutation,
  recordAuditEvent,
  sdkAuditPayload,
  sha256,
  type EventCollector,
} from "./ledger.js";
import {
  activeSandboxRunDirs,
  cancelAgentRun,
  executeAgentRun,
  providerKind,
  type SdkRunTerminal,
} from "./agent.js";
import { AgentSandboxError, cleanupOrphanedWorkspaceSandboxes } from "./agent-sandbox.js";
import {
  baseCheckoutHealth,
  captureTaskDiff,
  commitTaskChanges,
  createTaskWorktree,
  findTaskHarvestCommit,
  harvestTaskBranch,
  inspectRepository,
  listRegisteredWorktrees,
  removeTaskWorktree,
  restoreBaseRepository,
  worktreeHealth,
  type WorktreeHealth,
} from "./git.js";
import {
  claimsInput,
  magnetPathsInput,
  normalizedRepoRelativePath,
  optionalString,
  pathsOverlap,
  positiveNumber,
  requireString,
  stringArray,
  type ClaimInput,
} from "./validation.js";

export const TERMINAL_TASK_STATUSES = new Set(["harvested", "wilted", "cancelled"]);
const ACTIVE_RUN_STATUSES = new Set(["queued", "running"]);
const LOCK_TTL_MS = 30 * 60_000;
const DEFAULT_RUN_TIMEOUT_MS = Number(process.env.AGENT_FARM_RUN_TIMEOUT_MS ?? 30 * 60_000);
const DEFAULT_MAX_BUDGET_USD = Number(process.env.AGENT_FARM_MAX_BUDGET_USD ?? 5);

interface RepositoryRow {
  id: string;
  root_path: string;
  git_dir: string | null;
  is_git: number;
  default_branch: string | null;
  head_commit: string | null;
  last_error: string | null;
  last_event_seq?: number | null;
}

interface TaskRow {
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
}

interface AgentRunRow {
  id: string;
  task_id: string;
  attempt: number;
  status: string;
  provider_status: string;
  provider: string | null;
  retry_of_run_id: string | null;
  recovery_of_run_id: string | null;
  timeout_ms: number | null;
  max_budget_usd: number | null;
}

interface DiffArtifactRecord {
  kind: "patch" | "diff_stat" | "manifest";
  path: string;
  mediaType?: string;
  media_type?: string;
  sizeBytes?: number;
  size_bytes?: number;
  sha256: string;
  metadata?: Record<string, unknown>;
}

interface DiffSnapshotShape {
  digest?: string;
  patchDigest?: string;
  patch_digest?: string;
  changedPaths?: string[];
  changed_paths?: string[];
  entries?: unknown[];
  hasChanges?: boolean;
  has_changes?: boolean;
  artifacts: DiffArtifactRecord[];
}

export interface SeedTaskInput {
  repoPath: string;
  prompt: string;
  title?: string | null;
  dependencies?: string[];
  claims?: ClaimInput[];
  magnetPaths?: string[];
  autoStart?: boolean;
}

export interface StartRunInput {
  timeoutMs?: number;
  maxBudgetUsd?: number;
  maxTurns?: number;
  model?: string;
  retryOfRunId?: string | null;
  recoveryOfRunId?: string | null;
}

function taskOrThrow(taskId: string): TaskRow {
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as TaskRow | undefined;
  if (!task) throw notFound("task_not_found", `Task ${taskId} does not exist.`, { task_id: taskId });
  return task;
}

function repositoryOrThrow(repositoryId: string): RepositoryRow {
  const repository = db.prepare("SELECT * FROM repositories WHERE id = ?").get(repositoryId) as RepositoryRow | undefined;
  if (!repository) throw notFound("repository_not_found", `Repository ${repositoryId} does not exist.`);
  return repository;
}

function addReason(existing: string, reason: string): string {
  return stringifyJson([...new Set([...parseJson<string[]>(existing, []), reason])]);
}

function refreshRepositoryEventSeq(repositoryId: string, eventSeq: number): void {
  db.prepare("UPDATE repositories SET last_event_seq = ?, updated_at = MAX(updated_at, ?) WHERE id = ?")
    .run(eventSeq, Date.now(), repositoryId);
}

function removeReasonPrefix(existing: string, prefix: string): string {
  return stringifyJson(parseJson<string[]>(existing, []).filter((reason) => !reason.startsWith(prefix)));
}

function normalizeInspectionError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function dependencyWouldCycle(taskId: string, dependsOnTaskId: string): boolean {
  if (taskId === dependsOnTaskId) return true;
  const result = db.prepare(`
    WITH RECURSIVE reachable(id) AS (
      SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?
      UNION
      SELECT dependency.depends_on_task_id
      FROM task_dependencies dependency
      JOIN reachable ON dependency.task_id = reachable.id
    )
    SELECT 1 AS cycle FROM reachable WHERE id = ? LIMIT 1
  `).get(dependsOnTaskId, taskId) as { cycle: number } | undefined;
  return Boolean(result);
}

function insertDependency(collector: EventCollector, taskId: string, dependencyId: string, now: number): void {
  const task = taskOrThrow(taskId);
  if (TERMINAL_TASK_STATUSES.has(task.status)) {
    throw conflict("task_terminal", "Terminal tasks cannot acquire new dependencies.", { status: task.status });
  }
  const dependency = taskOrThrow(dependencyId);
  if (task.repository_id !== dependency.repository_id) {
    throw conflict("cross_repository_dependency", "Dependencies must belong to the same repository hyperedge.", {
      task_id: taskId,
      dependency_id: dependencyId,
    });
  }
  if (dependencyWouldCycle(taskId, dependencyId)) {
    throw conflict("dependency_cycle", "The dependency would create a cycle.", {
      task_id: taskId,
      dependency_id: dependencyId,
    });
  }
  const existing = db.prepare(
    "SELECT 1 FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?",
  ).get(taskId, dependencyId);
  if (existing) throw conflict("dependency_exists", "The dependency already exists.", { task_id: taskId, dependency_id: dependencyId });
  const event = recordAuditEvent(collector, {
    eventType: "task.dependency.added",
    entityType: "task_dependency",
    entityId: `${taskId}:${dependencyId}`,
    repositoryId: task.repository_id,
    taskId,
    payload: { dependency_id: dependencyId },
    provenance: { kind: "explicit_dependency", source: "http_api" },
    occurredAt: now,
  });
  db.prepare(`
    INSERT INTO task_dependencies (task_id, depends_on_task_id, created_at, source_event_seq)
    VALUES (?, ?, ?, ?)
  `).run(taskId, dependencyId, now, event.seq);
}

function evidenceTaskOrder(left: string, right: string): [string, string] {
  return left < right ? [left, right] : [right, left];
}

function createOverlapEvidence(
  collector: EventCollector,
  input: {
    repositoryId: string;
    taskId: string;
    otherTaskId: string;
    overlapPath: string;
    evidenceType: "claim" | "magnet" | "diff";
    blocking: boolean;
    details: Record<string, unknown>;
    now: number;
  },
): string | null {
  const [leftTaskId, rightTaskId] = evidenceTaskOrder(input.taskId, input.otherTaskId);
  const existing = db.prepare(`
    SELECT id, blocking, details_json FROM overlap_evidence
    WHERE repository_id = ? AND left_task_id = ? AND right_task_id = ?
      AND path = ? AND evidence_type = ? AND status = 'open'
  `).get(input.repositoryId, leftTaskId, rightTaskId, input.overlapPath, input.evidenceType) as {
    id: string;
    blocking: number;
    details_json: string;
  } | undefined;
  if (existing) {
    if (input.blocking && !existing.blocking) {
      const event = recordAuditEvent(collector, {
        eventType: "task.overlap.escalated",
        entityType: "overlap_evidence",
        entityId: existing.id,
        repositoryId: input.repositoryId,
        taskId: input.taskId,
        payload: { path: input.overlapPath, evidence_type: input.evidenceType, blocking: true, details: input.details },
        provenance: { kind: `${input.evidenceType}_overlap`, source: "domain_detector" },
        occurredAt: input.now,
      });
      db.prepare(`
        UPDATE overlap_evidence SET blocking = 1, details_json = ?, source_event_seq = ?
        WHERE id = ? AND status = 'open' AND blocking = 0
      `).run(
        stringifyJson({ ...parseJson<Record<string, unknown>>(existing.details_json, {}), ...input.details }),
        event.seq,
        existing.id,
      );
    }
    return existing.id;
  }
  const id = crypto.randomUUID();
  const event = recordAuditEvent(collector, {
    eventType: "task.overlap.detected",
    entityType: "overlap_evidence",
    entityId: id,
    repositoryId: input.repositoryId,
    taskId: input.taskId,
    payload: {
      left_task_id: leftTaskId,
      right_task_id: rightTaskId,
      path: input.overlapPath,
      evidence_type: input.evidenceType,
      blocking: input.blocking,
      details: input.details,
      note: "Overlap evidence is not a dependency or proof of collaboration.",
    },
    provenance: { kind: `${input.evidenceType}_overlap`, source: "domain_detector" },
    occurredAt: input.now,
  });
  db.prepare(`
    INSERT INTO overlap_evidence (
      id, repository_id, left_task_id, right_task_id, path, evidence_type,
      blocking, status, details_json, detected_at, source_event_seq
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `).run(
    id,
    input.repositoryId,
    leftTaskId,
    rightTaskId,
    input.overlapPath,
    input.evidenceType,
    input.blocking ? 1 : 0,
    stringifyJson(input.details),
    input.now,
    event.seq,
  );
  return id;
}

function claimCollisions(repositoryId: string, taskId: string, claimPath: string): Array<{
  id: string;
  task_id: string;
  path: string;
  normalized_path: string;
  mode: "exclusive" | "shared";
}> {
  const claims = db.prepare(`
    SELECT id, task_id, path, normalized_path, mode
    FROM path_claims
    WHERE repository_id = ? AND status = 'active' AND task_id <> ?
  `).all(repositoryId, taskId) as Array<{
    id: string;
    task_id: string;
    path: string;
    normalized_path: string;
    mode: "exclusive" | "shared";
  }>;
  return claims.filter((claim) => pathsOverlap(claim.normalized_path, claimPath));
}

function insertClaim(
  collector: EventCollector,
  task: TaskRow,
  claim: ClaimInput,
  now: number,
): { claimId: string | null; blocking: Array<Record<string, unknown>> } {
  const existing = db.prepare(`
    SELECT id, mode FROM path_claims
    WHERE task_id = ? AND normalized_path = ? AND status = 'active'
  `).get(task.id, claim.path) as { id: string; mode: "exclusive" | "shared" } | undefined;
  if (existing) {
    if (existing.mode !== claim.mode) {
      throw conflict("claim_mode_mismatch", "The task already holds this path with a different mode; release it before changing mode.", {
        claim_id: existing.id,
        path: claim.path,
        current_mode: existing.mode,
        requested_mode: claim.mode,
      });
    }
    return { claimId: existing.id, blocking: [] };
  }
  const collisions = claimCollisions(task.repository_id, task.id, claim.path);
  const blocking = collisions.filter((other) => claim.mode === "exclusive" || other.mode === "exclusive");
  const id = crypto.randomUUID();
  for (const other of collisions) {
    createOverlapEvidence(collector, {
      repositoryId: task.repository_id,
      taskId: task.id,
      otherTaskId: other.task_id,
      overlapPath: claim.path,
      evidenceType: "claim",
      blocking: blocking.includes(other),
      details: {
        requested_mode: claim.mode,
        claim_id: id,
        other_claim_id: other.id,
        other_path: other.path,
        other_mode: other.mode,
        claim_created: !blocking.includes(other),
      },
      now,
    });
  }
  if (blocking.length > 0) return { claimId: null, blocking };

  const event = recordAuditEvent(collector, {
    eventType: "task.claim.created",
    entityType: "path_claim",
    entityId: id,
    repositoryId: task.repository_id,
    taskId: task.id,
    payload: { path: claim.path, mode: claim.mode },
    provenance: { kind: "path_claim", source: "http_api" },
    occurredAt: now,
  });
  db.prepare(`
    INSERT INTO path_claims (
      id, task_id, repository_id, path, normalized_path, mode, status,
      claimed_at, source_event_seq
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(id, task.id, task.repository_id, claim.path, claim.path, claim.mode, now, event.seq);
  return { claimId: id, blocking: [] };
}

function detectMagnetOverlap(collector: EventCollector, task: TaskRow, magnets: string[], now: number): void {
  if (magnets.length === 0) return;
  const others = db.prepare(`
    SELECT id, magnet_paths_json FROM tasks
    WHERE repository_id = ? AND id <> ? AND status NOT IN ('wilted', 'cancelled')
  `).all(task.repository_id, task.id) as Array<{ id: string; magnet_paths_json: string }>;
  for (const other of others) {
    const otherMagnets = parseJson<string[]>(other.magnet_paths_json, []);
    for (const magnet of magnets) {
      const overlapping = otherMagnets.find((candidate) => pathsOverlap(candidate, magnet));
      if (!overlapping) continue;
      createOverlapEvidence(collector, {
        repositoryId: task.repository_id,
        taskId: task.id,
        otherTaskId: other.id,
        overlapPath: magnet,
        evidenceType: "magnet",
        blocking: false,
        details: { other_path: overlapping },
        now,
      });
    }
  }
}

export async function seedTask(raw: Record<string, unknown>): Promise<{ taskId: string; claimConflicts: unknown[] }> {
  const repoPath = requireString(raw.repo_path, "repo_path", { max: 16_384 });
  const prompt = requireString(raw.prompt, "prompt", { max: 200_000 });
  const title = optionalString(raw.title, "title", 500) ?? prompt.split("\n", 1)[0]!.slice(0, 120);
  const dependencies = stringArray(raw.dependencies ?? raw.dependency_ids, "dependencies", 1_000);
  const claims = claimsInput(raw.claims);
  const magnetPaths = magnetPathsInput(raw.magnet_paths);
  const autoStart = raw.auto_start === undefined ? true : raw.auto_start === true;
  if (raw.auto_start !== undefined && typeof raw.auto_start !== "boolean") {
    throw badRequest("invalid_request", "auto_start must be a boolean.");
  }

  let inspection: Awaited<ReturnType<typeof inspectRepository>>;
  try {
    inspection = await inspectRepository(repoPath);
  } catch (error) {
    const rootPath = path.resolve(repoPath);
    inspection = {
      inputPath: repoPath,
      rootPath,
      gitDir: null,
      isGit: false,
      defaultBranch: null,
      headCommit: null,
      clean: false,
      statusPorcelain: "",
      error: normalizeInspectionError(error),
    };
  }
  const now = Date.now();
  const taskId = crypto.randomUUID();
  const repositoryId = sha256(inspection.rootPath).slice(0, 32);
  const repositoryUsable = Boolean(inspection.isGit && inspection.defaultBranch && inspection.headCommit);
  const staticReasons = repositoryUsable
    ? []
    : [inspection.isGit ? "repository_unborn" : inspection.error ? "repository_unavailable" : "gitless_repository"];
  const status = repositoryUsable ? "seeded" : "blocked";
  const claimConflicts: unknown[] = [];

  committedMutation((collector) => {
    let repository = db.prepare("SELECT * FROM repositories WHERE root_path = ?").get(inspection.rootPath) as RepositoryRow | undefined;
    const repositoryEvent = recordAuditEvent(collector, {
      eventType: repository ? "repository.observed" : "repository.registered",
      entityType: "repository",
      entityId: repository?.id ?? repositoryId,
      repositoryId: repository?.id ?? repositoryId,
      payload: {
        root_path: inspection.rootPath,
        is_git: inspection.isGit,
        default_branch: inspection.defaultBranch,
        head_commit: inspection.headCommit,
        clean: inspection.clean,
        error: inspection.error ?? null,
      },
      provenance: { kind: "git_inspection", source: "git" },
      occurredAt: now,
    });
    if (!repository) {
      db.prepare(`
        INSERT INTO repositories (
          id, root_path, git_dir, is_git, default_branch, head_commit,
          created_at, updated_at, last_error, created_event_seq
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        repositoryId,
        inspection.rootPath,
        inspection.gitDir,
        inspection.isGit ? 1 : 0,
        inspection.defaultBranch,
        inspection.headCommit,
        now,
        now,
        inspection.error ?? null,
        repositoryEvent.seq,
      );
      refreshRepositoryEventSeq(repositoryId, repositoryEvent.seq);
      repository = repositoryOrThrow(repositoryId);
    } else {
      db.prepare(`
        UPDATE repositories SET git_dir = ?, is_git = ?, default_branch = ?, head_commit = ?,
          updated_at = ?, last_error = ?, row_version = row_version + 1 WHERE id = ?
      `).run(
        inspection.gitDir,
        inspection.isGit ? 1 : 0,
        inspection.defaultBranch,
        inspection.headCommit,
        now,
        inspection.error ?? null,
        repository.id,
      );
      refreshRepositoryEventSeq(repository.id, repositoryEvent.seq);
    }

    const taskEvent = recordAuditEvent(collector, {
      eventType: "task.seeded",
      entityType: "task",
      entityId: taskId,
      repositoryId: repository.id,
      taskId,
      actor: "human",
      payload: {
        title,
        prompt,
        base_branch: inspection.defaultBranch,
        base_commit: inspection.headCommit,
        explicit_dependencies: dependencies,
        claims,
        magnet_paths: magnetPaths,
        auto_start: autoStart,
        blocked: !repositoryUsable,
        blocking_reason: staticReasons[0] ?? null,
      },
      provenance: { kind: "task_seed", source: "http_api" },
      occurredAt: now,
    });
    db.prepare(`
      INSERT INTO tasks (
        id, repository_id, title, prompt, status, base_branch, base_commit,
        magnet_paths_json, blocking_reasons_json, auto_start, provider_status,
        error_code, error_message, created_at, updated_at, created_event_seq
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_run', ?, ?, ?, ?, ?)
    `).run(
      taskId,
      repository.id,
      title,
      prompt,
      status,
      inspection.defaultBranch,
      inspection.headCommit,
      stringifyJson(magnetPaths),
      stringifyJson(staticReasons),
      autoStart ? 1 : 0,
      repositoryUsable ? null : staticReasons[0],
      inspection.error ?? (repositoryUsable ? null : "Git repository has no usable HEAD/default branch."),
      now,
      now,
      taskEvent.seq,
    );
    const task = taskOrThrow(taskId);
    for (const dependencyId of dependencies) insertDependency(collector, taskId, dependencyId, now);
    for (const claim of claims) {
      const result = insertClaim(collector, task, claim, now);
      if (result.blocking.length > 0) {
        claimConflicts.push({ path: claim.path, collisions: result.blocking });
        db.prepare("UPDATE tasks SET blocking_reasons_json = ?, updated_at = ?, row_version = row_version + 1 WHERE id = ?")
          .run(addReason(task.blocking_reasons_json, `claim_conflict:${claim.path}`), now, taskId);
      }
    }
    detectMagnetOverlap(collector, task, magnetPaths, now);
  });

  if (repositoryUsable) await prepareTask(taskId);
  return { taskId, claimConflicts };
}

async function prepareTask(taskId: string): Promise<void> {
  const task = taskOrThrow(taskId);
  const repository = repositoryOrThrow(task.repository_id);
  if (!repository.is_git || !task.base_commit) return;
  const operationId = crypto.randomUUID();
  const now = Date.now();
  committedMutation((collector) => {
    const changed = db.prepare(`
      UPDATE tasks SET status = 'preparing', updated_at = ?, row_version = row_version + 1
      WHERE id = ? AND status IN ('seeded', 'blocked')
    `).run(now, taskId);
    if (changed.changes !== 1) throw conflict("invalid_task_state", "Task cannot be prepared from its current state.", { status: task.status });
    const event = recordAuditEvent(collector, {
      eventType: "task.worktree.prepare_started",
      entityType: "operation",
      entityId: operationId,
      repositoryId: task.repository_id,
      taskId,
      payload: { base_commit: task.base_commit },
      provenance: { kind: "git_operation", source: "git_worktree" },
      occurredAt: now,
    });
    db.prepare(`
      INSERT INTO operation_journal (
        id, repository_id, task_id, operation, state, details_json,
        started_at, updated_at, source_event_seq
      ) VALUES (?, ?, ?, 'prepare', 'started', '{}', ?, ?, ?)
    `).run(operationId, task.repository_id, taskId, now, now, event.seq);
  });

  try {
    const worktree = await createTaskWorktree({
      repoRoot: repository.root_path,
      taskId,
      baseCommit: task.base_commit,
      worktreesDir: WORKTREES_DIR,
    });
    committedMutation((collector) => {
      const event = recordAuditEvent(collector, {
        eventType: "task.worktree.prepared",
        entityType: "worktree",
        entityId: worktree.worktreePath,
        repositoryId: task.repository_id,
        taskId,
        payload: { worktree_path: worktree.worktreePath, branch_name: worktree.branchName, base_commit: task.base_commit },
        provenance: { kind: "git_worktree", source: "git" },
      });
      db.prepare(`
        UPDATE tasks SET status = 'seeded', branch_name = ?, worktree_path = ?,
          error_code = NULL, error_message = NULL, updated_at = ?, row_version = row_version + 1
        WHERE id = ? AND status = 'preparing'
      `).run(worktree.branchName, worktree.worktreePath, Date.now(), taskId);
      db.prepare("UPDATE operation_journal SET state = 'committed', updated_at = ?, details_json = ? WHERE id = ?")
        .run(Date.now(), stringifyJson({ prepared_event_seq: event.seq }), operationId);
    });
    if (task.auto_start) await scheduleReadyTasks(task.repository_id);
  } catch (error) {
    const message = normalizeInspectionError(error);
    committedMutation((collector) => {
      recordAuditEvent(collector, {
        eventType: "task.worktree.prepare_failed",
        entityType: "operation",
        entityId: operationId,
        repositoryId: task.repository_id,
        taskId,
        payload: { error: message },
        provenance: { kind: "git_error", source: "git_worktree" },
      });
      db.prepare(`
        UPDATE tasks SET status = 'blocked', blocking_reasons_json = ?, error_code = 'worktree_prepare_failed',
          error_message = ?, updated_at = ?, row_version = row_version + 1 WHERE id = ?
      `).run(addReason(task.blocking_reasons_json, "worktree_prepare_failed"), message, Date.now(), taskId);
      db.prepare("UPDATE operation_journal SET state = 'failed', error_message = ?, updated_at = ? WHERE id = ?")
        .run(message, Date.now(), operationId);
    });
    if (error instanceof AppError) throw error;
  }
}

export function addDependency(taskId: string, dependencyId: string): void {
  const now = Date.now();
  committedMutation((collector) => insertDependency(collector, taskId, dependencyId, now));
}

export function removeDependency(taskId: string, dependencyId: string): void {
  const task = taskOrThrow(taskId);
  committedMutation((collector) => {
    const existing = db.prepare(`
      SELECT source_event_seq FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?
    `).get(taskId, dependencyId) as { source_event_seq: number } | undefined;
    if (!existing) throw notFound("dependency_not_found", "The dependency does not exist.");
    const event = recordAuditEvent(collector, {
      eventType: "task.dependency.removed",
      entityType: "task_dependency",
      entityId: `${taskId}:${dependencyId}`,
      repositoryId: task.repository_id,
      taskId,
      payload: { dependency_id: dependencyId, added_event_seq: existing.source_event_seq },
      provenance: { kind: "explicit_dependency", source: "http_api" },
    });
    db.prepare("DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?").run(taskId, dependencyId);
    void event;
  });
  void scheduleReadyTasks(task.repository_id).catch((error) => {
    console.error(`[task ${taskId}] dependency-unblock scheduling failed`, error);
  });
}

export function addPathClaim(taskId: string, rawPath: unknown, rawMode: unknown): { claimId: string } {
  const task = taskOrThrow(taskId);
  if (TERMINAL_TASK_STATUSES.has(task.status)) throw conflict("task_terminal", "Terminal tasks cannot claim paths.");
  const claim: ClaimInput = {
    path: normalizedRepoRelativePath(rawPath),
    mode: rawMode === undefined ? "exclusive" : rawMode === "exclusive" || rawMode === "shared"
      ? rawMode
      : (() => { throw badRequest("invalid_claim_mode", "mode must be exclusive or shared."); })(),
  };
  const result = committedMutation((collector) => {
    const inserted = insertClaim(collector, task, claim, Date.now());
    if (inserted.blocking.length > 0) {
      db.prepare("UPDATE tasks SET blocking_reasons_json = ?, updated_at = ?, row_version = row_version + 1 WHERE id = ?")
        .run(addReason(task.blocking_reasons_json, `claim_conflict:${claim.path}`), Date.now(), taskId);
    }
    return inserted;
  });
  if (!result.claimId) {
    throw conflict("claim_conflict", "The path conflicts with an active exclusive claim.", {
      path: claim.path,
      collisions: result.blocking,
      evidence_persisted: true,
    });
  }
  return { claimId: result.claimId };
}

function clearResolvedClaimReason(taskId: string, claimPath: string, now: number): void {
  const stillBlocked = db.prepare(`
    SELECT 1 FROM overlap_evidence
    WHERE status = 'open' AND blocking = 1 AND evidence_type = 'claim' AND path = ?
      AND (left_task_id = ? OR right_task_id = ?)
    LIMIT 1
  `).get(claimPath, taskId, taskId);
  if (stillBlocked) return;
  const row = db.prepare("SELECT blocking_reasons_json FROM tasks WHERE id = ?").get(taskId) as {
    blocking_reasons_json: string;
  } | undefined;
  if (!row) return;
  db.prepare("UPDATE tasks SET blocking_reasons_json = ?, updated_at = ?, row_version = row_version + 1 WHERE id = ?")
    .run(removeReasonPrefix(row.blocking_reasons_json, `claim_conflict:${claimPath}`), now, taskId);
}

export function releasePathClaim(taskId: string, claimId: string): void {
  const task = taskOrThrow(taskId);
  committedMutation((collector) => {
    const claim = db.prepare(`
      SELECT * FROM path_claims WHERE id = ? AND task_id = ? AND status = 'active'
    `).get(claimId, taskId) as { path: string } | undefined;
    if (!claim) throw notFound("claim_not_found", "The active claim does not exist.");
    const affectedOverlaps = (db.prepare(`
      SELECT id, left_task_id, right_task_id, path, details_json
      FROM overlap_evidence
      WHERE repository_id = ? AND evidence_type = 'claim' AND status = 'open'
    `).all(task.repository_id) as Array<{
      id: string;
      left_task_id: string;
      right_task_id: string;
      path: string;
      details_json: string;
    }>).filter((overlap) => {
      const details = parseJson<Record<string, unknown>>(overlap.details_json, {});
      return details.other_claim_id === claimId || details.claim_id === claimId;
    });
    const now = Date.now();
    const event = recordAuditEvent(collector, {
      eventType: "task.claim.released",
      entityType: "path_claim",
      entityId: claimId,
      repositoryId: task.repository_id,
      taskId,
      payload: { path: claim.path, superseded_overlap_ids: affectedOverlaps.map((overlap) => overlap.id) },
      provenance: { kind: "path_claim", source: "http_api" },
      occurredAt: now,
    });
    db.prepare(`
      UPDATE path_claims SET status = 'released', released_at = ?, release_event_seq = ?
      WHERE id = ? AND status = 'active'
    `).run(now, event.seq, claimId);
    for (const overlap of affectedOverlaps) {
      db.prepare(`
        UPDATE overlap_evidence
        SET status = 'superseded', resolved_at = ?, resolution = 'source_claim_released', resolution_event_seq = ?
        WHERE id = ? AND status = 'open'
      `).run(now, event.seq, overlap.id);
    }
    const affectedReasons = new Set<string>([
      `${taskId}\0${claim.path}`,
      ...affectedOverlaps.flatMap((overlap) => [
        `${overlap.left_task_id}\0${overlap.path}`,
        `${overlap.right_task_id}\0${overlap.path}`,
      ]),
    ]);
    for (const key of affectedReasons) {
      const separator = key.indexOf("\0");
      clearResolvedClaimReason(key.slice(0, separator), key.slice(separator + 1), now);
    }
  });
  void scheduleReadyTasks(task.repository_id).catch((error) => {
    console.error(`[task ${taskId}] claim-unblock scheduling failed`, error);
  });
}

export function resolveOverlap(taskId: string, overlapId: string, rawResolution: unknown): void {
  const task = taskOrThrow(taskId);
  const resolution = requireString(rawResolution, "resolution", { max: 10_000 });
  committedMutation((collector) => {
    const overlap = db.prepare(`
      SELECT * FROM overlap_evidence
      WHERE id = ? AND status = 'open' AND (left_task_id = ? OR right_task_id = ?)
    `).get(overlapId, taskId, taskId) as { path: string } | undefined;
    if (!overlap) throw notFound("overlap_not_found", "The open overlap evidence does not exist for this task.");
    const now = Date.now();
    const event = recordAuditEvent(collector, {
      eventType: "task.overlap.resolved",
      entityType: "overlap_evidence",
      entityId: overlapId,
      repositoryId: task.repository_id,
      taskId,
      actor: "human",
      payload: { resolution },
      provenance: { kind: "human_resolution", source: "http_api" },
      occurredAt: now,
    });
    db.prepare(`
      UPDATE overlap_evidence SET status = 'resolved', resolved_at = ?, resolution = ?, resolution_event_seq = ?
      WHERE id = ? AND status = 'open'
    `).run(now, resolution, event.seq, overlapId);
  });
  void scheduleReadyTasks(task.repository_id).catch((error) => {
    console.error(`[task ${taskId}] overlap-unblock scheduling failed`, error);
  });
}

function nextAttempt(taskId: string): number {
  const result = db.prepare("SELECT COALESCE(MAX(attempt), 0) + 1 AS attempt FROM agent_runs WHERE task_id = ?")
    .get(taskId) as { attempt: number };
  return result.attempt;
}

const backgroundRuns = new Map<string, Promise<void>>();
const schedulingRepositories = new Set<string>();

function taskQueueBlockers(taskId: string): string[] {
  const blockers: string[] = [];
  const dependencies = db.prepare(`
    SELECT dependency.depends_on_task_id AS id, task.status
    FROM task_dependencies dependency
    JOIN tasks task ON task.id = dependency.depends_on_task_id
    WHERE dependency.task_id = ? AND task.status <> 'harvested'
  `).all(taskId) as Array<{ id: string; status: string }>;
  for (const dependency of dependencies) blockers.push(`dependency_not_harvested:${dependency.id}:${dependency.status}`);
  const overlaps = db.prepare(`
    SELECT id FROM overlap_evidence
    WHERE blocking = 1 AND status = 'open' AND (left_task_id = ? OR right_task_id = ?)
  `).all(taskId, taskId) as Array<{ id: string }>;
  for (const overlap of overlaps) blockers.push(`blocking_overlap:${overlap.id}`);
  return blockers;
}

export async function scheduleReadyTasks(repositoryId?: string): Promise<void> {
  const schedulingKey = repositoryId ?? "*";
  if (schedulingRepositories.has(schedulingKey)) return;
  schedulingRepositories.add(schedulingKey);
  try {
    const tasks = db.prepare(`
      SELECT id, repository_id FROM tasks
      WHERE auto_start = 1 AND status = 'seeded'
        AND (? IS NULL OR repository_id = ?)
      ORDER BY created_at ASC, id ASC
    `).all(repositoryId ?? null, repositoryId ?? null) as Array<{ id: string; repository_id: string }>;
    await Promise.all(tasks.map(async (task) => {
      if (taskQueueBlockers(task.id).length > 0) return;
      try {
        await startTaskRun(task.id, {});
      } catch (error) {
        if (error instanceof AppError && ["run_active", "task_changed", "invalid_task_state"].includes(error.code)) return;
        throw error;
      }
    }));
  } finally {
    schedulingRepositories.delete(schedulingKey);
  }
}

export async function startTaskRun(taskId: string, input: StartRunInput): Promise<{ runId: string }> {
  const task = taskOrThrow(taskId);
  if (!task.worktree_path || !task.base_commit) throw conflict("worktree_missing", "The task has no usable worktree.");
  const retryingTerminalRun = input.retryOfRunId !== undefined || input.recoveryOfRunId !== undefined;
  if (
    task.status === "harvested" || task.status === "wilted" || task.status === "wilting" || task.status === "harvesting" ||
    (task.status === "cancelled" && !retryingTerminalRun)
  ) {
    throw conflict("invalid_task_state", "The task cannot start a run from its current state.", { status: task.status });
  }
  const queueBlockers = taskQueueBlockers(taskId);
  if (queueBlockers.length > 0) {
    throw conflict("task_blocked", "Explicit dependencies or unresolved blocking overlap evidence prevent this run.", {
      reasons: queueBlockers,
    });
  }
  const repository = repositoryOrThrow(task.repository_id);
  const health = await worktreeHealth({
    repoRoot: repository.root_path,
    worktreePath: task.worktree_path,
    baseCommit: task.base_commit,
    ...(task.branch_name ? { expectedBranch: task.branch_name } : {}),
  });
  if (!health.exists || !health.registered || !task.branch_name || health.branchName !== task.branch_name) {
    throw conflict("worktree_mismatch", "The task worktree identity is not safe for a run.", {
      exists: health.exists,
      registered: health.registered,
      expected_branch: task.branch_name,
      actual_branch: health.branchName,
      reasons: health.reasons,
    });
  }
  const active = db.prepare(`
    SELECT id FROM agent_runs WHERE task_id = ? AND status IN ('queued', 'running') LIMIT 1
  `).get(taskId) as { id: string } | undefined;
  if (active) throw conflict("run_active", "The task already has an active run.", { run_id: active.id });
  if (input.retryOfRunId) {
    const prior = db.prepare("SELECT id FROM agent_runs WHERE id = ? AND task_id = ?").get(input.retryOfRunId, taskId);
    if (!prior) throw badRequest("invalid_retry_run", "retry_of_run_id does not belong to the task.");
  }
  if (input.recoveryOfRunId) {
    const prior = db.prepare("SELECT id FROM agent_runs WHERE id = ? AND task_id = ?").get(input.recoveryOfRunId, taskId);
    if (!prior) throw badRequest("invalid_recovery_run", "recovery_of_run_id does not belong to the task.");
  }
  const runId = crypto.randomUUID();
  const attempt = nextAttempt(taskId);
  const now = Date.now();
  const timeoutMs = Math.max(1_000, input.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS);
  const maxBudgetUsd = input.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD;
  committedMutation((collector) => {
    const event = recordAuditEvent(collector, {
      eventType: input.recoveryOfRunId ? "agent.run.recovery_queued" : input.retryOfRunId ? "agent.run.retry_queued" : "agent.run.queued",
      entityType: "agent_run",
      entityId: runId,
      repositoryId: task.repository_id,
      taskId,
      runId,
      actor: "human",
      payload: {
        attempt,
        timeout_ms: timeoutMs,
        max_budget_usd: maxBudgetUsd,
        retry_of_run_id: input.retryOfRunId ?? null,
        recovery_of_run_id: input.recoveryOfRunId ?? null,
      },
      provenance: { kind: "agent_sdk_run", source: "http_api" },
      occurredAt: now,
    });
    db.prepare(`
      INSERT INTO agent_runs (
        id, task_id, attempt, status, provider_status, provider, retry_of_run_id,
        recovery_of_run_id, timeout_ms, max_budget_usd, created_at, source_event_seq
      ) VALUES (?, ?, ?, 'queued', 'not_run', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      taskId,
      attempt,
      providerKind(),
      input.retryOfRunId ?? null,
      input.recoveryOfRunId ?? null,
      timeoutMs,
      maxBudgetUsd,
      now,
      event.seq,
    );
    const changed = db.prepare(`
      UPDATE tasks SET status = 'running', current_run_id = ?, provider_status = 'not_run',
        error_code = NULL, error_message = NULL, blocking_reasons_json = ?, updated_at = ?,
        row_version = row_version + 1
      WHERE id = ? AND row_version = ? AND status = ?
    `).run(
      runId,
      removeReasonPrefix(removeReasonPrefix(task.blocking_reasons_json, "provider_"), "agent_"),
      now,
      taskId,
      task.row_version,
      task.status,
    );
    if (changed.changes !== 1) throw conflict("task_changed", "The task changed while the run was queued.");
  });

  const promise = executeRun(taskId, runId, input).finally(() => backgroundRuns.delete(runId));
  backgroundRuns.set(runId, promise);
  void promise.catch((error) => console.error(`[run ${runId}] terminal handler failed`, error));
  return { runId };
}

async function executeRun(taskId: string, runId: string, input: StartRunInput): Promise<void> {
  let task = taskOrThrow(taskId);
  const run = db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(runId) as AgentRunRow;
  const startedAt = Date.now();
  const started = committedMutation((collector) => {
    const current = db.prepare("SELECT status FROM agent_runs WHERE id = ?").get(runId) as { status: string } | undefined;
    if (current?.status !== "queued") return false;
    const event = recordAuditEvent(collector, {
      eventType: "agent.run.started",
      entityType: "agent_run",
      entityId: runId,
      repositoryId: task.repository_id,
      taskId,
      runId,
      payload: { attempt: run.attempt, worktree_path: task.worktree_path },
      provenance: { kind: "agent_sdk_run", source: "claude_agent_sdk" },
      occurredAt: startedAt,
    });
    db.prepare(`
      UPDATE agent_runs SET status = 'running', started_at = ?, heartbeat_at = ?, provider_status = 'not_run'
      WHERE id = ? AND status = 'queued'
    `).run(startedAt, startedAt, runId);
    void event;
    return true;
  });
  if (!started) return;

  let terminal: SdkRunTerminal;
  try {
    terminal = await executeAgentRun({
      taskId,
      runId,
      cwd: task.worktree_path!,
      prompt: task.prompt,
      model: input.model,
      timeoutMs: run.timeout_ms ?? DEFAULT_RUN_TIMEOUT_MS,
      maxBudgetUsd: run.max_budget_usd ?? DEFAULT_MAX_BUDGET_USD,
      maxTurns: input.maxTurns,
      onMessage(message) {
        const record = message as unknown as Record<string, unknown>;
        const type = typeof record.type === "string" ? record.type : "message";
        const subtype = typeof record.subtype === "string" ? record.subtype : null;
        const now = Date.now();
        appendAuditEvent({
          eventType: `agent.sdk.${type}${subtype ? `.${subtype}` : ""}`,
          entityType: "agent_run",
          entityId: runId,
          repositoryId: task.repository_id,
          taskId,
          runId,
          payload: sdkAuditPayload(message),
          provenance: { kind: "agent_sdk_event", source: "claude_agent_sdk" },
          occurredAt: now,
        });
        db.prepare("UPDATE agent_runs SET heartbeat_at = ? WHERE id = ? AND status = 'running'").run(now, runId);
      },
    });
  } catch (error) {
    if (error instanceof AgentSandboxError) {
      terminal = {
        status: "sandbox_blocked",
        sessionId: null,
        resultSubtype: null,
        costUsd: null,
        numTurns: null,
        durationMs: Date.now() - startedAt,
        usage: null,
        modelUsage: null,
        permissionDenials: [],
        errorCode: error.code,
        errorMessage: error.message,
        rawResult: null,
      };
    } else {
      terminal = {
        status: "crashed",
        sessionId: null,
        resultSubtype: null,
        costUsd: null,
        numTurns: null,
        durationMs: Date.now() - startedAt,
        usage: null,
        modelUsage: null,
        permissionDenials: [],
        errorCode: "agent_runtime_crashed",
        errorMessage: normalizeInspectionError(error),
        rawResult: null,
      };
    }
  }
  await finishRun(taskId, runId, terminal);
}

async function finishRun(taskId: string, runId: string, terminal: SdkRunTerminal): Promise<void> {
  let task = taskOrThrow(taskId);
  if (terminal.status === "succeeded") {
    try {
      await refreshTaskDiff(taskId, runId);
      task = taskOrThrow(taskId);
    } catch (error) {
      terminal = {
        ...terminal,
        status: "crashed",
        errorCode: "diff_capture_failed",
        errorMessage: normalizeInspectionError(error),
      };
    }
  }

  const endedAt = Date.now();
  const providerStatus = terminal.status === "provider_blocked"
    ? "blocked"
    : terminal.status === "sandbox_blocked"
      ? "not_run"
      : terminal.status === "succeeded"
        ? "verified"
        : "failed";
  const accepted = committedMutation((collector) => {
    const current = db.prepare("SELECT status FROM agent_runs WHERE id = ?").get(runId) as { status: string } | undefined;
    if (!current || !ACTIVE_RUN_STATUSES.has(current.status)) return false;
    const event = recordAuditEvent(collector, {
      eventType: `agent.run.${terminal.status}`,
      entityType: "agent_run",
      entityId: runId,
      repositoryId: task.repository_id,
      taskId,
      runId,
      payload: {
        status: terminal.status,
        result_subtype: terminal.resultSubtype,
        session_id: terminal.sessionId,
        cost_usd: terminal.costUsd,
        num_turns: terminal.numTurns,
        duration_ms: terminal.durationMs,
        error_code: terminal.errorCode,
        error_message: terminal.errorMessage,
      },
      provenance: { kind: "agent_sdk_terminal", source: "claude_agent_sdk" },
      occurredAt: endedAt,
    });
    const changed = db.prepare(`
      UPDATE agent_runs SET status = ?, provider_status = ?, sdk_session_id = ?, sdk_result_subtype = ?,
        heartbeat_at = ?, ended_at = ?, cost_usd = ?, num_turns = ?, duration_ms = ?, usage_json = ?,
        model_usage_json = ?, permission_denials_json = ?, error_code = ?, error_message = ?, terminal_event_seq = ?
      WHERE id = ? AND status IN ('queued', 'running')
    `).run(
      terminal.status,
      providerStatus,
      terminal.sessionId,
      terminal.resultSubtype,
      endedAt,
      endedAt,
      terminal.costUsd,
      terminal.numTurns,
      terminal.durationMs,
      terminal.usage === null ? null : stringifyJson(terminal.usage),
      terminal.modelUsage === null ? null : stringifyJson(terminal.modelUsage),
      stringifyJson(terminal.permissionDenials ?? []),
      terminal.errorCode,
      terminal.errorMessage,
      event.seq,
      runId,
    );
    return changed.changes === 1;
  });
  if (!accepted) return;

  if (terminal.status === "succeeded") {
    committedMutation((collector) => {
      const changed = db.prepare(`
        UPDATE tasks SET status = 'review_pending', review_status = 'pending', provider_status = 'verified',
          total_cost_usd = ?, num_turns = ?, duration_ms = ?, error_code = NULL, error_message = NULL,
          updated_at = ?, row_version = row_version + 1
        WHERE id = ? AND current_run_id = ? AND status = 'running'
      `).run(terminal.costUsd, terminal.numTurns, terminal.durationMs, Date.now(), taskId, runId);
      if (changed.changes !== 1) return;
      recordAuditEvent(collector, {
        eventType: "task.review_pending",
        entityType: "task",
        entityId: taskId,
        repositoryId: task.repository_id,
        taskId,
        runId,
        payload: { diff_digest: task.current_diff_digest },
        provenance: { kind: "state_transition", source: "domain" },
      });
    });
    return;
  }

  task = taskOrThrow(taskId);
  const taskStatus = terminal.status === "provider_blocked" || terminal.status === "sandbox_blocked"
    ? "blocked"
    : terminal.status === "cancelled"
      ? "cancelled"
      : terminal.status === "crashed"
        ? "recovery_required"
        : "failed";
  const reason = terminal.status === "provider_blocked"
    ? "provider_auth_blocked"
    : terminal.status === "sandbox_blocked"
      ? "agent_sandbox_unavailable"
      : `agent_${terminal.status}`;
  committedMutation((collector) => {
    const changed = db.prepare(`
      UPDATE tasks SET status = ?, provider_status = ?, blocking_reasons_json = ?, total_cost_usd = ?,
        num_turns = ?, duration_ms = ?, error_code = ?, error_message = ?, updated_at = ?, row_version = row_version + 1
      WHERE id = ? AND current_run_id = ? AND status = 'running'
    `).run(
      taskStatus,
      providerStatus,
      addReason(task.blocking_reasons_json, reason),
      terminal.costUsd,
      terminal.numTurns,
      terminal.durationMs,
      terminal.errorCode,
      terminal.errorMessage,
      Date.now(),
      taskId,
      runId,
    );
    if (changed.changes !== 1) return;
    recordAuditEvent(collector, {
      eventType: `task.${taskStatus}`,
      entityType: "task",
      entityId: taskId,
      repositoryId: task.repository_id,
      taskId,
      runId,
      payload: { reason, error_code: terminal.errorCode, error_message: terminal.errorMessage },
      provenance: { kind: "state_transition", source: "domain" },
    });
  });
}

function snapshotDigest(snapshot: DiffSnapshotShape): string {
  const digest = snapshot.digest ?? snapshot.patchDigest ?? snapshot.patch_digest;
  if (!digest) throw new Error("diff capture returned no digest");
  return digest;
}

function snapshotPaths(snapshot: DiffSnapshotShape): string[] {
  return snapshot.changedPaths ?? snapshot.changed_paths ?? [];
}

function persistSnapshot(task: TaskRow, runId: string | null, snapshot: DiffSnapshotShape): void {
  const digest = snapshotDigest(snapshot);
  const changedPaths = snapshotPaths(snapshot);
  const now = Date.now();
  committedMutation((collector) => {
    for (const artifact of snapshot.artifacts) {
      const id = crypto.randomUUID();
      const metadata = { ...(artifact.metadata ?? {}), changed_paths: changedPaths, diff_digest: digest };
      const event = recordAuditEvent(collector, {
        eventType: "task.artifact.created",
        entityType: "artifact",
        entityId: id,
        repositoryId: task.repository_id,
        taskId: task.id,
        runId,
        payload: {
          kind: artifact.kind,
          path: artifact.path,
          sha256: artifact.sha256,
          size_bytes: artifact.sizeBytes ?? artifact.size_bytes,
          metadata,
        },
        provenance: { kind: "git_artifact", source: "git_diff", digest: artifact.sha256 },
        occurredAt: now,
      });
      db.prepare(`
        INSERT INTO artifacts (
          id, task_id, run_id, kind, path, media_type, size_bytes, sha256,
          metadata_json, created_at, source_event_seq
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        task.id,
        runId,
        artifact.kind,
        artifact.path,
        artifact.mediaType ?? artifact.media_type ?? "application/octet-stream",
        artifact.sizeBytes ?? artifact.size_bytes ?? 0,
        artifact.sha256,
        stringifyJson(metadata),
        now,
        event.seq,
      );
    }
    const reviewStale = task.approved_diff_digest !== null && task.approved_diff_digest !== digest;
    db.prepare(`
      UPDATE tasks SET current_diff_digest = ?, review_status = CASE WHEN ? THEN 'stale' ELSE review_status END,
        approved_diff_digest = CASE WHEN ? THEN NULL ELSE approved_diff_digest END,
        updated_at = ?, row_version = row_version + 1 WHERE id = ?
    `).run(digest, reviewStale ? 1 : 0, reviewStale ? 1 : 0, now, task.id);
    if (reviewStale) {
      recordAuditEvent(collector, {
        eventType: "task.review.stale",
        entityType: "task",
        entityId: task.id,
        repositoryId: task.repository_id,
        taskId: task.id,
        payload: { approved_diff_digest: task.approved_diff_digest, current_diff_digest: digest },
        provenance: { kind: "diff_digest_mismatch", source: "git_diff" },
        occurredAt: now,
      });
    }
    detectDiffOverlaps(collector, task, changedPaths, now);
  });
}

function detectDiffOverlaps(collector: EventCollector, task: TaskRow, changedPaths: string[], now: number): void {
  if (changedPaths.length === 0) return;
  const rows = db.prepare(`
    SELECT task.id AS task_id, artifact.metadata_json
    FROM tasks task
    JOIN artifacts artifact ON artifact.id = (
      SELECT inner_artifact.id FROM artifacts inner_artifact
      WHERE inner_artifact.task_id = task.id AND inner_artifact.kind = 'manifest'
      ORDER BY inner_artifact.created_at DESC, inner_artifact.id DESC LIMIT 1
    )
    WHERE task.repository_id = ? AND task.id <> ?
      AND task.status NOT IN ('harvested', 'wilted', 'cancelled')
  `).all(task.repository_id, task.id) as Array<{ task_id: string; metadata_json: string }>;
  for (const row of rows) {
    const otherPaths = parseJson<Record<string, unknown>>(row.metadata_json, {}).changed_paths;
    if (!Array.isArray(otherPaths)) continue;
    for (const changedPath of changedPaths) {
      const otherPath = otherPaths.find((candidate): candidate is string => typeof candidate === "string" && pathsOverlap(candidate, changedPath));
      if (!otherPath) continue;
      createOverlapEvidence(collector, {
        repositoryId: task.repository_id,
        taskId: task.id,
        otherTaskId: row.task_id,
        overlapPath: changedPath,
        evidenceType: "diff",
        blocking: true,
        details: { other_path: otherPath },
        now,
      });
    }
  }
}

export async function refreshTaskDiff(taskId: string, runId: string | null = null): Promise<DiffSnapshotShape> {
  const task = taskOrThrow(taskId);
  if (!task.worktree_path || !task.base_commit) throw conflict("worktree_missing", "The task has no usable worktree.");
  const repository = repositoryOrThrow(task.repository_id);
  const health = await worktreeHealth({
    repoRoot: repository.root_path,
    worktreePath: task.worktree_path,
    baseCommit: task.base_commit,
    ...(task.branch_name ? { expectedBranch: task.branch_name } : {}),
  });
  if (!health.exists || !health.registered) {
    throw conflict("worktree_missing", "The task worktree is missing or no longer registered.", {
      exists: health.exists,
      registered: health.registered,
      reasons: health.reasons,
    });
  }
  if (!task.branch_name || health.branchName !== task.branch_name) {
    throw conflict("worktree_mismatch", "The registered worktree no longer belongs to this task branch.", {
      expected_branch: task.branch_name,
      actual_branch: health.branchName,
      reasons: health.reasons,
    });
  }
  const activeRun = db.prepare(`
    SELECT 1 FROM agent_runs WHERE task_id = ? AND status IN ('queued', 'running') LIMIT 1
  `).get(taskId);
  if (activeRun) throw conflict("run_active", "Diff capture is unavailable while the agent run is active.");
  const captureId = crypto.randomUUID();
  const artifactDir = path.join(ARTIFACTS_DIR, taskId, captureId);
  const snapshot = await captureTaskDiff({
    worktreePath: task.worktree_path,
    baseCommit: task.base_commit,
    artifactDir,
    taskId,
    ...(runId ? { runId } : {}),
  }) as DiffSnapshotShape;
  persistSnapshot(task, runId, snapshot);
  return snapshot;
}

export async function cancelRunForTask(taskId: string, runId?: string | null): Promise<{ cancelled: boolean }> {
  const task = taskOrThrow(taskId);
  const target = runId ?? task.current_run_id;
  if (!target) throw conflict("run_not_active", "The task has no active run.");
  const run = db.prepare("SELECT * FROM agent_runs WHERE id = ? AND task_id = ?").get(target, taskId) as AgentRunRow | undefined;
  if (!run || !ACTIVE_RUN_STATUSES.has(run.status)) throw conflict("run_not_active", "The run is not active.", { run_id: target });
  const cancelled = await cancelAgentRun(target);
  appendAuditEvent({
    eventType: "agent.run.cancel_requested",
    entityType: "agent_run",
    entityId: target,
    repositoryId: task.repository_id,
    taskId,
    runId: target,
    actor: "human",
    payload: { runtime_interrupt_delivered: cancelled },
    provenance: { kind: "human_confirmation", source: "http_api" },
  });
  return { cancelled };
}

export async function submitReview(
  taskId: string,
  decision: "approved" | "rejected",
  rawDiffDigest: unknown,
  rawSummary: unknown,
  reviewer: string,
): Promise<void> {
  const taskBefore = taskOrThrow(taskId);
  if (!["review_pending", "review_rejected"].includes(taskBefore.status)) {
    throw conflict("review_unavailable", "The task is not awaiting review.", { status: taskBefore.status });
  }
  const requestedDigest = requireString(rawDiffDigest, "diff_digest", { max: 128 });
  const summary = optionalString(rawSummary, "summary", 20_000);
  await refreshTaskDiff(taskId, taskBefore.current_run_id);
  const task = taskOrThrow(taskId);
  if (requestedDigest !== task.current_diff_digest) {
    throw conflict("review_stale", "The reviewed diff digest does not match the current worktree.", {
      requested_diff_digest: requestedDigest,
      current_diff_digest: task.current_diff_digest,
    });
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  committedMutation((collector) => {
    const event = recordAuditEvent(collector, {
      eventType: `task.review.${decision}`,
      entityType: "review",
      entityId: id,
      repositoryId: task.repository_id,
      taskId,
      actor: reviewer,
      payload: { decision, diff_digest: requestedDigest, summary },
      provenance: { kind: "human_review", source: "http_api", digest: requestedDigest },
      occurredAt: now,
    });
    db.prepare(`
      INSERT INTO reviews (id, task_id, decision, diff_digest, summary, reviewer, created_at, source_event_seq)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, taskId, decision, requestedDigest, summary, reviewer, now, event.seq);
    db.prepare(`
      UPDATE tasks SET status = ?, review_status = ?, approved_diff_digest = ?,
        outcome_status = NULL, updated_at = ?, row_version = row_version + 1 WHERE id = ?
    `).run(
      decision === "approved" ? "review_pending" : "review_rejected",
      decision,
      decision === "approved" ? requestedDigest : null,
      now,
      taskId,
    );
  });
}

export interface HarvestEligibility {
  can_harvest: boolean;
  reasons: string[];
  evaluated_at: number;
  provenance: { kind: string; source: string; digest: string | null };
}

export async function harvestEligibility(
  taskId: string,
  observedWorktreeHealth?: WorktreeHealth | null,
): Promise<HarvestEligibility> {
  const task = taskOrThrow(taskId);
  const repository = repositoryOrThrow(task.repository_id);
  const reasons: string[] = [];
  if (task.status !== "review_pending") reasons.push(`status:${task.status}`);
  if (task.review_status !== "approved" || !task.approved_diff_digest) reasons.push("review_not_approved");
  if (!task.current_diff_digest) reasons.push("diff_missing");
  if (task.approved_diff_digest !== task.current_diff_digest) reasons.push("review_stale");
  const dependencies = db.prepare(`
    SELECT dependency.depends_on_task_id AS id, task.status
    FROM task_dependencies dependency JOIN tasks task ON task.id = dependency.depends_on_task_id
    WHERE dependency.task_id = ? AND task.status <> 'harvested'
  `).all(taskId) as Array<{ id: string; status: string }>;
  for (const dependency of dependencies) reasons.push(`dependency_not_harvested:${dependency.id}:${dependency.status}`);
  const overlaps = db.prepare(`
    SELECT id FROM overlap_evidence
    WHERE status = 'open' AND blocking = 1 AND (left_task_id = ? OR right_task_id = ?)
  `).all(taskId, taskId) as Array<{ id: string }>;
  for (const overlap of overlaps) reasons.push(`blocking_overlap:${overlap.id}`);
  if (!task.worktree_path || !task.branch_name || !task.base_commit) {
    reasons.push("worktree_missing");
  } else {
    const health = observedWorktreeHealth ?? await worktreeHealth({
      repoRoot: repository.root_path,
      worktreePath: task.worktree_path,
      baseCommit: task.base_commit,
      expectedBranch: task.branch_name,
    });
    if (!health.exists || !health.registered) reasons.push("worktree_missing");
    if (health.branchName !== task.branch_name) reasons.push(`worktree_branch_mismatch:${health.branchName ?? "detached"}`);
  }
  if (!task.base_branch) {
    reasons.push("base_branch_missing");
  } else {
    try {
      const base = await baseCheckoutHealth({
        repoRoot: repository.root_path,
        baseBranch: task.base_branch,
        ...(task.base_commit ? { requiredAncestor: task.base_commit } : {}),
      });
      for (const reason of base.reasons) reasons.push(`base_checkout:${reason}`);
    } catch (error) {
      reasons.push(`base_checkout:${normalizeInspectionError(error)}`);
    }
  }
  return {
    can_harvest: reasons.length === 0,
    reasons: [...new Set(reasons)],
    evaluated_at: Date.now(),
    provenance: {
      kind: "harvest_gate",
      source: "domain_projection",
      digest: sha256(stringifyJson({ task_id: taskId, reasons })),
    },
  };
}

function acquireRepositoryLock(repositoryId: string, operation: string, taskId: string): string {
  const owner = crypto.randomUUID();
  const now = Date.now();
  return committedMutation((collector) => {
    db.prepare("DELETE FROM operation_locks WHERE repository_id = ? AND expires_at <= ?").run(repositoryId, now);
    try {
      db.prepare(`
        INSERT INTO operation_locks (repository_id, operation, owner, acquired_at, expires_at, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(repositoryId, operation, owner, now, now + LOCK_TTL_MS, stringifyJson({ task_id: taskId }));
    } catch (error) {
      const current = db.prepare("SELECT operation, acquired_at, expires_at FROM operation_locks WHERE repository_id = ?")
        .get(repositoryId);
      throw conflict("repository_locked", "Another repository operation is active.", current ?? normalizeInspectionError(error));
    }
    recordAuditEvent(collector, {
      eventType: "repository.lock.acquired",
      entityType: "operation_lock",
      entityId: owner,
      repositoryId,
      taskId,
      payload: { operation, expires_at: now + LOCK_TTL_MS },
      provenance: { kind: "operation_lock", source: "sqlite" },
      occurredAt: now,
    });
    return owner;
  });
}

function releaseRepositoryLock(repositoryId: string, owner: string, taskId: string): void {
  committedMutation((collector) => {
    const result = db.prepare("DELETE FROM operation_locks WHERE repository_id = ? AND owner = ?").run(repositoryId, owner);
    if (result.changes) {
      recordAuditEvent(collector, {
        eventType: "repository.lock.released",
        entityType: "operation_lock",
        entityId: owner,
        repositoryId,
        taskId,
        payload: {},
        provenance: { kind: "operation_lock", source: "sqlite" },
      });
    }
  });
}

export async function harvestTask(taskId: string): Promise<{ commit: string; cleanup_errors: string[] }> {
  let task = taskOrThrow(taskId);
  const repository = repositoryOrThrow(task.repository_id);
  const owner = acquireRepositoryLock(task.repository_id, "harvest", taskId);
  const operationId = crypto.randomUUID();
  let operationStarted = false;
  let operationCommitted = false;
  let baseMutationStarted = false;
  let preCommit: string | null = null;
  try {
    await refreshTaskDiff(taskId, task.current_run_id);
    task = taskOrThrow(taskId);
    const eligibility = await harvestEligibility(taskId);
    if (!eligibility.can_harvest) {
      throw conflict("harvest_blocked", "The task does not satisfy the harvest gate.", eligibility);
    }
    if (!task.base_branch) throw conflict("base_branch_missing", "The task has no recorded base branch.");
    const baseHealth = await baseCheckoutHealth({
      repoRoot: repository.root_path,
      baseBranch: task.base_branch,
      requiredAncestor: task.base_commit!,
    });
    if (baseHealth.reasons.length > 0 || !baseHealth.headCommit) {
      throw conflict("base_checkout_unsafe", "The base checkout is not safe for harvest.", {
        branch: baseHealth.branchName,
        head_commit: baseHealth.headCommit,
        clean: baseHealth.clean,
        reasons: baseHealth.reasons,
      });
    }
    preCommit = baseHealth.headCommit;
    const now = Date.now();
    committedMutation((collector) => {
      const changed = db.prepare(`
        UPDATE tasks SET status = 'harvesting', pre_harvest_commit = ?, updated_at = ?, row_version = row_version + 1
        WHERE id = ? AND status = 'review_pending' AND review_status = 'approved'
          AND approved_diff_digest = current_diff_digest AND row_version = ?
      `).run(preCommit, now, taskId, task.row_version);
      if (changed.changes !== 1) throw conflict("task_changed", "The task changed before harvest started.");
      const event = recordAuditEvent(collector, {
        eventType: "task.harvest.started",
        entityType: "operation",
        entityId: operationId,
        repositoryId: task.repository_id,
        taskId,
        actor: "human",
        payload: { pre_commit: preCommit, diff_digest: task.current_diff_digest },
        provenance: { kind: "human_confirmation", source: "http_api", digest: task.current_diff_digest },
        occurredAt: now,
      });
      db.prepare(`
        INSERT INTO operation_journal (
          id, repository_id, task_id, operation, state, pre_commit, details_json,
          started_at, updated_at, source_event_seq
        ) VALUES (?, ?, ?, 'harvest', 'started', ?, ?, ?, ?, ?)
      `).run(operationId, task.repository_id, taskId, preCommit, stringifyJson({ diff_digest: task.current_diff_digest }), now, now, event.seq);
      const outcomeId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO outcomes (id, task_id, type, status, operation_id, diff_digest, created_at, source_event_seq)
        VALUES (?, ?, 'harvest', 'started', ?, ?, ?, ?)
      `).run(outcomeId, taskId, operationId, task.current_diff_digest, now, event.seq);
    });
    operationStarted = true;

    const taskCommit = await commitTaskChanges({
      worktreePath: task.worktree_path!,
      baseCommit: task.base_commit!,
      taskId,
      title: task.title,
      expectedDiffDigest: task.approved_diff_digest!,
    });
    db.prepare("UPDATE operation_journal SET state = 'git_applying', updated_at = ? WHERE id = ?")
      .run(Date.now(), operationId);
    baseMutationStarted = true;
    const result = await harvestTaskBranch({
      repoRoot: repository.root_path,
      baseBranch: task.base_branch!,
      branchName: task.branch_name!,
      taskId,
      title: task.title,
      expectedBranchCommit: taskCommit.commit,
      expectedBaseCommit: task.base_commit!,
    });
    db.prepare("UPDATE operation_journal SET state = 'git_applied', post_commit = ?, updated_at = ? WHERE id = ?")
      .run(result.commit, Date.now(), operationId);

    const completedAt = Date.now();
    committedMutation((collector) => {
      const event = recordAuditEvent(collector, {
        eventType: "task.harvest.succeeded",
        entityType: "outcome",
        entityId: operationId,
        repositoryId: task.repository_id,
        taskId,
        actor: "human",
        payload: { commit: result.commit, pre_commit: result.preCommit, diff_digest: task.current_diff_digest },
        provenance: { kind: "git_commit", source: "git", digest: result.commit },
        occurredAt: completedAt,
      });
      db.prepare(`
        UPDATE tasks SET status = 'harvested', outcome_status = 'succeeded', harvest_commit = ?,
          updated_at = ?, row_version = row_version + 1 WHERE id = ? AND status = 'harvesting'
      `).run(result.commit, completedAt, taskId);
      db.prepare(`
        UPDATE operation_journal SET state = 'committed', post_commit = ?, updated_at = ?, details_json = ? WHERE id = ?
      `).run(result.commit, completedAt, stringifyJson({ terminal_event_seq: event.seq }), operationId);
      db.prepare(`
        UPDATE outcomes SET status = 'succeeded', commit_sha = ? WHERE task_id = ? AND operation_id = ? AND type = 'harvest'
      `).run(result.commit, taskId, operationId);
    });
    operationCommitted = true;

    let cleanup: { errors?: unknown[] };
    try {
      cleanup = await removeTaskWorktree({
        repoRoot: repository.root_path,
        worktreePath: task.worktree_path!,
        branchName: task.branch_name!,
      });
    } catch (error) {
      cleanup = { errors: [normalizeInspectionError(error)] };
    }
    const errors = Array.isArray(cleanup.errors) ? cleanup.errors.map(String) : [];
    appendAuditEvent({
      eventType: errors.length ? "task.cleanup.incomplete" : "task.cleanup.completed",
      entityType: "worktree",
      entityId: task.worktree_path!,
      repositoryId: task.repository_id,
      taskId,
      payload: { errors },
      provenance: { kind: "cleanup_proof", source: "git_worktree" },
    });
    await scheduleReadyTasks(task.repository_id);
    return { commit: result.commit, cleanup_errors: errors };
  } catch (error) {
    if (operationStarted && !operationCommitted) {
      const message = normalizeInspectionError(error);
      const current = taskOrThrow(taskId);
      let rollbackError: unknown;
      if (baseMutationStarted && preCommit && task.base_branch) {
        try {
          await restoreBaseRepository({
            repoRoot: repository.root_path,
            preCommit,
            baseBranch: task.base_branch,
            requireClean: true,
          });
        } catch (caught) {
          rollbackError = caught;
        }
      }
      const recoveryMessage = rollbackError === undefined
        ? message
        : `${message}; rollback verification failed: ${normalizeInspectionError(rollbackError)}`;
      committedMutation((collector) => {
        recordAuditEvent(collector, {
          eventType: rollbackError === undefined ? "task.harvest.failed" : "task.harvest.recovery_required",
          entityType: "operation",
          entityId: operationId,
          repositoryId: current.repository_id,
          taskId,
          payload: { error: message, rollback_error: rollbackError === undefined ? null : normalizeInspectionError(rollbackError) },
          provenance: { kind: "git_error", source: "git" },
        });
        db.prepare(`
          UPDATE tasks SET status = ?, outcome_status = 'failed', error_code = ?,
            error_message = ?, updated_at = ?, row_version = row_version + 1
          WHERE id = ? AND status = 'harvesting'
        `).run(
          rollbackError === undefined ? "review_pending" : "recovery_required",
          rollbackError === undefined ? "harvest_failed" : "harvest_recovery_required",
          recoveryMessage,
          Date.now(),
          taskId,
        );
        db.prepare(`
          UPDATE operation_journal SET state = ?, error_message = ?, updated_at = ? WHERE id = ?
        `).run(rollbackError === undefined ? "rolled_back" : "needs_recovery", recoveryMessage, Date.now(), operationId);
        db.prepare(`
          UPDATE outcomes SET status = ?, reason = ?
          WHERE task_id = ? AND operation_id = ? AND type = 'harvest' AND status = 'started'
        `).run(rollbackError === undefined ? "rolled_back" : "failed", recoveryMessage, taskId, operationId);
      });
      if (rollbackError !== undefined) {
        throw conflict("harvest_recovery_required", "Harvest failed and safe rollback could not be proven.", { message: recoveryMessage });
      }
      if (!(error instanceof AppError)) {
        throw conflict("merge_conflict", "Harvest failed and the base repository was rolled back.", { message });
      }
    }
    throw error;
  } finally {
    releaseRepositoryLock(task.repository_id, owner, taskId);
  }
}

interface WiltJournalRow {
  id: string;
  state: string;
  details_json: string;
  error_message: string | null;
}

function wiltReason(journal: WiltJournalRow, fallback: string): string {
  const details = parseJson<Record<string, unknown>>(journal.details_json, {});
  return typeof details.reason === "string" && details.reason.trim() ? details.reason : fallback;
}

async function performWiltCleanup(task: TaskRow, repository: RepositoryRow): Promise<string[]> {
  if (!task.worktree_path || !task.branch_name || !repository.is_git) return [];
  try {
    const cleanup = await removeTaskWorktree({
      repoRoot: repository.root_path,
      worktreePath: task.worktree_path,
      branchName: task.branch_name,
    });
    return Array.isArray(cleanup.errors) ? cleanup.errors.map(String) : [];
  } catch (error) {
    return [normalizeInspectionError(error)];
  }
}

function finalizeWilt(
  task: TaskRow,
  operationId: string,
  reason: string,
  errors: string[],
  actor: string,
  provenanceKind: string,
): void {
  const completedAt = Date.now();
  committedMutation((collector) => {
    const currentJournal = db.prepare("SELECT state FROM operation_journal WHERE id = ?").get(operationId) as { state: string } | undefined;
    if (!currentJournal || currentJournal.state === "committed") return;
    const event = recordAuditEvent(collector, {
      eventType: errors.length ? "task.wilt.cleanup_failed" : "task.wilt.succeeded",
      entityType: "outcome",
      entityId: operationId,
      repositoryId: task.repository_id,
      taskId: task.id,
      actor,
      payload: { reason, cleanup_errors: errors },
      provenance: { kind: provenanceKind, source: "git_worktree" },
      occurredAt: completedAt,
    });
    db.prepare(`
      UPDATE tasks SET status = ?, outcome_status = ?, error_code = ?, error_message = ?,
        updated_at = ?, row_version = row_version + 1
      WHERE id = ? AND status IN ('wilting', 'recovery_required')
    `).run(
      errors.length ? "recovery_required" : "wilted",
      errors.length ? "failed" : "succeeded",
      errors.length ? "cleanup_failed" : null,
      errors.length ? errors.join("; ") : null,
      completedAt,
      task.id,
    );
    db.prepare(`
      UPDATE operation_journal SET state = ?, error_message = ?, updated_at = ?, details_json = ?
      WHERE id = ? AND operation = 'wilt' AND state IN ('started', 'needs_recovery')
    `).run(
      errors.length ? "needs_recovery" : "committed",
      errors.length ? errors.join("; ") : null,
      completedAt,
      stringifyJson({ reason, terminal_event_seq: event.seq, cleanup_errors: errors }),
      operationId,
    );
    db.prepare(`
      UPDATE outcomes SET status = ?, reason = ?
      WHERE task_id = ? AND operation_id = ? AND type = 'wilt' AND status IN ('started', 'failed')
    `).run(errors.length ? "failed" : "succeeded", reason, task.id, operationId);
  });
}

export async function wiltTask(taskId: string, rawReason: unknown): Promise<{ cleanup_errors: string[] }> {
  let task = taskOrThrow(taskId);
  if (task.status === "harvested") throw conflict("task_harvested", "A harvested task cannot be wilted.");
  if (task.status === "wilted") return { cleanup_errors: [] };
  const reason = optionalString(rawReason, "reason", 20_000) ?? "Wilt confirmed by human operator.";
  const repository = repositoryOrThrow(task.repository_id);
  const owner = acquireRepositoryLock(task.repository_id, "wilt", taskId);
  try {
  let journal = db.prepare(`
    SELECT id, state, details_json, error_message FROM operation_journal
    WHERE task_id = ? AND operation = 'wilt' AND state IN ('started', 'needs_recovery')
    ORDER BY started_at DESC, id DESC LIMIT 1
  `).get(taskId) as WiltJournalRow | undefined;
  let operationId = journal?.id ?? crypto.randomUUID();
    if (journal) {
      if (!['wilting', 'recovery_required'].includes(task.status)) {
        throw conflict("invalid_task_state", "Task has an open wilt operation but is not recoverable from its current state.", {
          status: task.status,
          operation_id: journal.id,
        });
      }
      const retryAt = Date.now();
      const retryReason = wiltReason(journal, reason);
      committedMutation((collector) => {
        const event = recordAuditEvent(collector, {
          eventType: "task.wilt.retry_started",
          entityType: "operation",
          entityId: journal!.id,
          repositoryId: task.repository_id,
          taskId,
          actor: "human",
          payload: { reason: retryReason, prior_state: journal!.state, prior_error: journal!.error_message },
          provenance: { kind: "human_recovery", source: "http_api" },
          occurredAt: retryAt,
        });
        db.prepare(`
          UPDATE tasks SET status = 'wilting', error_code = NULL, error_message = NULL,
            updated_at = ?, row_version = row_version + 1
          WHERE id = ? AND status = 'recovery_required'
        `).run(retryAt, taskId);
        db.prepare(`
          UPDATE operation_journal SET state = 'started', error_message = NULL, updated_at = ?, details_json = ?
          WHERE id = ? AND state = 'needs_recovery'
        `).run(retryAt, stringifyJson({ reason: retryReason, retry_event_seq: event.seq }), journal!.id);
        db.prepare(`
          UPDATE outcomes SET status = 'started', reason = ?
          WHERE task_id = ? AND operation_id = ? AND type = 'wilt' AND status = 'failed'
        `).run(retryReason, taskId, journal!.id);
      });
      journal = { ...journal, state: "started", details_json: stringifyJson({ reason: retryReason }), error_message: null };
      task = taskOrThrow(taskId);
    } else {
      const now = Date.now();
      committedMutation((collector) => {
        const changed = db.prepare(`
          UPDATE tasks SET status = 'wilting', updated_at = ?, row_version = row_version + 1
          WHERE id = ? AND status NOT IN ('harvested', 'wilted', 'wilting')
        `).run(now, taskId);
        if (changed.changes !== 1) throw conflict("invalid_task_state", "Task cannot enter wilting state.", { status: task.status });
        const event = recordAuditEvent(collector, {
          eventType: "task.wilt.started",
          entityType: "operation",
          entityId: operationId,
          repositoryId: task.repository_id,
          taskId,
          actor: "human",
          payload: { reason },
          provenance: { kind: "human_confirmation", source: "http_api" },
          occurredAt: now,
        });
        db.prepare(`
          INSERT INTO operation_journal (
            id, repository_id, task_id, operation, state, details_json,
            started_at, updated_at, source_event_seq
          ) VALUES (?, ?, ?, 'wilt', 'started', ?, ?, ?, ?)
        `).run(operationId, task.repository_id, taskId, stringifyJson({ reason }), now, now, event.seq);
        db.prepare(`
          INSERT INTO outcomes (id, task_id, type, status, operation_id, reason, created_at, source_event_seq)
          VALUES (?, ?, 'wilt', 'started', ?, ?, ?, ?)
        `).run(crypto.randomUUID(), taskId, operationId, reason, now, event.seq);
      });
    }
    if (task.current_run_id) await cancelAgentRun(task.current_run_id);
    const persistedReason = journal ? wiltReason(journal, reason) : reason;
    task = taskOrThrow(taskId);
    const errors = await performWiltCleanup(task, repository);
    finalizeWilt(task, operationId, persistedReason, errors, "human", "cleanup_proof");
    return { cleanup_errors: errors };
  } finally {
    releaseRepositoryLock(task.repository_id, owner, taskId);
  }
}

export async function recoverRun(taskId: string, priorRunId?: string | null, options: StartRunInput = {}): Promise<{ runId: string }> {
  const task = taskOrThrow(taskId);
  const runId = priorRunId ?? task.current_run_id;
  if (!runId) throw conflict("recovery_run_missing", "No prior run is available for recovery.");
  const prior = db.prepare("SELECT status FROM agent_runs WHERE id = ? AND task_id = ?").get(runId, taskId) as { status: string } | undefined;
  if (!prior || ACTIVE_RUN_STATUSES.has(prior.status)) throw conflict("recovery_unavailable", "The prior run is not recoverable.");
  return startTaskRun(taskId, { ...options, recoveryOfRunId: runId });
}

export async function retryRun(taskId: string, priorRunId?: string | null, options: StartRunInput = {}): Promise<{ runId: string }> {
  const task = taskOrThrow(taskId);
  const runId = priorRunId ?? task.current_run_id;
  if (!runId) throw conflict("retry_run_missing", "No prior run is available for retry.");
  const prior = db.prepare("SELECT status FROM agent_runs WHERE id = ? AND task_id = ?").get(runId, taskId) as { status: string } | undefined;
  if (!prior || ACTIVE_RUN_STATUSES.has(prior.status)) throw conflict("retry_unavailable", "The prior run is not retryable.");
  return startTaskRun(taskId, { ...options, retryOfRunId: runId });
}

export async function reconcileOnStartup(): Promise<{ reconciled: number; recovery_required: number }> {
  let reconciled = 0;
  let recoveryRequired = 0;
  db.prepare("DELETE FROM operation_locks").run();
  const interruptedRuns = db.prepare(`
    SELECT run.id, run.task_id, task.repository_id
    FROM agent_runs run JOIN tasks task ON task.id = run.task_id
    WHERE run.status IN ('queued', 'running')
  `).all() as Array<{ id: string; task_id: string; repository_id: string }>;
  for (const run of interruptedRuns) {
    committedMutation((collector) => {
      const event = recordAuditEvent(collector, {
        eventType: "agent.run.crashed",
        entityType: "agent_run",
        entityId: run.id,
        repositoryId: run.repository_id,
        taskId: run.task_id,
        runId: run.id,
        payload: { reason: "server_restart", resumable_session_proven: false },
        provenance: { kind: "restart_reconciliation", source: "sqlite" },
      });
      db.prepare(`
        UPDATE agent_runs SET status = 'crashed', provider_status = 'failed', ended_at = ?,
          error_code = 'server_restart', error_message = 'Server restarted before a durable SDK result.', terminal_event_seq = ?
        WHERE id = ? AND status IN ('queued', 'running')
      `).run(Date.now(), event.seq, run.id);
      db.prepare(`
        UPDATE tasks SET status = 'recovery_required', error_code = 'server_restart',
          error_message = 'The prior SDK run cannot be resumed without explicit recovery.',
          blocking_reasons_json = CASE
            WHEN NOT EXISTS (SELECT 1 FROM json_each(blocking_reasons_json) WHERE value = 'agent_run_crashed')
            THEN json_insert(blocking_reasons_json, '$[#]', 'agent_run_crashed')
            ELSE blocking_reasons_json END,
          updated_at = ?, row_version = row_version + 1
        WHERE id = ? AND current_run_id = ? AND status = 'running'
      `).run(Date.now(), run.task_id, run.id);
    });
    recoveryRequired += 1;
  }

  const preparingTasks = db.prepare(`
    SELECT task.id, task.repository_id, task.base_commit, task.worktree_path, task.branch_name, repository.root_path
    FROM tasks task JOIN repositories repository ON repository.id = task.repository_id
    WHERE task.status = 'preparing'
  `).all() as Array<{
    id: string;
    repository_id: string;
    base_commit: string | null;
    worktree_path: string | null;
    branch_name: string | null;
    root_path: string;
  }>;
  for (const task of preparingTasks) {
    const expectedPath = task.worktree_path ?? path.join(WORKTREES_DIR, task.id);
    const expectedBranch = task.branch_name ?? `agent-farm/${task.id}`;
    try {
      const registered = (await listRegisteredWorktrees(task.root_path)).find(
        (entry) => path.resolve(entry.worktreePath) === path.resolve(expectedPath),
      );
      const matches = Boolean(
        registered &&
        registered.branchName === expectedBranch &&
        task.base_commit &&
        registered.headCommit === task.base_commit,
      );
      if (!matches) throw new Error("No exact registered worktree matches the interrupted prepare operation.");
      committedMutation((collector) => {
        const event = recordAuditEvent(collector, {
          eventType: "task.worktree.reconciled",
          entityType: "worktree",
          entityId: expectedPath,
          repositoryId: task.repository_id,
          taskId: task.id,
          payload: { worktree_path: expectedPath, branch_name: expectedBranch, base_commit: task.base_commit },
          provenance: { kind: "restart_reconciliation", source: "git_worktree_registry", digest: task.base_commit },
        });
        db.prepare(`
          UPDATE tasks SET status = 'seeded', branch_name = ?, worktree_path = ?,
            error_code = NULL, error_message = NULL, updated_at = ?, row_version = row_version + 1
          WHERE id = ? AND status = 'preparing'
        `).run(expectedBranch, expectedPath, Date.now(), task.id);
        db.prepare(`
          UPDATE operation_journal SET state = 'committed', updated_at = ?, details_json = ?
          WHERE task_id = ? AND operation = 'prepare' AND state = 'started'
        `).run(Date.now(), stringifyJson({ reconciliation_event_seq: event.seq }), task.id);
      });
      reconciled += 1;
    } catch (error) {
      const message = normalizeInspectionError(error);
      committedMutation((collector) => {
        recordAuditEvent(collector, {
          eventType: "task.recovery_required",
          entityType: "task",
          entityId: task.id,
          repositoryId: task.repository_id,
          taskId: task.id,
          payload: { reason: "worktree_prepare_interrupted", evidence: message },
          provenance: { kind: "restart_reconciliation", source: "sqlite+git_worktree_registry" },
        });
        db.prepare(`
          UPDATE tasks SET status = 'recovery_required', error_code = 'prepare_interrupted',
            error_message = ?, blocking_reasons_json = CASE
              WHEN NOT EXISTS (SELECT 1 FROM json_each(blocking_reasons_json) WHERE value = 'worktree_prepare_interrupted')
              THEN json_insert(blocking_reasons_json, '$[#]', 'worktree_prepare_interrupted')
              ELSE blocking_reasons_json END,
            updated_at = ?, row_version = row_version + 1
          WHERE id = ? AND status = 'preparing'
        `).run(`Server restarted while preparing the worktree: ${message}`, Date.now(), task.id);
        db.prepare(`
          UPDATE operation_journal SET state = 'needs_recovery', error_message = ?, updated_at = ?
          WHERE task_id = ? AND operation = 'prepare' AND state = 'started'
        `).run(message, Date.now(), task.id);
      });
      recoveryRequired += 1;
    }
  }

  const wiltJournals = db.prepare(`
    SELECT journal.id, journal.repository_id, journal.task_id, journal.state, journal.details_json,
      journal.error_message, repository.root_path, repository.is_git
    FROM operation_journal journal
    JOIN repositories repository ON repository.id = journal.repository_id
    JOIN tasks task ON task.id = journal.task_id
    WHERE journal.operation = 'wilt' AND journal.state IN ('started', 'needs_recovery')
      AND task.status IN ('wilting', 'recovery_required')
  `).all() as Array<WiltJournalRow & {
    repository_id: string;
    task_id: string;
    root_path: string;
    is_git: number;
  }>;
  for (const journal of wiltJournals) {
    const task = taskOrThrow(journal.task_id);
    const repository = repositoryOrThrow(task.repository_id);
    const reason = wiltReason(journal, "Wilt interrupted by server restart.");
    const errors = await performWiltCleanup(task, repository);
    finalizeWilt(task, journal.id, reason, errors, "system", "restart_reconciliation");
    if (errors.length > 0) recoveryRequired += 1;
    else reconciled += 1;
  }

  const journals = db.prepare(`
    SELECT journal.*, repository.root_path, task.base_branch, task.worktree_path, task.branch_name
    FROM operation_journal journal
    JOIN repositories repository ON repository.id = journal.repository_id
    JOIN tasks task ON task.id = journal.task_id
    WHERE journal.operation = 'harvest' AND journal.state IN ('started', 'git_applying', 'git_applied', 'needs_recovery')
  `).all() as Array<{
    id: string;
    repository_id: string;
    task_id: string;
    state: string;
    pre_commit: string | null;
    post_commit: string | null;
    root_path: string;
    base_branch: string | null;
    worktree_path: string | null;
    branch_name: string | null;
  }>;
  for (const journal of journals) {
    try {
      const landedCommit = await findTaskHarvestCommit({
        repoRoot: journal.root_path,
        taskId: journal.task_id,
        ...(journal.base_branch ? { baseBranch: journal.base_branch } : {}),
        ...(journal.pre_commit ? { afterCommit: journal.pre_commit } : {}),
      });
      if (landedCommit) {
        committedMutation((collector) => {
          const event = recordAuditEvent(collector, {
            eventType: "task.harvest.reconciled",
            entityType: "outcome",
            entityId: journal.id,
            repositoryId: journal.repository_id,
            taskId: journal.task_id,
            payload: { commit: landedCommit, prior_journal_state: journal.state },
            provenance: { kind: "git_commit_trailer", source: "git", digest: landedCommit },
          });
          const taskChanged = db.prepare(`
            UPDATE tasks SET status = 'harvested', outcome_status = 'confirmed', harvest_commit = ?,
              updated_at = ?, row_version = row_version + 1
            WHERE id = ? AND status IN ('harvesting', 'recovery_required') AND harvest_commit IS NULL
          `).run(landedCommit, Date.now(), journal.task_id);
          const journalChanged = db.prepare(`
            UPDATE operation_journal SET state = 'committed', post_commit = ?, updated_at = ?, details_json = ?
            WHERE id = ? AND state IN ('started', 'git_applying', 'git_applied', 'needs_recovery')
          `).run(landedCommit, Date.now(), stringifyJson({ reconciliation_event_seq: event.seq }), journal.id);
          const outcomeChanged = db.prepare(`
            UPDATE outcomes SET status = 'confirmed', commit_sha = ?
            WHERE task_id = ? AND operation_id = ? AND type = 'harvest' AND status IN ('started', 'failed')
          `).run(landedCommit, journal.task_id, journal.id);
          if (taskChanged.changes !== 1 || journalChanged.changes !== 1 || outcomeChanged.changes !== 1) {
            throw new Error("harvest reconciliation refused a double-terminal or mismatched operation state");
          }
        });
        if (journal.worktree_path && journal.branch_name) {
          try {
            const cleanup = await removeTaskWorktree({
              repoRoot: journal.root_path,
              worktreePath: journal.worktree_path,
              branchName: journal.branch_name,
            });
            if (cleanup.errors.length > 0) {
              appendAuditEvent({
                eventType: "task.cleanup.incomplete",
                entityType: "worktree",
                entityId: journal.worktree_path,
                repositoryId: journal.repository_id,
                taskId: journal.task_id,
                payload: { errors: cleanup.errors, reconciled_commit: landedCommit },
                provenance: { kind: "restart_reconciliation", source: "git_worktree" },
              });
            }
          } catch (error) {
            appendAuditEvent({
              eventType: "task.cleanup.incomplete",
              entityType: "worktree",
              entityId: journal.worktree_path,
              repositoryId: journal.repository_id,
              taskId: journal.task_id,
              payload: { errors: [normalizeInspectionError(error)], reconciled_commit: landedCommit },
              provenance: { kind: "restart_reconciliation", source: "git_worktree" },
            });
          }
        }
        reconciled += 1;
      } else if (journal.pre_commit && journal.base_branch) {
        await restoreBaseRepository({
          repoRoot: journal.root_path,
          preCommit: journal.pre_commit,
          baseBranch: journal.base_branch,
          requireClean: true,
        });
        committedMutation((collector) => {
          recordAuditEvent(collector, {
            eventType: "task.harvest.rolled_back_on_restart",
            entityType: "operation",
            entityId: journal.id,
            repositoryId: journal.repository_id,
            taskId: journal.task_id,
            payload: { pre_commit: journal.pre_commit, prior_journal_state: journal.state },
            provenance: { kind: "restart_reconciliation", source: "git" },
          });
          const taskChanged = db.prepare(`
            UPDATE tasks SET status = 'review_pending', outcome_status = 'rolled_back', updated_at = ?,
              row_version = row_version + 1
            WHERE id = ? AND status IN ('harvesting', 'recovery_required') AND harvest_commit IS NULL
          `).run(Date.now(), journal.task_id);
          const journalChanged = db.prepare(`
            UPDATE operation_journal SET state = 'rolled_back', updated_at = ?
            WHERE id = ? AND state IN ('started', 'git_applying', 'git_applied', 'needs_recovery')
          `).run(Date.now(), journal.id);
          const outcomeChanged = db.prepare(`
            UPDATE outcomes SET status = 'rolled_back'
            WHERE task_id = ? AND operation_id = ? AND type = 'harvest' AND status IN ('started', 'failed')
          `).run(journal.task_id, journal.id);
          if (taskChanged.changes !== 1 || journalChanged.changes !== 1 || outcomeChanged.changes !== 1) {
            throw new Error("harvest rollback reconciliation refused a double-terminal or mismatched operation state");
          }
        });
        reconciled += 1;
      } else {
        throw new Error("operation journal lacks a recoverable pre-commit");
      }
    } catch (error) {
      const message = normalizeInspectionError(error);
      committedMutation((collector) => {
        recordAuditEvent(collector, {
          eventType: "task.reconciliation.failed",
          entityType: "operation",
          entityId: journal.id,
          repositoryId: journal.repository_id,
          taskId: journal.task_id,
          payload: { error: message },
          provenance: { kind: "restart_reconciliation", source: "git" },
        });
        db.prepare(`
          UPDATE tasks SET status = 'recovery_required', outcome_status = 'failed',
            error_code = 'reconciliation_failed', error_message = ?, updated_at = ?, row_version = row_version + 1
          WHERE id = ? AND status NOT IN ('harvested', 'wilted', 'cancelled')
        `).run(message, Date.now(), journal.task_id);
        db.prepare("UPDATE operation_journal SET state = 'needs_recovery', error_message = ?, updated_at = ? WHERE id = ?")
          .run(message, Date.now(), journal.id);
        db.prepare(`
          UPDATE outcomes SET status = 'failed', reason = ?
          WHERE task_id = ? AND operation_id = ? AND type = 'harvest' AND status = 'started'
        `).run(message, journal.task_id, journal.id);
      });
      recoveryRequired += 1;
    }
  }

  appendAuditEvent({
    eventType: "server.reconciliation.completed",
    entityType: "server",
    entityId: "startup",
    payload: { reconciled, recovery_required: recoveryRequired },
    provenance: { kind: "restart_reconciliation", source: "server_startup" },
  });
  await cleanupOrphanedWorkspaceSandboxes(activeSandboxRunDirs());
  return { reconciled, recovery_required: recoveryRequired };
}

export function activeBackgroundRuns(): number {
  return backgroundRuns.size;
}

export async function waitForBackgroundRuns(timeoutMs = 10_000): Promise<void> {
  const active = [...backgroundRuns.values()];
  if (active.length === 0) return;
  await Promise.race([
    Promise.allSettled(active),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function ensureArtifactReadable(artifactPath: string): Promise<void> {
  const canonicalRoot = path.resolve(ARTIFACTS_DIR) + path.sep;
  const canonicalArtifact = path.resolve(artifactPath);
  if (!canonicalArtifact.startsWith(canonicalRoot)) throw conflict("unsafe_artifact_path", "Artifact path escapes the data directory.");
  await fs.access(canonicalArtifact);
}
