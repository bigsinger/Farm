import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import {
  baseCheckoutHealth,
  commitTaskChanges,
  createTaskWorktree,
  findTaskHarvestCommit,
  removeTaskWorktree,
  worktreeHealth,
} from "../../../server/src/git.js";
import { asObject } from "../../lib/api.js";
import { FarmApi, expectApiError } from "../../lib/farm-api.js";
import { createHarness, git, pathExists, run } from "../../lib/harness.js";
import { findSqliteDatabase, sqliteJson } from "../../lib/sqlite.js";

interface JournalRow extends Record<string, unknown> {
  id: string;
  state: string;
  error_message: string | null;
}

interface OutcomeRow extends Record<string, unknown> {
  operation_id: string;
  status: string;
  commit_sha: string | null;
}

async function journalRows(dataDir: string, taskId: string, operation: "wilt" | "harvest"): Promise<JournalRow[]> {
  const database = await findSqliteDatabase(dataDir);
  return sqliteJson<JournalRow>(
    database,
    dataDir,
    `SELECT id, state, error_message FROM operation_journal WHERE task_id = '${taskId}' AND operation = '${operation}' ORDER BY started_at, id;`,
  );
}

async function outcomeRows(dataDir: string, taskId: string, type: "wilt" | "harvest"): Promise<OutcomeRow[]> {
  const database = await findSqliteDatabase(dataDir);
  return sqliteJson<OutcomeRow>(
    database,
    dataDir,
    `SELECT operation_id, status, commit_sha FROM outcomes WHERE task_id = '${taskId}' AND type = '${type}' ORDER BY created_at, id;`,
  );
}

function switchTaskWorktreeToUnrelated(repository: string, worktree: string, branchName: string): string {
  git(repository, "branch", branchName, "main");
  git(worktree, "switch", "--quiet", branchName);
  return git(worktree, "rev-parse", "HEAD");
}

function repairTaskWorktree(repository: string, worktree: string, taskBranch: string): void {
  git(worktree, "switch", "--quiet", taskBranch);
  assert.equal(git(worktree, "branch", "--show-current"), taskBranch);
  assert.equal(git(repository, "show-ref", "--verify", `refs/heads/${taskBranch}`).length > 0, true);
}

async function forceSqlite(dataDir: string, statements: string[]): Promise<void> {
  const database = await findSqliteDatabase(dataDir);
  run("sqlite3", [database], { input: `.bail on\nBEGIN IMMEDIATE;\n${statements.join("\n")}\nCOMMIT;\n` });
}

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function seedTask(farm: FarmApi, repository: string, prompt: string) {
  return farm.seed({ repoPath: repository, prompt, autoStart: false });
}

test("wilt branch mismatch never deletes unrelated worktree and remains idempotently recoverable across restart", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("wilt-branch-mismatch-recovery");
  try {
    const fixture = await harness.createGitFixture({ "tracked.txt": "base\n" });
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const seeded = await seedTask(farm, fixture.repository, "Exercise safe wilt recovery after external worktree branch switch.");
    const taskId = seeded.task.id;
    const worktree = seeded.task.worktree_path!;
    const taskBranch = seeded.task.branch_name!;
    const unrelatedBranch = `unrelated-wilt-${randomUUID().slice(0, 8)}`;
    const unrelatedHead = switchTaskWorktreeToUnrelated(fixture.repository, worktree, unrelatedBranch);

    const first = asObject((await farm.http.delete(`/api/tasks/${taskId}`, { reason: "External branch mismatch boundary." }, 200)).body, "first wilt");
    const firstErrors = first.cleanup_errors as unknown[];
    assert.equal(firstErrors.length, 1);
    assert.match(String(firstErrors[0]), /registered to.*unrelated-wilt|not 'agent-farm/i);
    assert.equal(asObject(first.task, "first wilt task").status, "recovery_required");
    assert.equal(await pathExists(worktree), true);
    assert.equal(git(worktree, "branch", "--show-current"), unrelatedBranch);
    assert.equal(git(worktree, "rev-parse", "HEAD"), unrelatedHead);
    assert.equal(git(fixture.repository, "rev-parse", taskBranch).length > 0, true);
    assert.equal(git(fixture.repository, "rev-parse", unrelatedBranch), unrelatedHead);

    let journals = await journalRows(harness.dataDir, taskId, "wilt");
    let outcomes = await outcomeRows(harness.dataDir, taskId, "wilt");
    assert.deepEqual(journals.map((row) => row.state), ["needs_recovery"]);
    assert.deepEqual(outcomes.map((row) => row.status), ["failed"]);

    const restarted = await harness.restartServer();
    const replayFarm = new FarmApi(restarted.baseUrl);
    const afterRestart = await replayFarm.task(taskId);
    assert.equal(afterRestart.task.status, "recovery_required");
    assert.equal(await pathExists(worktree), true);
    assert.equal(git(worktree, "branch", "--show-current"), unrelatedBranch);
    journals = await journalRows(harness.dataDir, taskId, "wilt");
    outcomes = await outcomeRows(harness.dataDir, taskId, "wilt");
    assert.equal(journals.length, 1);
    assert.equal(journals[0]!.state, "needs_recovery");
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0]!.status, "failed");

    repairTaskWorktree(fixture.repository, worktree, taskBranch);
    const retry = asObject((await replayFarm.http.delete(`/api/tasks/${taskId}`, { reason: "Retry after operator branch repair." }, 200)).body, "retry wilt");
    assert.deepEqual(retry.cleanup_errors, []);
    assert.equal(asObject(retry.task, "retry wilt task").status, "wilted");
    assert.equal(await pathExists(worktree), false);
    assert.equal(git(fixture.repository, "branch", "--list", taskBranch), "");
    assert.equal(git(fixture.repository, "rev-parse", unrelatedBranch), unrelatedHead);
    journals = await journalRows(harness.dataDir, taskId, "wilt");
    outcomes = await outcomeRows(harness.dataDir, taskId, "wilt");
    assert.equal(journals.length, 1, "retry must reuse the durable wilt operation");
    assert.equal(journals[0]!.state, "committed");
    assert.equal(outcomes.length, 1, "retry must not create a second terminal outcome");
    assert.equal(outcomes[0]!.status, "succeeded");

    const doubleTerminal = asObject((await replayFarm.http.delete(`/api/tasks/${taskId}`, { reason: "idempotent double terminal" }, 200)).body, "double terminal");
    assert.deepEqual(doubleTerminal.cleanup_errors, []);
    assert.equal(asObject(doubleTerminal.task, "double terminal task").status, "wilted");
    assert.equal((await journalRows(harness.dataDir, taskId, "wilt")).length, 1);
    assert.equal((await outcomeRows(harness.dataDir, taskId, "wilt")).length, 1);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("restart reconciliation completes an interrupted wilt only after exact task branch repair", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("restart-wilt-retry");
  try {
    const fixture = await harness.createGitFixture({ "tracked.txt": "base\n" });
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const seeded = await seedTask(farm, fixture.repository, "Restart must reconcile interrupted wilt safely.");
    const taskId = seeded.task.id;
    const worktree = seeded.task.worktree_path!;
    const taskBranch = seeded.task.branch_name!;
    const unrelatedBranch = `unrelated-restart-${randomUUID().slice(0, 8)}`;
    switchTaskWorktreeToUnrelated(fixture.repository, worktree, unrelatedBranch);
    await farm.http.delete(`/api/tasks/${taskId}`, { reason: "Persist needs_recovery before restart." }, 200);
    repairTaskWorktree(fixture.repository, worktree, taskBranch);

    const restarted = await harness.restartServer();
    const replayFarm = new FarmApi(restarted.baseUrl);
    const reconciled = await replayFarm.task(taskId);
    assert.equal(reconciled.task.status, "wilted");
    assert.equal(await pathExists(worktree), false);
    assert.equal(git(fixture.repository, "branch", "--list", taskBranch), "");
    assert.notEqual(git(fixture.repository, "branch", "--list", unrelatedBranch), "");
    const journals = await journalRows(harness.dataDir, taskId, "wilt");
    const outcomes = await outcomeRows(harness.dataDir, taskId, "wilt");
    assert.deepEqual(journals.map((row) => row.state), ["committed"]);
    assert.deepEqual(outcomes.map((row) => row.status), ["succeeded"]);
    assert.ok(reconciled.timeline.some((event) => event.type === "task.wilt.succeeded"));
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("harvest lookup is confined to checked out base first-parent history and rejects side checkout", async () => {
  const harness = await createHarness("harvest-base-ancestry");
  try {
    const fixture = await harness.createGitFixture({ "tracked.txt": "base\n" });
    const base = fixture.initialSha;
    const taskId = `side-trailer-${randomUUID().slice(0, 8)}`;
    git(fixture.repository, "switch", "--quiet", "-c", "side-with-trailer");
    await writeFile(join(fixture.repository, "side.txt"), "unrelated side commit\n");
    git(fixture.repository, "add", "side.txt");
    git(fixture.repository, "commit", "--quiet", "-m", `Unrelated side\n\nAgent-Farm-Task: ${taskId}`);
    const sideSha = git(fixture.repository, "rev-parse", "HEAD");

    await assert.rejects(
      findTaskHarvestCommit({ repoRoot: fixture.repository, taskId, baseBranch: "main", afterCommit: base }),
      /repository is on 'side-with-trailer', not 'main'/,
    );
    assert.equal(git(fixture.repository, "rev-parse", "HEAD"), sideSha);
    git(fixture.repository, "switch", "--quiet", "main");
    assert.equal(await findTaskHarvestCommit({ repoRoot: fixture.repository, taskId, baseBranch: "main", afterCommit: base }), null);
    assert.throws(() => git(fixture.repository, "merge-base", "--is-ancestor", sideSha, "main"), /exit=1/);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("restart never confirms a side-branch trailer or cleans the task worktree", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("restart-side-trailer");
  try {
    const fixture = await harness.createGitFixture({ "tracked.txt": "base\n" });
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const seeded = await seedTask(farm, fixture.repository, "Side branch trailer must never be confirmed as harvested.");
    const taskId = seeded.task.id;
    const worktree = seeded.task.worktree_path!;
    const taskBranch = seeded.task.branch_name!;
    const baseCommit = String(seeded.task.base_commit ?? git(fixture.repository, "rev-parse", "main"));
    const sideBranch = `side-reconcile-${randomUUID().slice(0, 8)}`;

    git(fixture.repository, "switch", "--quiet", "-c", sideBranch);
    await writeFile(join(fixture.repository, "side.txt"), "side only\n");
    git(fixture.repository, "add", "side.txt");
    git(fixture.repository, "commit", "--quiet", "-m", `Unrelated side terminal\n\nAgent-Farm-Task: ${taskId}`);
    const sideSha = git(fixture.repository, "rev-parse", "HEAD");
    await harness.stopServer();
    const database = await findSqliteDatabase(harness.dataDir);
    const repositoryId = seeded.task.repository_id;
    const operationId = randomUUID();
    const outcomeId = randomUUID();
    const event = (await sqliteJson<{ seq: number }>(database, harness.dataDir, `SELECT MAX(seq) AS seq FROM audit_events;`))[0]!.seq;
    const now = Date.now();
    await forceSqlite(harness.dataDir, [
      `UPDATE tasks SET status = 'harvesting', pre_harvest_commit = ${sql(baseCommit)}, outcome_status = NULL, harvest_commit = NULL, updated_at = ${now}, row_version = row_version + 1 WHERE id = ${sql(taskId)};`,
      `INSERT INTO operation_journal (id, repository_id, task_id, operation, state, pre_commit, details_json, started_at, updated_at, source_event_seq) VALUES (${sql(operationId)}, ${sql(repositoryId)}, ${sql(taskId)}, 'harvest', 'git_applying', ${sql(baseCommit)}, '{}', ${now}, ${now}, ${event});`,
      `INSERT INTO outcomes (id, task_id, type, status, operation_id, created_at, source_event_seq) VALUES (${sql(outcomeId)}, ${sql(taskId)}, 'harvest', 'started', ${sql(operationId)}, ${now}, ${event});`,
    ]);

    const restarted = await harness.startServer();
    const replayFarm = new FarmApi(restarted.baseUrl);
    const recovered = await replayFarm.task(taskId);
    assert.equal(recovered.task.status, "recovery_required");
    assert.notEqual(recovered.task.status, "harvested");
    assert.equal(recovered.task.harvest_commit ?? null, null);
    assert.equal(await pathExists(worktree), true);
    assert.equal(git(worktree, "branch", "--show-current"), taskBranch);
    assert.equal(git(fixture.repository, "rev-parse", "HEAD"), sideSha);
    assert.equal(git(fixture.repository, "rev-parse", sideBranch), sideSha);
    const journals = await journalRows(harness.dataDir, taskId, "harvest");
    const outcomes = await outcomeRows(harness.dataDir, taskId, "harvest");
    assert.equal(journals.length, 1);
    assert.equal(journals[0]!.state, "needs_recovery");
    assert.match(journals[0]!.error_message ?? "", /repository is on.*not 'main'|refusing/i);
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0]!.status, "failed");
    assert.equal(outcomes[0]!.commit_sha, null);
    assert.notEqual(outcomes[0]!.commit_sha, sideSha);
    git(fixture.repository, "switch", "--quiet", "main");
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("run, diff and harvest gates reject an externally switched task worktree", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("worktree-identity-gates");
  try {
    const fixture = await harness.createGitFixture({ "tracked.txt": "base\n" });
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const seeded = await seedTask(farm, fixture.repository, "All task operations must bind to the recorded worktree branch.");
    const worktree = seeded.task.worktree_path!;
    const unrelatedBranch = `unrelated-gates-${randomUUID().slice(0, 8)}`;
    switchTaskWorktreeToUnrelated(fixture.repository, worktree, unrelatedBranch);

    await expectApiError(farm.http.get(`/api/tasks/${seeded.task.id}/diff`), 409, "worktree_mismatch");
    await expectApiError(
      farm.http.post(`/api/tasks/${seeded.task.id}/runs`, { timeout_ms: 1_000, max_budget_usd: 0.01, max_turns: 1 }),
      409,
      "worktree_mismatch",
    );
    const detail = await farm.task(seeded.task.id);
    assert.equal(detail.eligibility.can_harvest, false);
    assert.ok((detail.eligibility.reasons as string[]).some((reason) => reason.startsWith("worktree_branch_mismatch:")));
    assert.equal(await pathExists(worktree), true);
    assert.equal(git(worktree, "branch", "--show-current"), unrelatedBranch);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("Git primitives preserve reviewed digest and refuse unsafe base rollback", async () => {
  const harness = await createHarness("git-reviewed-digest");
  try {
    const fixture = await harness.createGitFixture({ "tracked.txt": "base\n" });
    const taskId = `digest-${randomUUID().slice(0, 8)}`;
    const worktreesDir = join(harness.root, "worktrees");
    await mkdir(worktreesDir, { recursive: true });
    const task = await createTaskWorktree({ repoRoot: fixture.repository, taskId, baseCommit: fixture.initialSha, worktreesDir });
    await writeFile(join(task.worktreePath, "tracked.txt"), "reviewed change\n");
    const before = git(task.worktreePath, "rev-parse", "HEAD");
    await assert.rejects(
      commitTaskChanges({
        worktreePath: task.worktreePath,
        baseCommit: fixture.initialSha,
        taskId,
        title: "Digest mismatch",
        expectedDiffDigest: "0".repeat(64),
      }),
      /reviewed diff digest.*does not match staged task diff/,
    );
    assert.equal(git(task.worktreePath, "rev-parse", "HEAD"), before);
    assert.match(git(task.worktreePath, "status", "--porcelain"), /tracked\.txt/);

    git(fixture.repository, "switch", "--quiet", "-c", "wrong-base");
    const health = await baseCheckoutHealth({ repoRoot: fixture.repository, baseBranch: "main", expectedHead: fixture.initialSha });
    assert.ok(health.reasons.some((reason) => reason.includes("not 'main'")));
    git(fixture.repository, "switch", "--quiet", "main");
    await removeTaskWorktree({ repoRoot: fixture.repository, worktreePath: task.worktreePath, branchName: task.branchName });
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("harvest eligibility blocks a rewritten base outside the recorded task ancestry", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("harvest-recorded-base-gate");
  try {
    const fixture = await harness.createGitFixture({ "tracked.txt": "recorded base\n" });
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const seeded = await seedTask(farm, fixture.repository, "Reject harvest after the base branch is rewritten.");
    const taskId = seeded.task.id;
    const recordedBase = seeded.task.base_commit!;
    const worktree = seeded.task.worktree_path!;
    await writeFile(join(worktree, "task.txt"), "reviewed task output\n");
    const diff = asObject((await farm.http.get(`/api/tasks/${taskId}/diff`, 200)).body, "reviewed diff");
    const digest = String(diff.digest);
    await forceSqlite(harness.dataDir, [
      `UPDATE tasks SET status = 'review_pending', review_status = 'approved', current_diff_digest = ${sql(digest)}, approved_diff_digest = ${sql(digest)}, updated_at = ${Date.now()}, row_version = row_version + 1 WHERE id = ${sql(taskId)};`,
    ]);

    git(fixture.repository, "switch", "--quiet", "--orphan", "replacement-root");
    git(fixture.repository, "rm", "-rf", "--quiet", "--ignore-unmatch", ".");
    await writeFile(join(fixture.repository, "replacement.txt"), "unrelated replacement history\n");
    git(fixture.repository, "add", "replacement.txt");
    git(fixture.repository, "commit", "--quiet", "-m", "rewrite main history");
    git(fixture.repository, "branch", "-M", "main");
    const rewrittenHead = git(fixture.repository, "rev-parse", "HEAD");

    const detail = await farm.task(taskId);
    assert.equal(detail.eligibility.can_harvest, false);
    assert.ok(
      (detail.eligibility.reasons as string[]).some(
        (reason) => reason.includes("recorded task base commit") && reason.includes("is not an ancestor"),
      ),
    );
    await expectApiError(
      farm.http.post(`/api/tasks/${taskId}/harvest`, { diff_digest: digest }),
      409,
      "harvest_blocked",
    );
    assert.equal(git(fixture.repository, "rev-parse", "HEAD"), rewrittenHead);
    assert.equal(git(fixture.repository, "status", "--porcelain"), "");
    assert.equal(await pathExists(worktree), true);
    assert.equal(recordedBase === rewrittenHead, false);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("unborn repository is blocked without prepare and repository provenance advances on observation", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("unborn-and-repository-seq");
  try {
    const unborn = join(harness.root, "unborn");
    await mkdir(unborn, { recursive: true });
    run("git", ["init", "--quiet", "--initial-branch=main", unborn]);
    const fixture = await harness.createGitFixture({ "tracked.txt": "base\n" });
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);

    const blocked = await seedTask(farm, unborn, "Unborn repositories must not enter prepare.");
    assert.equal(blocked.task.status, "blocked");
    assert.ok(blocked.task.blocking_reasons.includes("repository_unborn"));
    assert.equal(blocked.task.worktree_path, null);

    const first = await seedTask(farm, fixture.repository, "First repository observation.");
    const database = await findSqliteDatabase(harness.dataDir);
    const firstRows = await sqliteJson<{ last_event_seq: number; event_type: string }>(
      database,
      harness.dataDir,
      `SELECT repository.last_event_seq, event.event_type FROM repositories repository JOIN audit_events event ON event.seq = repository.last_event_seq WHERE repository.id = ${sql(first.task.repository_id)};`,
    );
    assert.equal(firstRows[0]!.event_type, "repository.registered");
    const firstSeq = firstRows[0]!.last_event_seq;

    await seedTask(farm, fixture.repository, "Second repository observation.");
    const secondRows = await sqliteJson<{ last_event_seq: number; event_type: string }>(
      database,
      harness.dataDir,
      `SELECT repository.last_event_seq, event.event_type FROM repositories repository JOIN audit_events event ON event.seq = repository.last_event_seq WHERE repository.id = ${sql(first.task.repository_id)};`,
    );
    assert.equal(secondRows[0]!.event_type, "repository.observed");
    assert.ok(secondRows[0]!.last_event_seq > firstSeq);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("claim blockers escalate and releasing either side clears the exact conflict", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("claim-escalation-release");
  try {
    const fixture = await harness.createGitFixture({ "tracked.txt": "base\n" });
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const left = await farm.seed({
      repoPath: fixture.repository,
      prompt: "Create a shared claim first.",
      claims: [{ path: "src/shared", mode: "shared" }],
      autoStart: false,
    });
    const right = await farm.seed({
      repoPath: fixture.repository,
      prompt: "Create the other shared claim.",
      claims: [{ path: "src/shared", mode: "shared" }],
      autoStart: false,
    });
    const leftClaim = String(left.claims[0]!.id);
    const rightClaim = String(right.claims[0]!.id);
    const warning = right.overlaps.find((overlap) => overlap.evidence_type === "claim");
    assert.ok(warning);
    assert.equal(warning!.blocking, false);

    await farm.http.post(`/api/tasks/${left.task.id}/claims/${leftClaim}/release`, {}, 200);
    await expectApiError(
      farm.http.post(`/api/tasks/${left.task.id}/claims`, { path: "src/shared", mode: "exclusive" }),
      409,
      "claim_conflict",
    );
    const escalated = await farm.task(right.task.id);
    const conflict = escalated.overlaps.find((overlap) => overlap.evidence_type === "claim" && overlap.status === "open");
    assert.ok(conflict);
    assert.equal(conflict!.blocking, true);
    assert.equal(escalated.overlaps.find((overlap) => overlap.id === warning!.id)!.status, "superseded");
    assert.ok(escalated.task.blocking_reasons.some((reason) => reason === `blocking_overlap:${conflict!.id}`));

    await farm.http.post(`/api/tasks/${right.task.id}/claims/${rightClaim}/release`, {}, 200);
    const cleared = await farm.task(left.task.id);
    assert.equal(cleared.overlaps.find((overlap) => overlap.id === conflict!.id)!.status, "superseded");
    assert.ok(!cleared.task.blocking_reasons.some((reason) => reason.startsWith("blocking_overlap:")));
    assert.equal(cleared.claims.find((claim) => claim.id === leftClaim)!.status, "released");
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("dependency removal re-evaluates auto-start without corrupting run lineage", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("dependency-auto-start");
  try {
    const fixture = await harness.createGitFixture({ "tracked.txt": "base\n" });
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const blocker = await seedTask(farm, fixture.repository, "Remain an unharvested dependency.");
    const dependent = await farm.seed({
      repoPath: fixture.repository,
      prompt: "Auto-start as soon as the explicit dependency is removed.",
      dependencies: [blocker.task.id],
      autoStart: true,
    });
    assert.equal(dependent.task.status, "seeded");
    assert.equal(dependent.runs.length, 0);
    await farm.http.delete(`/api/tasks/${dependent.task.id}/dependencies/${blocker.task.id}`, undefined, 200);
    const started = await farm.waitForTask(
      dependent.task.id,
      (detail) => detail.runs.length === 1 && !["queued", "running"].includes(String(detail.runs[0]!.status)),
      "dependency-unblocked auto-start terminal run",
      60_000,
    );
    assert.equal(started.runs.length, 1);
    assert.equal(started.runs[0]!.attempt, 1);
    assert.equal(started.runs[0]!.retry_of_run_id, null);
    assert.equal(started.runs[0]!.recovery_of_run_id, null);
    assert.equal(started.runs[0]!.status, "provider_blocked");
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("restart reconciles a terminal task mismatch without appending a second terminal outcome", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("double-terminal-guard");
  try {
    const fixture = await harness.createGitFixture({ "tracked.txt": "base\n" });
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const seeded = await seedTask(farm, fixture.repository, "Terminal mismatch must remain explicit recovery.");
    const taskId = seeded.task.id;
    const worktree = seeded.task.worktree_path!;
    await harness.stopServer();
    const database = await findSqliteDatabase(harness.dataDir);
    const sourceSeq = (await sqliteJson<{ seq: number }>(database, harness.dataDir, "SELECT MAX(seq) AS seq FROM audit_events;"))[0]!.seq;
    const operationId = randomUUID();
    const outcomeId = randomUUID();
    const now = Date.now();
    await forceSqlite(harness.dataDir, [
      `UPDATE tasks SET status = 'wilting', outcome_status = 'succeeded', updated_at = ${now}, row_version = row_version + 1 WHERE id = ${sql(taskId)};`,
      `INSERT INTO operation_journal (id, repository_id, task_id, operation, state, details_json, started_at, updated_at, source_event_seq) VALUES (${sql(operationId)}, ${sql(seeded.task.repository_id)}, ${sql(taskId)}, 'wilt', 'started', '{"reason":"restart terminal mismatch"}', ${now}, ${now}, ${sourceSeq});`,
      `INSERT INTO outcomes (id, task_id, type, status, operation_id, reason, created_at, source_event_seq) VALUES (${sql(outcomeId)}, ${sql(taskId)}, 'wilt', 'succeeded', ${sql(operationId)}, 'premature terminal row', ${now}, ${sourceSeq});`,
    ]);

    const restarted = await harness.startServer();
    const replayFarm = new FarmApi(restarted.baseUrl);
    const reconciled = await replayFarm.task(taskId);
    assert.equal(reconciled.task.status, "wilted");
    assert.equal(await pathExists(worktree), false);
    const journals = await journalRows(harness.dataDir, taskId, "wilt");
    const outcomes = await outcomeRows(harness.dataDir, taskId, "wilt");
    assert.deepEqual(journals.map((row) => row.state), ["committed"]);
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0]!.status, "succeeded");
    const benchmark = asObject((await replayFarm.http.post("/api/benchmarks/residual", {}, 201)).body, "terminal benchmark");
    assert.ok(!(benchmark.residuals as Array<Record<string, unknown>>).some((finding) => finding.type === "double_terminal" && finding.task_id === taskId));
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("worktree health reports exact registered branch identity", async () => {
  const harness = await createHarness("worktree-health-branch");
  try {
    const fixture = await harness.createGitFixture({ "tracked.txt": "base\n" });
    const taskId = `health-${randomUUID().slice(0, 8)}`;
    const worktreesDir = join(harness.root, "worktrees");
    await mkdir(worktreesDir, { recursive: true });
    const task = await createTaskWorktree({ repoRoot: fixture.repository, taskId, baseCommit: fixture.initialSha, worktreesDir });
    const unrelated = `unrelated-health-${randomUUID().slice(0, 8)}`;
    switchTaskWorktreeToUnrelated(fixture.repository, task.worktreePath, unrelated);
    const health = await worktreeHealth({
      repoRoot: fixture.repository,
      worktreePath: task.worktreePath,
      baseCommit: fixture.initialSha,
      expectedBranch: task.branchName,
    });
    assert.equal(health.registered, true);
    assert.equal(health.branchName, unrelated);
    assert.ok(health.reasons.some((reason) => reason.includes("differs from expected")));
    repairTaskWorktree(fixture.repository, task.worktreePath, task.branchName);
    await removeTaskWorktree({ repoRoot: fixture.repository, worktreePath: task.worktreePath, branchName: task.branchName });
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});
