import crypto from "node:crypto";
import fs from "node:fs/promises";
import { TextDecoder } from "node:util";
import type { Request, Response } from "express";
import { db, parseJson } from "./db.js";
import {
  addDependency,
  addPathClaim,
  cancelRunForTask,
  harvestEligibility,
  harvestTask,
  recoverRun,
  refreshTaskDiff,
  releasePathClaim,
  removeDependency,
  resolveOverlap,
  retryRun,
  seedTask,
  startTaskRun,
  submitReview,
  wiltTask,
  type StartRunInput,
} from "./domain.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { inspectRepository, worktreeHealth } from "./git.js";
import { eventsAfter, lastEventSeq } from "./ledger.js";
import {
  getPatchArtifact,
  getRepositoryRow,
  getTaskArtifacts,
  getTaskRow,
  listTaskSummaries,
  taskDetailBase,
  taskSummary,
  type RepositoryObservation,
  type TaskRow,
} from "./projections.js";
import { nonNegativeInteger, optionalString, positiveNumber, requireString } from "./validation.js";
import {
  generateResidualBenchmark,
  getLatestResidualBenchmark,
  taskResidualHealth,
} from "./benchmark.js";

function body(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
}

function taskId(req: Request): string {
  return requireString(req.params.id, "task_id", { max: 128 });
}

function decodeUtf8(bytes: Buffer, context: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw conflict("diff_artifact_invalid_utf8", `The persisted ${context} is not valid UTF-8.`);
  }
}

function utf8Prefix(bytes: Buffer, maxBytes: number): string {
  let end = Math.min(bytes.byteLength, maxBytes);
  while (end > 0) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, end));
    } catch {
      end -= 1;
    }
  }
  return "";
}

function runOptions(req: Request): StartRunInput {
  const input = body(req);
  const timeoutMs = positiveNumber(input.timeout_ms, "timeout_ms");
  const maxBudgetUsd = positiveNumber(input.max_budget_usd, "max_budget_usd");
  const maxTurns = input.max_turns === undefined
    ? undefined
    : nonNegativeInteger(input.max_turns, "max_turns");
  const model = optionalString(input.model, "model", 200) ?? undefined;
  return { timeoutMs, maxBudgetUsd, maxTurns, model };
}

const DETAIL_SNAPSHOT_MAX_ATTEMPTS = 3;

function isTerminalTask(task: TaskRow): boolean {
  return ["harvested", "wilted", "cancelled"].includes(task.status);
}

function repositoryObservation(
  inspection: Awaited<ReturnType<typeof inspectRepository>>,
  checkedAt: number,
): RepositoryObservation {
  return {
    checkedAt,
    rootPath: inspection.rootPath,
    gitDir: inspection.gitDir,
    isGit: inspection.isGit,
    branch: inspection.defaultBranch,
    headCommit: inspection.headCommit,
    clean: inspection.clean,
    error: inspection.error ?? null,
  };
}

async function hydrateDetail(id: string) {
  for (let attempt = 1; attempt <= DETAIL_SNAPSHOT_MAX_ATTEMPTS; attempt += 1) {
    let task = getTaskRow(id);
    if (!task) throw notFound("task_not_found", `Task ${id} does not exist.`, { task_id: id });
    const initialRowVersion = task.row_version;
    const repository = getRepositoryRow(task.repository_id);
    const checkedAt = Date.now();
    const [inspection, rawHealth] = await Promise.all([
      repository
        ? inspectRepository(repository.root_path)
        : Promise.resolve(null),
      repository?.is_git && task.worktree_path
        ? worktreeHealth({
            repoRoot: repository.root_path,
            worktreePath: task.worktree_path,
            ...(task.base_commit ? { baseCommit: task.base_commit } : {}),
          })
        : Promise.resolve(null),
    ]);

    const observedTask = getTaskRow(id);
    if (!observedTask) throw notFound("task_not_found", `Task ${id} does not exist.`, { task_id: id });
    if (observedTask.row_version !== initialRowVersion) {
      if (attempt < DETAIL_SNAPSHOT_MAX_ATTEMPTS) continue;
      throw conflict("task_snapshot_changed", "The task changed while Git state was being inspected.", {
        task_id: id,
        initial_row_version: initialRowVersion,
        observed_row_version: observedTask.row_version,
        attempts: attempt,
      });
    }
    task = observedTask;

    let diffVerified = false;
    if (
      !isTerminalTask(task) &&
      task.review_status === "approved" &&
      rawHealth?.exists === true &&
      rawHealth.registered === true
    ) {
      await refreshTaskDiff(id, task.current_run_id);
      task = getTaskRow(id);
      if (!task) throw notFound("task_not_found", `Task ${id} does not exist.`, { task_id: id });
      diffVerified = !isTerminalTask(task);
    }

    const snapshotRowVersion = task.row_version;
    const eligibility = isTerminalTask(task)
      ? {
          can_harvest: false,
          reasons: [`status:${task.status}`],
          evaluated_at: Date.now(),
          provenance: {
            kind: "harvest_gate",
            source: "domain_projection",
            digest: null,
          },
        }
      : await harvestEligibility(id, rawHealth);
    const finalTask = getTaskRow(id);
    if (!finalTask) throw notFound("task_not_found", `Task ${id} does not exist.`, { task_id: id });
    if (finalTask.row_version !== snapshotRowVersion) {
      if (attempt < DETAIL_SNAPSHOT_MAX_ATTEMPTS) continue;
      throw conflict("task_snapshot_changed", "The task changed while its detail snapshot was being hydrated.", {
        task_id: id,
        initial_row_version: initialRowVersion,
        observed_row_version: finalTask.row_version,
        attempts: attempt,
      });
    }

    const detail = db.transaction(() => taskDetailBase(id, {
      ...(inspection ? { repositoryObservation: repositoryObservation(inspection, checkedAt) } : {}),
      diffVerified,
    }))();
    if (!detail || detail.task.row_version !== finalTask.row_version) {
      if (attempt < DETAIL_SNAPSHOT_MAX_ATTEMPTS) continue;
      throw conflict("task_snapshot_changed", "The task changed while its detail projection was being assembled.", {
        task_id: id,
        expected_row_version: finalTask.row_version,
        attempts: attempt,
      });
    }
    const afterProjection = getTaskRow(id);
    if (!afterProjection || afterProjection.row_version !== finalTask.row_version) {
      if (attempt < DETAIL_SNAPSHOT_MAX_ATTEMPTS) continue;
      throw conflict("task_snapshot_changed", "The task changed before its detail snapshot could be returned.", {
        task_id: id,
        expected_row_version: finalTask.row_version,
        observed_row_version: afterProjection?.row_version ?? null,
        attempts: attempt,
      });
    }

    const health = rawHealth ? {
      state: rawHealth.exists && rawHealth.registered ? (rawHealth.dirty ? "dirty" : "healthy") : "missing",
      healthy: rawHealth.exists && rawHealth.registered,
      exists: rawHealth.exists,
      registered: rawHealth.registered,
      dirty: rawHealth.dirty,
      head_commit: rawHealth.headCommit,
      blocking_reasons: rawHealth.reasons.filter((reason) => !reason.includes("differs from base commit")),
      checked_at: checkedAt,
      provenance: {
        kind: "git_worktree_health",
        source: "git",
        digest: null,
        recorded_at: checkedAt,
      },
    } : null;
    return {
      ...detail,
      eligibility,
      worktree_health: health,
      residual_health: taskResidualHealth(id),
    };
  }
  throw conflict("task_snapshot_changed", "The task changed while its detail snapshot was being hydrated.", {
    task_id: id,
    attempts: DETAIL_SNAPSHOT_MAX_ATTEMPTS,
  });
}

function dependencyId(req: Request): string {
  const candidate = req.params.dependencyId ?? body(req).dependency_id;
  return requireString(candidate, "dependency_id", { max: 128 });
}

function requestedRunId(req: Request): string | null {
  const value = req.params.runId ?? body(req).run_id;
  return optionalString(value, "run_id", 128);
}

export async function listTasksHandler(_req: Request, res: Response): Promise<void> {
  const latestResidual = getLatestResidualBenchmark();
  const snapshot = db.transaction(() => ({
    tasks: listTaskSummaries(),
    last_seq: lastEventSeq(),
    generated_at: Date.now(),
  }))();
  res.json({
    ...snapshot,
    ...(latestResidual ? { residual_health: latestResidual } : {}),
  });
}

export async function getTaskHandler(req: Request, res: Response): Promise<void> {
  res.json(await hydrateDetail(taskId(req)));
}

export async function createTaskHandler(req: Request, res: Response): Promise<void> {
  const result = await seedTask(body(req));
  res.status(201).json({
    ...(await hydrateDetail(result.taskId)),
    claim_conflicts: result.claimConflicts,
  });
}

export async function addDependencyHandler(req: Request, res: Response): Promise<void> {
  const id = taskId(req);
  addDependency(id, dependencyId(req));
  res.status(201).json(await hydrateDetail(id));
}

export async function removeDependencyHandler(req: Request, res: Response): Promise<void> {
  const id = taskId(req);
  removeDependency(id, dependencyId(req));
  res.json(await hydrateDetail(id));
}

export async function addClaimHandler(req: Request, res: Response): Promise<void> {
  const id = taskId(req);
  const input = body(req);
  const result = addPathClaim(id, input.path, input.mode);
  res.status(201).json({ ...result, task: await hydrateDetail(id) });
}

export async function releaseClaimHandler(req: Request, res: Response): Promise<void> {
  const id = taskId(req);
  const claimId = requireString(req.params.claimId, "claim_id", { max: 128 });
  releasePathClaim(id, claimId);
  res.json(await hydrateDetail(id));
}

export async function resolveOverlapHandler(req: Request, res: Response): Promise<void> {
  const id = taskId(req);
  const overlapId = requireString(req.params.overlapId, "overlap_id", { max: 128 });
  resolveOverlap(id, overlapId, body(req).resolution);
  res.json(await hydrateDetail(id));
}

export async function startRunHandler(req: Request, res: Response): Promise<void> {
  const id = taskId(req);
  const result = await startTaskRun(id, runOptions(req));
  res.status(202).json({ ...result, task: await hydrateDetail(id) });
}

export async function retryRunHandler(req: Request, res: Response): Promise<void> {
  const id = taskId(req);
  const result = await retryRun(id, requestedRunId(req), runOptions(req));
  res.status(202).json({ ...result, task: await hydrateDetail(id) });
}

export async function recoverRunHandler(req: Request, res: Response): Promise<void> {
  const id = taskId(req);
  const result = await recoverRun(id, requestedRunId(req), runOptions(req));
  res.status(202).json({ ...result, task: await hydrateDetail(id) });
}

export async function cancelRunHandler(req: Request, res: Response): Promise<void> {
  const id = taskId(req);
  const result = await cancelRunForTask(id, requestedRunId(req));
  res.status(202).json({ ...result, task: await hydrateDetail(id) });
}

export async function getDiffHandler(req: Request, res: Response): Promise<void> {
  const id = taskId(req);
  const task = getTaskRow(id);
  if (!task) throw notFound("task_not_found", `Task ${id} does not exist.`);
  if (!isTerminalTask(task)) await refreshTaskDiff(id, task.current_run_id);
  const current = getTaskRow(id)!;
  const patch = getPatchArtifact(id, current.current_diff_digest);
  if (!patch || patch.sha256 !== current.current_diff_digest) {
    throw conflict("diff_artifact_missing", "The current diff digest has no matching patch artifact.", {
      current_diff_digest: current.current_diff_digest,
    });
  }
  const patchBytes = await fs.readFile(patch.path);
  if (patchBytes.byteLength !== patch.size_bytes) {
    throw conflict("diff_artifact_changed", "The persisted patch artifact size no longer matches its manifest.", {
      expected_size_bytes: patch.size_bytes,
      actual_size_bytes: patchBytes.byteLength,
    });
  }
  const artifactDigest = crypto.createHash("sha256").update(patchBytes).digest("hex");
  if (artifactDigest !== patch.sha256) {
    throw conflict("diff_artifact_changed", "The persisted patch artifact digest no longer matches its manifest.", {
      expected_digest: patch.sha256,
      actual_digest: artifactDigest,
    });
  }
  const patchText = decodeUtf8(patchBytes, "patch artifact");
  const artifacts = getTaskArtifacts(id).filter((artifact) => {
    const metadata = parseJson<Record<string, unknown>>(artifact.metadata_json, {});
    return metadata.diff_digest === current.current_diff_digest;
  });
  const manifest = artifacts.find((artifact) => artifact.kind === "manifest");
  const metadata = manifest ? parseJson<Record<string, unknown>>(manifest.metadata_json, {}) : {};
  const maxBytes = Number(process.env.AGENT_FARM_DIFF_RESPONSE_MAX_BYTES ?? 4 * 1024 * 1024);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error("AGENT_FARM_DIFF_RESPONSE_MAX_BYTES must be a non-negative safe integer");
  }
  const truncated = patchBytes.byteLength > maxBytes;
  const responsePatch = truncated ? utf8Prefix(patchBytes, maxBytes) : patchText;
  res.json({
    kind: metadata.has_binary === true ? "binary" : truncated ? "large" : patchText.trim() ? "patch" : "empty",
    patch: responsePatch,
    digest: current.current_diff_digest,
    artifact_digest: manifest?.sha256 ?? null,
    changed_paths: Array.isArray(metadata.changed_paths) ? metadata.changed_paths : [],
    binary: metadata.has_binary === true,
    large: truncated,
    truncated,
    manifest: artifacts.map((artifact) => ({
      id: artifact.id,
      type: artifact.kind,
      path: artifact.path,
      digest: artifact.sha256,
      size_bytes: artifact.size_bytes,
      media_type: artifact.media_type,
      created_at: artifact.created_at,
      metadata: parseJson(artifact.metadata_json, {}),
    })),
  });
}

export async function reviewHandler(req: Request, res: Response): Promise<void> {
  const id = taskId(req);
  const input = body(req);
  const rawDecision = req.params.decision ?? input.decision;
  if (rawDecision !== "approved" && rawDecision !== "rejected") {
    throw badRequest("invalid_review_decision", "decision must be approved or rejected.");
  }
  await submitReview(
    id,
    rawDecision,
    input.diff_digest,
    input.summary,
    "local_user",
  );
  res.status(201).json(await hydrateDetail(id));
}

export async function harvestHandler(req: Request, res: Response): Promise<void> {
  const id = taskId(req);
  const requestedDigest = optionalString(body(req).diff_digest, "diff_digest", 128);
  const task = getTaskRow(id);
  if (!task) throw notFound("task_not_found", `Task ${id} does not exist.`);
  if (requestedDigest && requestedDigest !== task.current_diff_digest) {
    throw conflict("review_stale", "The requested harvest digest is not the current diff digest.", {
      requested_diff_digest: requestedDigest,
      current_diff_digest: task.current_diff_digest,
    });
  }
  const result = await harvestTask(id);
  res.json({ ...result, task: taskSummary(id) });
}

export async function wiltHandler(req: Request, res: Response): Promise<void> {
  const id = taskId(req);
  const result = await wiltTask(id, body(req).reason);
  res.json({ ...result, task: taskSummary(id) });
}

export async function eventsHandler(req: Request, res: Response): Promise<void> {
  const raw = req.query.after_seq ?? "0";
  if (typeof raw !== "string" || !/^(0|[1-9]\d*)$/.test(raw)) {
    throw badRequest("invalid_after_seq", "after_seq must be a non-negative safe integer.");
  }
  const afterSeq = Number(raw);
  if (!Number.isSafeInteger(afterSeq)) throw badRequest("invalid_after_seq", "after_seq exceeds the safe integer range.");
  const page = db.transaction(() => {
    const ledgerLastSeq = lastEventSeq();
    if (afterSeq > ledgerLastSeq) {
      throw conflict("event_cursor_ahead", "after_seq is ahead of the ledger.", {
        after_seq: afterSeq,
        last_seq: ledgerLastSeq,
        ledger_last_seq: ledgerLastSeq,
      });
    }
    const events = eventsAfter(afterSeq, 10_000);
    const lastSeq = events.at(-1)?.seq ?? afterSeq;
    return {
      events,
      last_seq: lastSeq,
      has_more: lastSeq < ledgerLastSeq,
      ledger_last_seq: ledgerLastSeq,
    };
  })();
  res.json(page);
}

export async function latestResidualHandler(_req: Request, res: Response): Promise<void> {
  const artifact = getLatestResidualBenchmark();
  if (!artifact) throw notFound("residual_benchmark_not_found", "No residual benchmark has been generated yet.");
  res.json(artifact);
}

export async function generateResidualHandler(_req: Request, res: Response): Promise<void> {
  res.status(201).json(await generateResidualBenchmark());
}
