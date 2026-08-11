import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { ApiClient, asObject } from "../../lib/api.js";
import { RESIDUAL_SCHEMA_VERSION, validateResidualBenchmark, type ResidualBenchmark } from "../../lib/benchmark.js";
import { FarmApi, type TaskDetailWire } from "../../lib/farm-api.js";
import { createHarness, git } from "../../lib/harness.js";
import {
  applyControlledCorruptionFixture,
  findSqliteDatabase,
  sqliteJson,
  type CorruptionFixtureManifest,
} from "../../lib/sqlite.js";

type SqlParameter = string | number | null;
type SqlStatement = { sql: string; parameters?: readonly SqlParameter[] };

interface Finding extends Record<string, unknown> {
  id: string;
  type: string;
  severity: string;
  task_id?: string;
  run_id?: string;
  repository_id?: string;
  source_event_seq: number;
  provenance: { kind: string; source: string; observed_at: string; digest: string };
  evidence: Record<string, unknown>;
}

interface HarvestFixture {
  statements: SqlStatement[];
  terminalEventIds: string[];
}

const AUDIT_INSERT = `
  INSERT INTO audit_events (
    event_id, event_type, entity_type, entity_id, repository_id, task_id, run_id,
    actor, payload_json, provenance_kind, provenance_source, provenance_digest, occurred_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function responseArtifact(value: unknown): ResidualBenchmark {
  const root = asObject(value, "benchmark response");
  if (root.schema_version === RESIDUAL_SCHEMA_VERSION) return validateResidualBenchmark(root);
  for (const key of ["artifact", "benchmark", "result"] as const) {
    const candidate = root[key];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const object = candidate as Record<string, unknown>;
      if (object.schema_version === RESIDUAL_SCHEMA_VERSION) return validateResidualBenchmark(object);
    }
  }
  throw new TypeError(`Benchmark response does not contain ${RESIDUAL_SCHEMA_VERSION}`);
}

async function generate(api: ApiClient): Promise<ResidualBenchmark> {
  return responseArtifact((await api.post<unknown>("/api/benchmarks/residual", {}, 201)).body);
}

function findingsOf(artifact: ResidualBenchmark, type: string): Finding[] {
  return artifact.residuals
    .filter((entry) => entry.type === type)
    .map((entry) => entry as unknown as Finding);
}

function findingForTask(artifact: ResidualBenchmark, type: string, taskId: string): Finding {
  const matches = findingsOf(artifact, type).filter((entry) => entry.task_id === taskId);
  assert.equal(matches.length, 1, `expected one ${type} finding for ${taskId}, got ${JSON.stringify(matches)}`);
  return matches[0]!;
}

function sortedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortedJson(child)]),
    );
  }
  return value;
}

function expectedFindingDigest(finding: Finding): string {
  const identity = JSON.stringify(sortedJson({
    type: finding.type,
    task_id: finding.task_id ?? null,
    run_id: finding.run_id ?? null,
    repository_id: finding.repository_id ?? null,
    evidence: finding.evidence,
  }));
  return createHash("sha256").update(identity).digest("hex");
}

function assertArtifactWireShape(artifact: ResidualBenchmark): void {
  assert.deepEqual(Object.keys(artifact).sort(), [
    "artifact_id",
    "cleanup_proof",
    "generated_at",
    "ledger",
    "provider_proof",
    "residuals",
    "schema_version",
    "scope",
    "sha256",
    "summary",
  ]);
  const allowedFindingKeys = new Set([
    "id",
    "type",
    "severity",
    "task_id",
    "run_id",
    "repository_id",
    "detected_at",
    "source_event_seq",
    "provenance",
    "evidence",
    "remediation",
  ]);
  for (const finding of artifact.residuals as unknown as Finding[]) {
    assert.deepEqual(Object.keys(finding).filter((key) => !allowedFindingKeys.has(key)), []);
    assert.deepEqual(Object.keys(finding.provenance).sort(), ["digest", "kind", "observed_at", "source"]);
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function auditStatement(input: {
  eventId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  repositoryId: string;
  taskId: string;
  runId?: string | null;
  payload: Record<string, unknown>;
  provenanceKind: string;
  provenanceSource: string;
  provenanceDigest: string;
  occurredAt: number;
}): SqlStatement {
  return {
    sql: AUDIT_INSERT,
    parameters: [
      input.eventId,
      input.eventType,
      input.entityType,
      input.entityId,
      input.repositoryId,
      input.taskId,
      input.runId ?? null,
      "e2e-residual-fixture",
      JSON.stringify(input.payload),
      input.provenanceKind,
      input.provenanceSource,
      input.provenanceDigest,
      input.occurredAt,
    ],
  };
}

async function harvestFixture(input: {
  task: TaskDetailWire;
  commit: string;
  dataDir: string;
  timestamp: number;
  outcomeCount?: number;
}): Promise<HarvestFixture> {
  const taskId = input.task.task.id;
  const repositoryId = input.task.task.repository_id;
  const patchContents = `diff --git a/${taskId}.txt b/${taskId}.txt\nfixture ${taskId}\n`;
  const diffDigest = digest(patchContents);
  const patchPath = join(input.dataDir, "artifacts", taskId, "residual-fixture.patch");
  await mkdir(dirname(patchPath), { recursive: true });
  await writeFile(patchPath, patchContents);

  const patchEventId = `fixture-patch-${randomUUID()}`;
  const reviewEventId = `fixture-review-${randomUUID()}`;
  const artifactId = randomUUID();
  const reviewId = randomUUID();
  const statements: SqlStatement[] = [
    auditStatement({
      eventId: patchEventId,
      eventType: "task.artifact.created",
      entityType: "artifact",
      entityId: artifactId,
      repositoryId,
      taskId,
      payload: {
        kind: "patch",
        path: patchPath,
        sha256: diffDigest,
        size_bytes: Buffer.byteLength(patchContents),
        metadata: { changed_paths: [`${taskId}.txt`], diff_digest: diffDigest },
      },
      provenanceKind: "git_artifact",
      provenanceSource: "git_diff",
      provenanceDigest: diffDigest,
      occurredAt: input.timestamp,
    }),
    auditStatement({
      eventId: reviewEventId,
      eventType: "task.review.approved",
      entityType: "review",
      entityId: reviewId,
      repositoryId,
      taskId,
      payload: { decision: "approved", diff_digest: diffDigest, summary: "Residual lineage fixture approval." },
      provenanceKind: "human_review",
      provenanceSource: "http_api",
      provenanceDigest: diffDigest,
      occurredAt: input.timestamp + 1,
    }),
    {
      sql: `
        INSERT INTO artifacts (
          id, task_id, run_id, kind, path, media_type, size_bytes, sha256,
          metadata_json, created_at, source_event_seq
        ) VALUES (?, ?, NULL, 'patch', ?, 'text/x-diff', ?, ?, ?, ?,
          (SELECT seq FROM audit_events WHERE event_id = ?))
      `,
      parameters: [
        artifactId,
        taskId,
        patchPath,
        Buffer.byteLength(patchContents),
        diffDigest,
        JSON.stringify({ changed_paths: [`${taskId}.txt`], diff_digest: diffDigest }),
        input.timestamp,
        patchEventId,
      ],
    },
    {
      sql: `
        INSERT INTO reviews (id, task_id, decision, diff_digest, summary, reviewer, created_at, source_event_seq)
        VALUES (?, ?, 'approved', ?, ?, 'e2e-residual-fixture', ?,
          (SELECT seq FROM audit_events WHERE event_id = ?))
      `,
      parameters: [reviewId, taskId, diffDigest, "Residual lineage fixture approval.", input.timestamp + 1, reviewEventId],
    },
    {
      sql: `
        UPDATE tasks SET status = 'harvested', review_status = 'approved', outcome_status = 'succeeded',
          current_diff_digest = ?, approved_diff_digest = ?, harvest_commit = ?, updated_at = ?
        WHERE id = ?
      `,
      parameters: [diffDigest, diffDigest, input.commit, input.timestamp + 20, taskId],
    },
  ];

  const terminalEventIds: string[] = [];
  for (let index = 0; index < (input.outcomeCount ?? 1); index += 1) {
    const operationId = randomUUID();
    const outcomeId = randomUUID();
    const startedEventId = `fixture-harvest-start-${randomUUID()}`;
    const terminalEventId = `fixture-harvest-terminal-${randomUUID()}`;
    terminalEventIds.push(terminalEventId);
    statements.push(
      auditStatement({
        eventId: startedEventId,
        eventType: "task.harvest.started",
        entityType: "operation",
        entityId: operationId,
        repositoryId,
        taskId,
        payload: { pre_commit: input.task.task.base_commit ?? null, diff_digest: diffDigest },
        provenanceKind: "human_confirmation",
        provenanceSource: "http_api",
        provenanceDigest: diffDigest,
        occurredAt: input.timestamp + 2 + index * 2,
      }),
      auditStatement({
        eventId: terminalEventId,
        eventType: "task.harvest.succeeded",
        entityType: "outcome",
        entityId: operationId,
        repositoryId,
        taskId,
        payload: {
          commit: input.commit,
          pre_commit: input.task.task.base_commit ?? null,
          diff_digest: diffDigest,
        },
        provenanceKind: "git_commit",
        provenanceSource: "git",
        provenanceDigest: input.commit,
        occurredAt: input.timestamp + 3 + index * 2,
      }),
      {
        sql: `
          INSERT INTO outcomes (
            id, task_id, type, status, operation_id, commit_sha, diff_digest, created_at, source_event_seq
          ) VALUES (?, ?, 'harvest', 'succeeded', ?, ?, ?, ?,
            (SELECT seq FROM audit_events WHERE event_id = ?))
        `,
        parameters: [
          outcomeId,
          taskId,
          operationId,
          input.commit,
          diffDigest,
          input.timestamp + 3 + index * 2,
          startedEventId,
        ],
      },
    );
  }
  return { statements, terminalEventIds };
}

async function applyFixture(input: {
  database: string;
  dataDir: string;
  artifactDir: string;
  purpose: string;
  statements: SqlStatement[];
}): Promise<CorruptionFixtureManifest> {
  return applyControlledCorruptionFixture({
    ...input,
    corruption_fixture: true,
  });
}

async function eventSeq(database: string, dataDir: string, eventId: string): Promise<number> {
  assert.match(eventId, /^[A-Za-z0-9-]+$/);
  const rows = await sqliteJson<{ seq: number }>(
    database,
    dataDir,
    `SELECT seq FROM audit_events WHERE event_id = '${eventId}';`,
  );
  assert.equal(rows.length, 1);
  return rows[0]!.seq;
}

function stableFindingProjection(finding: Finding): Record<string, unknown> {
  return {
    id: finding.id,
    type: finding.type,
    severity: finding.severity,
    task_id: finding.task_id ?? null,
    run_id: finding.run_id ?? null,
    repository_id: finding.repository_id ?? null,
    source_event_seq: finding.source_event_seq,
    provenance_kind: finding.provenance.kind,
    provenance_source: finding.provenance.source,
    provenance_digest: finding.provenance.digest,
    evidence: finding.evidence,
  };
}

test("residual review lineage verifies real base ancestry, commit existence, exact trailer and SQLite provenance", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("residual-review-lineage");
  try {
    const fixture = await harness.createGitFixture();
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const tasks = await Promise.all([
      farm.seed({ repoPath: fixture.repository, prompt: "Detached harvested commit residual.", autoStart: false }),
      farm.seed({ repoPath: fixture.repository, prompt: "Missing harvested commit residual.", autoStart: false }),
      farm.seed({ repoPath: fixture.repository, prompt: "Missing exact trailer residual.", autoStart: false }),
    ]);
    await harness.stopServer();

    await writeFile(join(fixture.repository, "detached-harvest.txt"), "detached harvest\n");
    git(fixture.repository, "add", "detached-harvest.txt");
    git(
      fixture.repository,
      "commit",
      "--quiet",
      "-m",
      "detached harvested projection",
      "-m",
      `Agent-Farm-Task: ${tasks[0]!.task.id}`,
    );
    const detachedCommit = git(fixture.repository, "rev-parse", "HEAD");
    git(fixture.repository, "tag", `keep-${tasks[0]!.task.id}`, detachedCommit);
    git(fixture.repository, "reset", "--hard", fixture.initialSha);

    await writeFile(join(fixture.repository, "no-trailer-harvest.txt"), "no exact trailer\n");
    git(fixture.repository, "add", "no-trailer-harvest.txt");
    git(fixture.repository, "commit", "--quiet", "-m", "harvest projection without task trailer");
    const noTrailerCommit = git(fixture.repository, "rev-parse", "HEAD");
    const missingCommit = "f".repeat(40);

    const database = await findSqliteDatabase(harness.dataDir);
    const timestamp = Date.now();
    const harvests = await Promise.all([
      harvestFixture({ task: tasks[0]!, commit: detachedCommit, dataDir: harness.dataDir, timestamp }),
      harvestFixture({ task: tasks[1]!, commit: missingCommit, dataDir: harness.dataDir, timestamp: timestamp + 100 }),
      harvestFixture({ task: tasks[2]!, commit: noTrailerCommit, dataDir: harness.dataDir, timestamp: timestamp + 200 }),
    ]);
    await applyFixture({
      database,
      dataDir: harness.dataDir,
      artifactDir: harness.artifactDir,
      purpose: "project coherent harvested SQLite lineage onto three distinct invalid real Git boundaries",
      statements: harvests.flatMap((entry) => entry.statements),
    });

    const restarted = await harness.restartServer();
    const api = new ApiClient(restarted.baseUrl);
    const first = await generate(api);
    const second = await generate(api);
    assertArtifactWireShape(first);
    assert.equal(first.schema_version, RESIDUAL_SCHEMA_VERSION);

    const expectedReasons = new Map([
      [tasks[0]!.task.id, "harvest_commit_not_on_base_branch"],
      [tasks[1]!.task.id, "harvest_commit_missing"],
      [tasks[2]!.task.id, "harvest_commit_missing_exact_task_trailer"],
    ]);
    for (let index = 0; index < tasks.length; index += 1) {
      const taskId = tasks[index]!.task.id;
      const finding = findingForTask(first, "review_merge_mismatch", taskId);
      const replay = findingForTask(second, "review_merge_mismatch", taskId);
      assert.equal(replay.id, finding.id);
      assert.equal(replay.source_event_seq, finding.source_event_seq);
      assert.equal(replay.provenance.digest, finding.provenance.digest);
      assert.deepEqual(replay.evidence, finding.evidence);
      assert.deepEqual(stableFindingProjection(replay), stableFindingProjection(finding));
      assert.equal(finding.provenance.kind, "review_merge_lineage_comparison");
      assert.equal(finding.provenance.source, "tasks+reviews+outcomes+artifacts+audit_events+git");
      assert.equal(finding.provenance.digest, expectedFindingDigest(finding));
      assert.equal(finding.id, `res_${finding.provenance.digest.slice(0, 32)}`);
      assert.equal(finding.source_event_seq, await eventSeq(
        database,
        harness.dataDir,
        harvests[index]!.terminalEventIds.at(-1)!,
      ));

      const reasons = finding.evidence.reasons;
      assert.ok(Array.isArray(reasons));
      assert.ok(reasons.includes(expectedReasons.get(taskId)));
      const checks = asObject(finding.evidence.lineage_checks, "lineage checks");
      assert.equal(checks.diff_provenance_valid, true);
      assert.equal(checks.approval_provenance_valid, true);
      assert.equal(checks.outcome_provenance_valid, true);
      assert.equal(checks.terminal_provenance_valid, true);
    }

    const detachedGit = asObject(
      findingForTask(first, "review_merge_mismatch", tasks[0]!.task.id).evidence.git,
      "detached git evidence",
    );
    assert.equal(detachedGit.commit_exists, true);
    assert.equal(detachedGit.commit_on_base_branch, false);
    assert.equal(detachedGit.exact_task_trailer, true);

    const missingGit = asObject(
      findingForTask(first, "review_merge_mismatch", tasks[1]!.task.id).evidence.git,
      "missing git evidence",
    );
    assert.equal(missingGit.commit_exists, false);
    assert.equal(missingGit.commit_on_base_branch, false);
    assert.equal(missingGit.exact_task_trailer, false);

    const trailerGit = asObject(
      findingForTask(first, "review_merge_mismatch", tasks[2]!.task.id).evidence.git,
      "trailer git evidence",
    );
    assert.equal(trailerGit.commit_exists, true);
    assert.equal(trailerGit.commit_on_base_branch, true);
    assert.equal(trailerGit.exact_task_trailer, false);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.processStopped, true);
    assert.equal(proof.dataDirectoryRemoved, true);
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("residual cardinality catches duplicate wilt, cancel and harvest while absent SDK costs remain absent", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("residual-terminal-cost");
  try {
    const fixture = await harness.createGitFixture();
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const [wiltTask, cancelTask, harvestTask, runTask] = await Promise.all([
      farm.seed({ repoPath: fixture.repository, prompt: "Duplicate wilt residual.", autoStart: false }),
      farm.seed({ repoPath: fixture.repository, prompt: "Duplicate cancel residual.", autoStart: false }),
      farm.seed({ repoPath: fixture.repository, prompt: "Duplicate harvest residual.", autoStart: false }),
      farm.seed({ repoPath: fixture.repository, prompt: "Terminal null cost boundary.", autoStart: false }),
    ]);
    await farm.http.delete(`/api/tasks/${wiltTask.task.id}`, { reason: "First successful wilt outcome." }, 200);
    await harness.stopServer();

    for (const task of [cancelTask, harvestTask]) {
      git(fixture.repository, "worktree", "remove", "--force", task.task.worktree_path!);
    }
    git(fixture.repository, "worktree", "prune", "--expire", "now");

    await writeFile(join(fixture.repository, "duplicate-harvest.txt"), "duplicate harvest\n");
    git(fixture.repository, "add", "duplicate-harvest.txt");
    git(
      fixture.repository,
      "commit",
      "--quiet",
      "-m",
      "valid duplicate harvest projection",
      "-m",
      `Agent-Farm-Task: ${harvestTask.task.id}`,
    );
    const harvestCommit = git(fixture.repository, "rev-parse", "HEAD");
    const database = await findSqliteDatabase(harness.dataDir);
    const timestamp = Date.now();
    const duplicateHarvest = await harvestFixture({
      task: harvestTask,
      commit: harvestCommit,
      dataDir: harness.dataDir,
      timestamp,
      outcomeCount: 2,
    });

    const duplicateWiltEventId = `fixture-wilt-${randomUUID()}`;
    const cancelEventIds = [`fixture-cancel-${randomUUID()}`, `fixture-cancel-${randomUUID()}`];
    const statements: SqlStatement[] = [
      ...duplicateHarvest.statements,
      auditStatement({
        eventId: duplicateWiltEventId,
        eventType: "task.wilt.succeeded",
        entityType: "outcome",
        entityId: randomUUID(),
        repositoryId: wiltTask.task.repository_id,
        taskId: wiltTask.task.id,
        payload: { reason: "Second successful wilt outcome.", cleanup_errors: [] },
        provenanceKind: "cleanup_proof",
        provenanceSource: "git_worktree",
        provenanceDigest: digest("second-wilt"),
        occurredAt: timestamp + 100,
      }),
      {
        sql: `
          INSERT INTO outcomes (id, task_id, type, status, operation_id, reason, created_at, source_event_seq)
          VALUES (?, ?, 'wilt', 'succeeded', ?, ?, ?,
            (SELECT seq FROM audit_events WHERE event_id = ?))
        `,
        parameters: [
          randomUUID(),
          wiltTask.task.id,
          randomUUID(),
          "Second successful wilt outcome.",
          timestamp + 100,
          duplicateWiltEventId,
        ],
      },
      {
        sql: "UPDATE tasks SET status = 'cancelled', outcome_status = 'succeeded', updated_at = ? WHERE id = ?",
        parameters: [timestamp + 120, cancelTask.task.id],
      },
    ];

    for (let index = 0; index < cancelEventIds.length; index += 1) {
      const operationId = randomUUID();
      statements.push(
        auditStatement({
          eventId: cancelEventIds[index]!,
          eventType: "task.cancel.succeeded",
          entityType: "outcome",
          entityId: operationId,
          repositoryId: cancelTask.task.repository_id,
          taskId: cancelTask.task.id,
          payload: { reason: `Successful cancel ${index + 1}.` },
          provenanceKind: "terminal_outcome",
          provenanceSource: "sqlite_fixture",
          provenanceDigest: digest(`cancel-${index}`),
          occurredAt: timestamp + 121 + index,
        }),
        {
          sql: `
            INSERT INTO outcomes (id, task_id, type, status, operation_id, reason, created_at, source_event_seq)
            VALUES (?, ?, 'cancel', 'succeeded', ?, ?, ?,
              (SELECT seq FROM audit_events WHERE event_id = ?))
          `,
          parameters: [
            randomUUID(),
            cancelTask.task.id,
            operationId,
            `Successful cancel ${index + 1}.`,
            timestamp + 121 + index,
            cancelEventIds[index]!,
          ],
        },
      );
    }

    const runCases = [
      { id: randomUUID(), status: "crashed", cost: null },
      { id: randomUUID(), status: "cancelled", cost: null },
      { id: randomUUID(), status: "timed_out", cost: null },
      { id: randomUUID(), status: "failed", cost: 1.25 },
    ] as const;
    for (let index = 0; index < runCases.length; index += 1) {
      const run = runCases[index]!;
      const queuedEventId = `fixture-run-queued-${randomUUID()}`;
      const terminalEventId = `fixture-run-terminal-${randomUUID()}`;
      statements.push(
        auditStatement({
          eventId: queuedEventId,
          eventType: "agent.run.queued",
          entityType: "agent_run",
          entityId: run.id,
          repositoryId: runTask.task.repository_id,
          taskId: runTask.task.id,
          runId: run.id,
          payload: { attempt: index + 1 },
          provenanceKind: "agent_sdk_run",
          provenanceSource: "http_api",
          provenanceDigest: digest(`run-queued-${index}`),
          occurredAt: timestamp + 200 + index * 2,
        }),
        auditStatement({
          eventId: terminalEventId,
          eventType: `agent.run.${run.status}`,
          entityType: "agent_run",
          entityId: run.id,
          repositoryId: runTask.task.repository_id,
          taskId: runTask.task.id,
          runId: run.id,
          payload: { status: run.status, cost_usd: run.cost },
          provenanceKind: "agent_sdk_terminal",
          provenanceSource: "claude_agent_sdk",
          provenanceDigest: digest(`run-terminal-${index}`),
          occurredAt: timestamp + 201 + index * 2,
        }),
        {
          sql: `
            INSERT INTO agent_runs (
              id, task_id, attempt, status, provider_status, provider, started_at, heartbeat_at,
              ended_at, cost_usd, created_at, source_event_seq, terminal_event_seq
            ) VALUES (?, ?, ?, ?, 'failed', 'claude_agent_sdk', ?, ?, ?, ?, ?,
              (SELECT seq FROM audit_events WHERE event_id = ?),
              (SELECT seq FROM audit_events WHERE event_id = ?))
          `,
          parameters: [
            run.id,
            runTask.task.id,
            index + 1,
            run.status,
            timestamp + 200 + index * 2,
            timestamp + 201 + index * 2,
            timestamp + 201 + index * 2,
            run.cost,
            timestamp + 200 + index * 2,
            queuedEventId,
            terminalEventId,
          ],
        },
      );
    }

    await applyFixture({
      database,
      dataDir: harness.dataDir,
      artifactDir: harness.artifactDir,
      purpose: "duplicate same-type terminal outcomes and terminal SDK cost absence boundaries",
      statements,
    });

    const restarted = await harness.restartServer();
    const artifact = await generate(new ApiClient(restarted.baseUrl));
    const expectedTerminalTypes = new Map([
      [wiltTask.task.id, "wilt"],
      [cancelTask.task.id, "cancel"],
      [harvestTask.task.id, "harvest"],
    ]);
    for (const [taskId, terminalType] of expectedTerminalTypes) {
      const finding = findingForTask(artifact, "double_terminal", taskId);
      const counts = asObject(finding.evidence.terminal_counts, "terminal counts");
      assert.equal(counts[terminalType], 2);
      assert.deepEqual(finding.evidence.terminal_kinds, [terminalType]);
    }
    assert.equal(
      findingsOf(artifact, "review_merge_mismatch").some((finding) => finding.task_id === harvestTask.task.id),
      false,
    );

    const costFindings = findingsOf(artifact, "cost_event_mismatch");
    const actualMismatch = runCases[3];
    assert.deepEqual(costFindings.map((finding) => finding.run_id), [actualMismatch.id]);
    assert.equal(costFindings[0]!.evidence.projected_cost_usd, actualMismatch.cost);
    assert.equal(costFindings[0]!.evidence.result_event_cost_usd, null);
    assert.equal(costFindings[0]!.evidence.result_event_found, false);
    for (const noResult of runCases.slice(0, 3)) {
      assert.equal(costFindings.some((finding) => finding.run_id === noResult.id), false);
    }
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("blocked, failed and recovery-required tasks with projected missing worktrees are dangling", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("residual-dangling-retryable");
  try {
    const fixture = await harness.createGitFixture();
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const tasks = await Promise.all([
      farm.seed({ repoPath: fixture.repository, prompt: "Blocked missing worktree.", autoStart: false }),
      farm.seed({ repoPath: fixture.repository, prompt: "Failed missing worktree.", autoStart: false }),
      farm.seed({ repoPath: fixture.repository, prompt: "Recovery missing worktree.", autoStart: false }),
    ]);
    await harness.stopServer();
    for (const task of tasks) git(fixture.repository, "worktree", "remove", "--force", task.task.worktree_path!);
    git(fixture.repository, "worktree", "prune", "--expire", "now");

    const database = await findSqliteDatabase(harness.dataDir);
    const statuses = ["blocked", "failed", "recovery_required"] as const;
    await applyFixture({
      database,
      dataDir: harness.dataDir,
      artifactDir: harness.artifactDir,
      purpose: "retryable and recoverable task projections retain paths to physically removed real worktrees",
      statements: tasks.map((task, index) => ({
        sql: "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?",
        parameters: [statuses[index]!, Date.now() + index, task.task.id],
      })),
    });

    const restarted = await harness.restartServer();
    const api = new ApiClient(restarted.baseUrl);
    const first = await generate(api);
    const second = await generate(api);
    for (let index = 0; index < tasks.length; index += 1) {
      const task = tasks[index]!;
      const finding = findingForTask(first, "dangling_task", task.task.id);
      assert.equal(finding.evidence.task_status, statuses[index]);
      assert.equal(finding.evidence.reason, "projected_worktree_is_missing");
      assert.equal(finding.evidence.path, task.task.worktree_path);
      const replay = findingForTask(second, "dangling_task", task.task.id);
      assert.equal(replay.id, finding.id);
      assert.equal(replay.source_event_seq, finding.source_event_seq);
      assert.equal(replay.provenance.digest, finding.provenance.digest);
      assert.deepEqual(replay.evidence, finding.evidence);
      assert.deepEqual(stableFindingProjection(replay), stableFindingProjection(finding));
    }
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});

test("symlinked data path is canonically matched and terminal retained worktree keeps task ownership", { timeout: 5 * 60_000 }, async () => {
  const harness = await createHarness("residual-symlink-ownership");
  try {
    const fixture = await harness.createGitFixture();
    const server = await harness.startServer();
    const farm = new FarmApi(server.baseUrl);
    const task = await farm.seed({ repoPath: fixture.repository, prompt: "Canonical terminal worktree ownership.", autoStart: false });
    const canonicalWorktree = await realpath(task.task.worktree_path!);
    await harness.stopServer();

    const worktreeAlias = join(harness.root, "worktree-alias");
    await symlink(canonicalWorktree, worktreeAlias, "dir");
    const database = await findSqliteDatabase(harness.dataDir);
    await applyFixture({
      database,
      dataDir: harness.dataDir,
      artifactDir: harness.artifactDir,
      purpose: "terminal task deliberately retains a real registered worktree while data root is reached through a symlink alias",
      statements: [{
        sql: "UPDATE tasks SET status = 'wilted', outcome_status = 'succeeded', worktree_path = ?, updated_at = ? WHERE id = ?",
        parameters: [worktreeAlias, Date.now(), task.task.id],
      }],
    });
    const dataAlias = join(harness.root, "data-alias");
    await symlink(harness.dataDir, dataAlias, "dir");

    const restarted = await harness.restartServer({ AGENT_FARM_DATA_DIR: dataAlias });
    const artifact = await generate(new ApiClient(restarted.baseUrl));
    const finding = findingForTask(artifact, "orphan_worktree", task.task.id);
    assert.equal(finding.repository_id, task.task.repository_id);
    assert.equal(finding.evidence.reason, "terminal_task_retains_worktree");
    assert.equal(finding.evidence.path, canonicalWorktree);
    assert.equal(finding.provenance.source, await realpath(join(dataAlias, "worktrees")));
    assert.equal(
      findingsOf(artifact, "orphan_worktree").some((entry) =>
        entry.task_id === undefined && entry.evidence.reason === "directory_has_no_task_projection"),
      false,
    );

    const cleanup = asObject(artifact.cleanup_proof, "cleanup proof");
    assert.ok((cleanup.checked_paths as unknown[]).includes(canonicalWorktree));
    assert.ok((cleanup.remaining_paths as unknown[]).includes(canonicalWorktree));
    assert.equal(JSON.stringify(cleanup).includes(dataAlias), false);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});
