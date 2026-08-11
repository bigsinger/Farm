import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { asObject } from "../../lib/api.js";
import { FarmApi, expectApiError } from "../../lib/farm-api.js";
import { createHarness } from "../../lib/harness.js";
import { populateLifecycleRepository } from "../../lib/repository-scenarios.js";

test("central queue hyperedge: blocked seed, dependency group, cycle, overlaps, idempotent claims, release and path safety", { timeout: 10 * 60_000 }, async () => {
  const harness = await createHarness("queue-hyperedge-lifecycle");
  try {
    const fixture = await harness.createGitFixture();
    const scenario = await populateLifecycleRepository(fixture);
    const gitless = join(harness.root, "gitless-directory");
    await mkdir(gitless);
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);

    const gitlessTask = await farm.seed({ repoPath: gitless, prompt: "Inspect a real gitless seed.", autoStart: false });
    assert.equal(gitlessTask.task.status, "blocked");
    assert.ok(gitlessTask.task.blocking_reasons.length > 0);
    assert.ok(gitlessTask.task.blocking_reasons.some((reason) => ["gitless_repository", "repository_unavailable"].includes(reason)));
    assert.equal(gitlessTask.repository?.is_git, false);
    assert.ok(gitlessTask.timeline.some((event) => event.type === "task.seeded"));
    assert.ok(gitlessTask.timeline.every((event) => event.provenance && typeof event.provenance === "object"));

    const missingTask = await farm.seed({
      repoPath: join(harness.root, "does-not-exist", "repository"),
      prompt: "Persist the missing repository reason.",
      autoStart: false,
    });
    assert.equal(missingTask.task.status, "blocked");
    assert.ok(missingTask.task.blocking_reasons.includes("repository_unavailable"));
    assert.equal(missingTask.worktree_health, null);

    const upstream = await farm.seed({
      repoPath: fixture.repository,
      prompt: "Upstream local lifecycle task; do not auto start.",
      magnetPaths: [scenario.paths.magnet],
      autoStart: false,
    });
    const dependent = await farm.seed({
      repoPath: fixture.repository,
      prompt: "Explicitly depends on upstream.",
      dependencies: [upstream.task.id],
      autoStart: false,
    });
    assert.deepEqual(dependent.task.dependency_ids, [upstream.task.id]);
    assert.ok(dependent.group);
    assert.deepEqual(new Set(dependent.group!.task_ids as string[]), new Set([upstream.task.id, dependent.task.id]));
    assert.equal(asObject(dependent.group!.provenance, "dependency group provenance").kind, "explicit_dependency");
    assert.ok(dependent.task.blocking_reasons.some((reason) => reason.startsWith(`dependency_not_harvested:${upstream.task.id}:`)));
    await expectApiError(
      farm.http.post(`/api/tasks/${upstream.task.id}/dependencies`, { dependency_id: dependent.task.id }),
      409,
      "dependency_cycle",
    );

    const overlapOnly = await farm.seed({
      repoPath: fixture.repository,
      prompt: "Shares a magnet but no explicit dependency.",
      magnetPaths: [scenario.paths.magnet],
      autoStart: false,
    });
    assert.equal(overlapOnly.group, null);
    assert.equal(overlapOnly.task.group_id, null);
    assert.deepEqual(overlapOnly.task.dependency_ids, []);
    const magnet = overlapOnly.overlaps.find((overlap) => overlap.evidence_type === "magnet");
    assert.ok(magnet);
    assert.equal(magnet!.blocking, false);
    assert.equal(magnet!.status, "open");
    assert.match(String(asObject(magnet!.details, "magnet overlap details").other_path), /shared-context/);

    const owner = await farm.seed({
      repoPath: fixture.repository,
      prompt: "Own the parent directory exclusively.",
      claims: [{ path: scenario.paths.overlapParent, mode: "exclusive" }],
      autoStart: false,
    });
    assert.equal(owner.claims.length, 1);
    const claimId = String(owner.claims[0]!.id);
    const duplicate = await farm.http.post<Record<string, unknown>>(
      `/api/tasks/${owner.task.id}/claims`,
      { path: scenario.paths.overlapParent, mode: "exclusive" },
      201,
    );
    assert.equal(duplicate.body.claimId, claimId, "duplicate claim must return the original claim id");
    assert.equal((await farm.task(owner.task.id)).claims.filter((claim) => claim.status === "active").length, 1);

    const contender = await farm.seed({
      repoPath: fixture.repository,
      prompt: "Conflicts with the owner child path.",
      claims: [{ path: scenario.paths.overlapChild, mode: "shared" }],
      autoStart: false,
    });
    assert.ok(contender.task.blocking_reasons.includes(`claim_conflict:${scenario.paths.overlapChild}`));
    assert.equal(contender.claims.length, 0);
    const conflict = contender.overlaps.find((overlap) => overlap.evidence_type === "claim");
    assert.ok(conflict);
    assert.equal(conflict!.blocking, true);
    assert.equal(conflict!.status, "open");
    assert.equal(asObject(conflict!.provenance, "claim overlap provenance").kind, "claim_overlap");

    await farm.http.post(`/api/tasks/${owner.task.id}/claims/${claimId}/release`, {}, 200);
    const releasedOwner = await farm.task(owner.task.id);
    assert.equal(releasedOwner.claims[0]!.status, "released");
    assert.ok(releasedOwner.claims[0]!.release_provenance);

    const newClaim = await farm.http.post<Record<string, unknown>>(
      `/api/tasks/${contender.task.id}/claims`,
      { path: scenario.paths.overlapChild, mode: "shared" },
      201,
    );
    assert.match(String(newClaim.body.claimId), /^[0-9a-f-]{36}$/);
    const unblocked = await farm.task(contender.task.id);
    assert.equal(unblocked.claims.filter((claim) => claim.status === "active").length, 1);
    assert.ok(!unblocked.task.blocking_reasons.includes(`claim_conflict:${scenario.paths.overlapChild}`));

    const sharedPeer = await farm.seed({
      repoPath: fixture.repository,
      prompt: "Shared overlap is evidence, not a blocking conflict.",
      claims: [{ path: scenario.paths.overlapParent, mode: "shared" }],
      autoStart: false,
    });
    assert.equal(sharedPeer.claims.length, 1);
    const warning = sharedPeer.overlaps.find((overlap) => overlap.evidence_type === "claim");
    assert.ok(warning);
    assert.equal(warning!.blocking, false);
    assert.equal(warning!.severity, "warning");
    assert.equal(sharedPeer.group, null, "overlap alone must never create a dependency group");

    for (const unsafe of ["../escape", "/absolute/path", ".git/config", "nested/../../escape", "C:/absolute"] as const) {
      await expectApiError(
        farm.http.post(`/api/tasks/${upstream.task.id}/claims`, { path: unsafe, mode: "exclusive" }),
        400,
        "unsafe_path",
      );
    }

    const events = await farm.events(0);
    assert.equal(events.events.length, events.lastSeq);
    assert.deepEqual(events.events.map((event) => event.seq), Array.from({ length: events.lastSeq }, (_, index) => index + 1));
    assert.ok(events.events.every((event) => asObject(event.provenance, "event provenance").seq === event.seq));
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.processStopped, true);
    assert.equal(proof.dataDirectoryRemoved, true);
    assert.equal(proof.repositoryRemoved, true);
    assert.equal(proof.remoteRemoved, true);
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});
