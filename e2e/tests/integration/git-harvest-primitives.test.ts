import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  commitTaskChanges,
  createTaskWorktree,
  findTaskHarvestCommit,
  harvestTaskBranch,
  removeTaskWorktree,
} from "../../../server/src/git.js";
import { createHarness, git } from "../../lib/harness.js";
import { assertRepositoryClean } from "../../lib/git-artifacts.js";
import { populateLifecycleRepository } from "../../lib/repository-scenarios.js";

async function taskWorktree(repository: string, root: string, taskId: string, baseCommit: string) {
  return createTaskWorktree({ repoRoot: repository, taskId, baseCommit, worktreesDir: join(root, "production-worktrees") });
}

test("production harvest rolls back a merge conflict and leaves the base repository clean", async () => {
  const harness = await createHarness("git-merge-conflict-rollback");
  try {
    const fixture = await harness.createGitFixture();
    const scenario = await populateLifecycleRepository(fixture);
    const taskId = "conflict-rollback";
    const worktree = await taskWorktree(fixture.repository, harness.root, taskId, scenario.initialSha);
    await writeFile(join(worktree.worktreePath, scenario.paths.conflict), "task side conflict\n");
    await commitTaskChanges({ worktreePath: worktree.worktreePath, baseCommit: scenario.initialSha, taskId, title: "Task side" });

    await writeFile(join(fixture.repository, scenario.paths.conflict), "base side conflict\n");
    git(fixture.repository, "add", scenario.paths.conflict);
    git(fixture.repository, "commit", "--quiet", "-m", "base side conflict");
    const preCommit = git(fixture.repository, "rev-parse", "HEAD");
    await assert.rejects(
      harvestTaskBranch({ repoRoot: fixture.repository, baseBranch: "main", branchName: worktree.branchName, taskId, title: "Conflict harvest" }),
      /CONFLICT|conflict|Automatic merge failed/,
    );
    assert.equal(git(fixture.repository, "rev-parse", "HEAD"), preCommit);
    assertRepositoryClean(fixture.repository);
    assert.equal(git(fixture.repository, "diff", "--cached"), "");
    await removeTaskWorktree({ repoRoot: fixture.repository, worktreePath: worktree.worktreePath, branchName: worktree.branchName });
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("production harvest protects wrong and dirty base without moving HEAD", async () => {
  const harness = await createHarness("git-base-protection");
  try {
    const fixture = await harness.createGitFixture();
    const scenario = await populateLifecycleRepository(fixture);
    const taskId = "base-protection";
    const worktree = await taskWorktree(fixture.repository, harness.root, taskId, scenario.initialSha);
    await writeFile(join(worktree.worktreePath, "src/provider/task-a.txt"), "task branch change\n");
    await commitTaskChanges({ worktreePath: worktree.worktreePath, baseCommit: scenario.initialSha, taskId, title: "Base protection" });
    const baseHead = git(fixture.repository, "rev-parse", "HEAD");

    git(fixture.repository, "switch", "--quiet", "-c", "wrong-base");
    await assert.rejects(
      harvestTaskBranch({ repoRoot: fixture.repository, baseBranch: "main", branchName: worktree.branchName, taskId, title: "Wrong base" }),
      /not 'main'/,
    );
    assert.equal(git(fixture.repository, "rev-parse", "HEAD"), baseHead);
    git(fixture.repository, "switch", "--quiet", "main");

    await writeFile(join(fixture.repository, "dirty-base.txt"), "dirty base\n");
    await assert.rejects(
      harvestTaskBranch({ repoRoot: fixture.repository, baseBranch: "main", branchName: worktree.branchName, taskId, title: "Dirty base" }),
      /dirty base repository/,
    );
    assert.equal(git(fixture.repository, "rev-parse", "HEAD"), baseHead);
    git(fixture.repository, "clean", "-fd");
    assertRepositoryClean(fixture.repository);
    await removeTaskWorktree({ repoRoot: fixture.repository, worktreePath: worktree.worktreePath, branchName: worktree.branchName });
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("production harvest rejects a rewritten base that no longer contains the recorded task base", async () => {
  const harness = await createHarness("git-recorded-base-ancestry");
  try {
    const fixture = await harness.createGitFixture({ "tracked.txt": "recorded base\n" });
    const recordedBase = fixture.initialSha;
    const taskId = "recorded-base-ancestry";
    const worktree = await taskWorktree(fixture.repository, harness.root, taskId, recordedBase);
    await writeFile(join(worktree.worktreePath, "task.txt"), "reviewed task change\n");
    const taskCommit = await commitTaskChanges({
      worktreePath: worktree.worktreePath,
      baseCommit: recordedBase,
      taskId,
      title: "Recorded base ancestry",
    });

    git(fixture.repository, "switch", "--quiet", "--orphan", "replacement-root");
    git(fixture.repository, "rm", "-rf", "--quiet", "--ignore-unmatch", ".");
    await writeFile(join(fixture.repository, "replacement.txt"), "unrelated replacement history\n");
    git(fixture.repository, "add", "replacement.txt");
    git(fixture.repository, "commit", "--quiet", "-m", "rewrite main history");
    const rewrittenHead = git(fixture.repository, "rev-parse", "HEAD");
    git(fixture.repository, "branch", "-M", "main");

    await assert.rejects(
      harvestTaskBranch({
        repoRoot: fixture.repository,
        baseBranch: "main",
        branchName: worktree.branchName,
        taskId,
        title: "Refuse rewritten base",
        expectedBranchCommit: taskCommit.commit,
        expectedBaseCommit: recordedBase,
      }),
      /recorded task base commit .* is not an ancestor/,
    );
    assert.equal(git(fixture.repository, "rev-parse", "HEAD"), rewrittenHead);
    assertRepositoryClean(fixture.repository);
    await removeTaskWorktree({ repoRoot: fixture.repository, worktreePath: worktree.worktreePath, branchName: worktree.branchName });
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("two concurrent production harvests yield exactly one terminal commit", async () => {
  const harness = await createHarness("concurrent-harvest");
  try {
    const fixture = await harness.createGitFixture();
    const scenario = await populateLifecycleRepository(fixture);
    const taskId = "concurrent-harvest";
    const worktree = await taskWorktree(fixture.repository, harness.root, taskId, scenario.initialSha);
    await writeFile(join(worktree.worktreePath, "src/provider/task-b.txt"), "one concurrent harvest change\n");
    await commitTaskChanges({ worktreePath: worktree.worktreePath, baseCommit: scenario.initialSha, taskId, title: "Concurrent harvest" });

    const attempts = await Promise.allSettled([
      harvestTaskBranch({ repoRoot: fixture.repository, baseBranch: "main", branchName: worktree.branchName, taskId, title: "Concurrent harvest" }),
      harvestTaskBranch({ repoRoot: fixture.repository, baseBranch: "main", branchName: worktree.branchName, taskId, title: "Concurrent harvest" }),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
    const winner = attempts.find((attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof harvestTaskBranch>>> => attempt.status === "fulfilled")!;
    assert.equal(git(fixture.repository, "rev-parse", "HEAD"), winner.value.commit);
    assertRepositoryClean(fixture.repository);
    assert.equal(await findTaskHarvestCommit({ repoRoot: fixture.repository, taskId, afterCommit: scenario.initialSha }), winner.value.commit);
    const trailerCount = git(fixture.repository, "log", "--format=%B", `${scenario.initialSha}..HEAD`).split("Agent-Farm-Task: concurrent-harvest").length - 1;
    assert.equal(trailerCount, 1);
    await removeTaskWorktree({ repoRoot: fixture.repository, worktreePath: worktree.worktreePath, branchName: worktree.branchName });
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});
