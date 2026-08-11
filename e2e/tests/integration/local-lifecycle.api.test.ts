import assert from "node:assert/strict";
import { mkdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { asObject } from "../../lib/api.js";
import { FarmApi, expectApiError } from "../../lib/farm-api.js";
import { createHarness, git, pathExists } from "../../lib/harness.js";
import { populateLifecycleRepository } from "../../lib/repository-scenarios.js";
import { LedgerCollector } from "../../lib/ws-ledger.js";

async function writeMixedDiff(worktree: string): Promise<void> {
  await writeFile(join(worktree, "untracked-real.txt"), "untracked real content\n");
  await writeFile(join(worktree, "src", "exclusive.ts"), "export const exclusive = 'staged-real';\n");
  git(worktree, "add", "src/exclusive.ts");
  await rename(join(worktree, "src", "rename-me.txt"), join(worktree, "src", "renamed-real.txt"));
  await rm(join(worktree, "src", "delete-me.txt"));
  await writeFile(join(worktree, "assets", "fixture.bin"), Uint8Array.from(Array.from({ length: 4096 }, (_, index) => (index * 31 + 7) % 256)));
  if (process.platform !== "win32") {
    await symlink("../untracked-real.txt", join(worktree, "src", "untracked-real-link"));
  }
}

test("local lifecycle uses real worktrees, diff artifacts, blocked run attempts, wilt cleanup and restart replay", { timeout: 10 * 60_000 }, async () => {
  const harness = await createHarness("local-lifecycle-api");
  let collector: LedgerCollector | null = null;
  try {
    const fixture = await harness.createGitFixture();
    await populateLifecycleRepository(fixture);
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    collector = new LedgerCollector(server.wsUrl, 0);
    await collector.connect();
    await collector.waitUntilReady();

    const task = await farm.seed({
      repoPath: fixture.repository,
      prompt: "Local non-provider task; E2E mutates the real worktree externally and does not claim Agent SDK success.",
      title: "Local real diff target",
      autoStart: false,
    });
    assert.equal(task.task.status, "seeded");
    assert.ok(task.task.worktree_path);
    assert.ok(task.task.branch_name?.startsWith("agent-farm/"));
    assert.equal(await pathExists(task.task.worktree_path!), true);
    assert.equal(task.worktree_health?.healthy, true);
    assert.equal(task.worktree_health?.dirty, false);

    const emptyDiff = asObject((await farm.http.get(`/api/tasks/${task.task.id}/diff`, 200)).body, "empty diff");
    assert.equal(emptyDiff.kind, "empty");
    assert.equal(emptyDiff.patch, "");
    assert.match(String(emptyDiff.digest), /^[a-f0-9]{64}$/);
    assert.deepEqual(emptyDiff.changed_paths, []);

    await writeMixedDiff(task.task.worktree_path!);
    const diff = asObject((await farm.http.get(`/api/tasks/${task.task.id}/diff`, 200)).body, "mixed diff");
    assert.equal(diff.kind, "binary");
    assert.match(String(diff.digest), /^[a-f0-9]{64}$/);
    assert.match(String(diff.artifact_digest), /^[a-f0-9]{64}$/);
    const changed = diff.changed_paths as string[];
    for (const expected of [
      "assets/fixture.bin",
      "src/delete-me.txt",
      "src/exclusive.ts",
      "src/rename-me.txt",
      "src/renamed-real.txt",
      "untracked-real.txt",
    ]) assert.ok(changed.includes(expected), `missing changed path ${expected}`);
    assert.match(String(diff.patch), /GIT binary patch/);
    assert.ok((diff.manifest as unknown[]).length >= 3);
    for (const artifact of diff.manifest as Array<Record<string, unknown>>) {
      assert.match(String(artifact.digest), /^[a-f0-9]{64}$/);
      assert.equal(await pathExists(String(artifact.path)), true);
    }
    const dirty = await farm.task(task.task.id);
    assert.equal(dirty.worktree_health?.dirty, true);
    assert.match(String(dirty.task.diff?.digest), /^[a-f0-9]{64}$/);

    await expectApiError(
      farm.http.post(`/api/tasks/${task.task.id}/reviews`, { decision: "approved", diff_digest: diff.digest }),
      409,
      "review_unavailable",
    );
    const blockedHarvest = await expectApiError(
      farm.http.post(`/api/tasks/${task.task.id}/harvest`, { diff_digest: diff.digest }),
      409,
      "harvest_blocked",
    );
    assert.match(JSON.stringify(blockedHarvest.body), /status:seeded|review_not_approved/);

    const start = asObject((await farm.http.post(`/api/tasks/${task.task.id}/runs`, {
      timeout_ms: 1_000,
      max_budget_usd: 0.01,
      max_turns: 1,
    }, 202)).body, "start run");
    const runId = String(start.runId);
    assert.match(runId, /^[0-9a-f-]{36}$/);
    const providerBlocked = await farm.waitForTask(
      task.task.id,
      (detail) => detail.task.status === "blocked" && detail.runs.some((run) => run.id === runId && run.status === "provider_blocked"),
      "provider-blocked terminal run",
      60_000,
    );
    assert.ok(providerBlocked.task.blocking_reasons.includes("provider_auth_blocked"));
    const firstRun = providerBlocked.runs.find((run) => run.id === runId)!;
    assert.equal(firstRun.attempt, 1);
    assert.equal(firstRun.provider_status, "blocked");
    assert.equal(firstRun.error_code, "provider_auth_missing");
    assert.equal(firstRun.cost_usd, null);
    assert.equal(firstRun.num_turns, null);
    assert.equal(asObject(firstRun.provenance, "run provenance").source, "http_api");
    assert.equal(asObject(firstRun.terminal_provenance, "run terminal provenance").source, "claude_agent_sdk");

    const retry = asObject((await farm.http.post(`/api/tasks/${task.task.id}/runs/retry`, {
      run_id: runId,
      timeout_ms: 1_000,
      max_budget_usd: 0.01,
      max_turns: 1,
    }, 202)).body, "retry run");
    const retryId = String(retry.runId);
    const retried = await farm.waitForTask(
      task.task.id,
      (detail) => detail.runs.some((run) => run.id === retryId && run.status === "provider_blocked"),
      "retry provider-blocked terminal",
      60_000,
    );
    const retryRun = retried.runs.find((run) => run.id === retryId)!;
    assert.equal(retryRun.attempt, 2);
    assert.equal(retryRun.retry_of_run_id, runId);

    const recover = asObject((await farm.http.post(`/api/tasks/${task.task.id}/runs/recover`, {
      run_id: retryId,
      timeout_ms: 1_000,
      max_budget_usd: 0.01,
      max_turns: 1,
    }, 202)).body, "recover run");
    const recoveryId = String(recover.runId);
    const recovered = await farm.waitForTask(
      task.task.id,
      (detail) => detail.runs.some((run) => run.id === recoveryId && run.status === "provider_blocked"),
      "recovery provider-blocked terminal",
      60_000,
    );
    const recoveryRun = recovered.runs.find((run) => run.id === recoveryId)!;
    assert.equal(recoveryRun.attempt, 3);
    assert.equal(recoveryRun.recovery_of_run_id, retryId);
    await expectApiError(
      farm.http.post(`/api/tasks/${task.task.id}/runs/cancel`, { run_id: recoveryId }),
      409,
      "run_not_active",
    );

    const eventsBeforeRestart = await farm.events(0);
    await collector.waitForSequence(eventsBeforeRestart.lastSeq);
    await collector.waitUntilReady();
    collector.assertContiguousThrough(eventsBeforeRestart.lastSeq);
    const disconnectSeq = collector.lastSeq;
    await collector.close(1000, "intentional restart disconnect");
    collector = null;

    const restarted = await harness.restartServer();
    const replayFarm = new FarmApi(restarted.baseUrl);
    const persisted = await replayFarm.task(task.task.id);
    assert.equal(persisted.runs.length, 3);
    assert.equal(asObject(persisted.task.diff, "persisted diff summary").digest, diff.digest);
    const replay = new LedgerCollector(restarted.wsUrl, disconnectSeq);
    collector = replay;
    await replay.connect();
    const readySeq = await replay.waitUntilReady();
    const postRestartEvents = await replayFarm.events(disconnectSeq);
    assert.equal(readySeq, postRestartEvents.lastSeq);
    if (readySeq > disconnectSeq) await replay.waitForSequence(readySeq);
    replay.assertContiguousThrough(readySeq);
    assert.equal(asObject(replay.collection.hello, "restart hello").restarted, true);

    const worktreePath = task.task.worktree_path!;
    const branchName = task.task.branch_name!;
    const wilt = asObject((await replayFarm.http.delete(`/api/tasks/${task.task.id}`, { reason: "Local E2E cleanup after provider-blocked lifecycle." }, 200)).body, "wilt response");
    assert.deepEqual(wilt.cleanup_errors, []);
    assert.equal(asObject(wilt.task, "wilt task").status, "wilted");
    assert.equal(await pathExists(worktreePath), false);
    assert.doesNotMatch(git(fixture.repository, "branch", "--list", branchName), /agent-farm/);
    const wilted = await replayFarm.task(task.task.id);
    assert.equal(wilted.task.status, "wilted");
    assert.ok(wilted.timeline.some((event) => event.type === "task.wilt.succeeded"));
    assert.ok(wilted.timeline.some((event) => event.type === "task.claim.released") === false);
  } finally {
    if (collector) await collector.close().catch(() => undefined);
    const proof = await harness.cleanup();
    assert.equal(proof.processStopped, true);
    assert.equal(proof.dataDirectoryRemoved, true);
    assert.equal(proof.repositoryRemoved, true);
    assert.equal(proof.remoteRemoved, true);
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("missing worktree is projected and wilt retains audit history", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("missing-worktree-wilt");
  try {
    const fixture = await harness.createGitFixture();
    await populateLifecycleRepository(fixture);
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const task = await farm.seed({ repoPath: fixture.repository, prompt: "Missing worktree boundary.", autoStart: false });
    const worktree = task.task.worktree_path!;
    await rm(worktree, { recursive: true, force: true });
    git(fixture.repository, "worktree", "prune", "--expire", "now");
    const missing = await farm.task(task.task.id);
    assert.equal(missing.worktree_health?.state, "missing");
    assert.equal(missing.worktree_health?.exists, false);
    assert.equal(missing.worktree_health?.registered, false);
    const missingHealth = asObject(missing.worktree_health, "missing worktree health");
    assert.ok(Array.isArray(missingHealth.blocking_reasons));
    assert.ok((missingHealth.blocking_reasons as unknown[]).some((reason) => typeof reason === "string" && /does not exist|not registered/.test(reason)));
    await expectApiError(farm.http.get(`/api/tasks/${task.task.id}/diff`), 409, "worktree_missing");
    const wilt = asObject((await farm.http.delete(`/api/tasks/${task.task.id}`, { reason: "Missing worktree cleanup." }, 200)).body, "missing wilt");
    assert.deepEqual(wilt.cleanup_errors, []);
    const persisted = await farm.task(task.task.id);
    assert.equal(persisted.task.status, "wilted");
    assert.ok(persisted.timeline.length > task.timeline.length);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});
