import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  createHarness,
  fileKind,
  git,
  pathExists,
  reservePort,
  sha256Bytes,
  TEST_RESULTS_ROOT,
} from "../../lib/harness.js";
import {
  assertRepositoryClean,
  commitWorktreeChange,
  createMixedWorkingTreeArtifacts,
  createTrackedBaseline,
} from "../../lib/git-artifacts.js";
import {
  cleanupRegisteredServerProcesses,
  registerServerProcess,
} from "../../lib/process-registry.js";

test("suite cleanup terminates a deliberately leaked detached server process group", async () => {
  if (process.platform === "win32") return;
  const root = await mkdtemp(join(tmpdir(), "agent-farm-process-cleanup-"));
  const registry = join(root, "server-processes.jsonl");
  const cleanupToken = randomUUID().replaceAll("-", "");
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 60_000)"], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, AGENT_FARM_E2E_CLEANUP_TOKEN: cleanupToken },
  });
  if (!child.pid) throw new Error("Leaked process fixture has no process id");
  child.unref();
  try {
    registerServerProcess(registry, {
      schema_version: "agent-farm.e2e-server-process.v1",
      state: "started",
      run_id: "process-cleanup-boundary",
      pid: child.pid,
      process_group_id: child.pid,
      port: 1,
      data_directory: root,
      cleanup_token: cleanupToken,
      registered_at: new Date().toISOString(),
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const proof = await cleanupRegisteredServerProcesses(registry, 5_000);
    assert.deepEqual(proof.registry_parse_errors, []);
    assert.deepEqual(proof.identity_mismatch_process_groups, []);
    assert.deepEqual(proof.initially_alive_process_groups, [child.pid]);
    assert.deepEqual(proof.remaining_process_groups, []);
    assert.ok(
      proof.terminated_process_groups.includes(child.pid) ||
      proof.killed_process_groups.includes(child.pid),
    );
  } finally {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // The cleanup under test should already have removed the process group.
    }
    await rm(root, { recursive: true, force: true });
  }
});

test("outer suite finally reaps a registered process after the test process exits", async () => {
  if (process.env.AGENT_FARM_E2E_PROVE_SUITE_PROCESS_CLEANUP !== "1" || process.platform === "win32") return;
  const cleanupToken = randomUUID().replaceAll("-", "");
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 60_000)"], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, AGENT_FARM_E2E_CLEANUP_TOKEN: cleanupToken },
  });
  if (!child.pid) throw new Error("Suite-level leaked process fixture has no process id");
  child.unref();
  const runId = process.env.AGENT_FARM_E2E_RUN_ID ?? "unknown";
  registerServerProcess(join(TEST_RESULTS_ROOT, "server-processes.jsonl"), {
    schema_version: "agent-farm.e2e-server-process.v1",
    state: "started",
    run_id: runId,
    pid: child.pid,
    process_group_id: child.pid,
    port: 1,
    data_directory: process.env.AGENT_FARM_DATA_DIR ?? "unknown",
    cleanup_token: cleanupToken,
    registered_at: new Date().toISOString(),
  });
  await writeFile(
    join(TEST_RESULTS_ROOT, "suite-process-cleanup-fixture.json"),
    `${JSON.stringify({
      schema_version: "agent-farm.e2e-suite-cleanup-fixture.v1",
      run_id: runId,
      process_group_id: child.pid,
    }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.doesNotThrow(() => process.kill(-child.pid!, 0));
});

test("isolated harness creates unique repos, remotes, data dirs, HOME and ports", async () => {
  const first = await createHarness("parallel-isolation");
  const second = await createHarness("parallel-isolation");
  try {
    const [firstGit, secondGit] = await Promise.all([first.createGitFixture(), second.createGitFixture()]);
    assert.notEqual(first.root, second.root);
    assert.notEqual(first.dataDir, second.dataDir);
    assert.notEqual(first.homeDir, second.homeDir);
    assert.notEqual(first.artifactDir, second.artifactDir);
    assert.notEqual(first.port, second.port);
    assert.notEqual(firstGit.repository, secondGit.repository);
    assert.notEqual(firstGit.remote, secondGit.remote);
    assert.equal(await pathExists(join(first.homeDir, ".agent-farm")), false);
    assert.equal(await pathExists(join(second.homeDir, ".agent-farm")), false);
    assert.match(git(firstGit.repository, "remote", "get-url", "origin"), /agent-farm-e2e-parallel-isolation-/);
    assert.match(git(secondGit.repository, "remote", "get-url", "origin"), /agent-farm-e2e-parallel-isolation-/);
  } finally {
    const [firstProof, secondProof] = await Promise.all([first.cleanup(), second.cleanup()]);
    for (const proof of [firstProof, secondProof]) {
      assert.equal(proof.processStopped, true);
      assert.equal(proof.dataDirectoryRemoved, true);
      assert.equal(proof.repositoryRemoved, true);
      assert.equal(proof.remoteRemoved, true);
      assert.equal(proof.worktreesPruned, true);
      assert.equal(proof.branchesRemoved, true);
    }
  }
});

test("real git artifact fixture exposes untracked, staged, renamed, deleted, binary and symlink changes", async () => {
  const harness = await createHarness("mixed-git-artifacts");
  try {
    const fixture = await harness.createGitFixture();
    await createTrackedBaseline(fixture);
    const proof = await createMixedWorkingTreeArtifacts(fixture);

    assert.equal(proof.head, fixture.initialSha);
    assert.match(proof.statusPorcelainV2, /\? changes\/untracked\.txt/);
    assert.match(proof.statusPorcelainV2, /changes\/untracked-link/);
    assert.match(proof.statusPorcelainV2, /changes\/renamed\.txt/);
    assert.match(proof.statusPorcelainV2, /changes\/delete\.txt/);
    assert.match(proof.statusPorcelainV2, /claims\/directory\/nested\/beta\.txt/);
    assert.match(proof.stagedDiff, /rename from changes\/rename-source\.txt/);
    assert.match(proof.stagedDiff, /rename to changes\/renamed\.txt/);
    assert.match(proof.stagedDiff, /deleted file mode/);
    assert.match(proof.binaryPatch, /GIT binary patch/);
    assert.equal(proof.symlink.target, "untracked.txt");
    assert.equal(await fileKind(join(fixture.repository, proof.symlink.path)), "symlink");
    assert.equal(Object.keys(proof.digests).length, 8);
    for (const digest of Object.values(proof.digests)) assert.match(digest, /^[a-f0-9]{64}$/);
    assert.equal(proof.digests.untracked, sha256Bytes(await readFile(join(fixture.repository, "changes/untracked.txt"))));
  } finally {
    const cleanup = await harness.cleanup();
    assert.deepEqual(
      Object.fromEntries(Object.entries(cleanup).filter(([key]) => key !== "checkedAt")),
      {
        processStopped: true,
        dataDirectoryRemoved: true,
        repositoryRemoved: true,
        remoteRemoved: true,
        worktreesPruned: true,
        branchesRemoved: true,
      },
    );
  }
});

test("empty diff, linked worktree cleanup and branch cleanup use real git state", async () => {
  const harness = await createHarness("worktree-cleanup");
  let linkedWorktree = "";
  try {
    const fixture = await harness.createGitFixture({ "README.md": "clean baseline\n" });
    assert.equal(git(fixture.repository, "diff", "HEAD"), "");
    assertRepositoryClean(fixture.repository);

    linkedWorktree = join(harness.root, "linked-task");
    git(fixture.repository, "worktree", "add", "--quiet", "-b", "agent-farm/e2e-linked", linkedWorktree, "main");
    const taskSha = await commitWorktreeChange(linkedWorktree, "task.txt", "real task output\n", "task output");
    assert.match(taskSha, /^[a-f0-9]{40,64}$/);
    assert.notEqual(taskSha, git(fixture.repository, "rev-parse", "main"));
    assert.equal(await pathExists(linkedWorktree), true);
  } finally {
    const cleanup = await harness.cleanup();
    assert.equal(await pathExists(linkedWorktree), false);
    assert.equal(cleanup.worktreesPruned, true);
    assert.equal(cleanup.branchesRemoved, true);
  }
});

test("dirty and missing worktree states are observed from the filesystem and git", async () => {
  const harness = await createHarness("dirty-missing-worktree");
  try {
    const fixture = await harness.createGitFixture({ "tracked.txt": "baseline\n" });
    const linked = join(harness.root, "linked-dirty");
    git(fixture.repository, "worktree", "add", "--quiet", "-b", "agent-farm/e2e-dirty", linked, "main");
    await writeFile(join(linked, "tracked.txt"), "dirty change\n");
    await mkdir(join(linked, "new-directory"));
    await writeFile(join(linked, "new-directory", "untracked.txt"), "untracked\n");
    const status = git(linked, "status", "--porcelain=v2", "--untracked-files=all");
    assert.match(status, /^1 \.M/m);
    assert.match(status, /^\? new-directory\/untracked\.txt/m);
    git(fixture.repository, "worktree", "remove", "--force", linked);
    assert.equal(await fileKind(linked), "missing");
    git(fixture.repository, "worktree", "prune", "--expire", "now");
    assert.doesNotMatch(git(fixture.repository, "worktree", "list", "--porcelain"), /linked-dirty/);
  } finally {
    const cleanup = await harness.cleanup();
    assert.equal(cleanup.worktreesPruned, true);
    assert.equal(cleanup.branchesRemoved, true);
  }
});

test("OS-assigned ports are not hard-coded and are reusable after release", async () => {
  const ports = await Promise.all(Array.from({ length: 12 }, () => reservePort()));
  assert.equal(new Set(ports).size, ports.length);
  for (const port of ports) {
    assert.ok(port > 0 && port <= 65_535);
    assert.notEqual(port, 7_878);
  }
});
