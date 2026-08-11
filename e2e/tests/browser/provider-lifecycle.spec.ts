import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { asObject } from "../../lib/api.js";
import { FarmApi } from "../../lib/farm-api.js";
import { git } from "../../lib/harness.js";
import { populateLifecycleRepository } from "../../lib/repository-scenarios.js";
import { LedgerCollector } from "../../lib/ws-ledger.js";
import { providerTest, expect } from "../helpers/provider-fixture.js";

function reportedTokenCount(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.reduce((sum, entry) => sum + reportedTokenCount(entry), 0);
  return Object.entries(value).reduce((sum, [key, entry]) => {
    const normalizedKey = key.replace(/[^a-z]/gi, "").toLowerCase();
    if (normalizedKey.endsWith("tokens") && typeof entry === "number" && Number.isFinite(entry) && entry > 0) {
      return sum + entry;
    }
    return sum + reportedTokenCount(entry);
  }, 0);
}

providerTest("@provider real Agent SDK: parallel tasks, provenance, review, harvest, wilt and restart replay", async ({ providerHarness }) => {
  providerTest.setTimeout(15 * 60_000);
  const fixture = await providerHarness.createGitFixture();
  const scenario = await populateLifecycleRepository(fixture);
  if (!providerHarness.server) throw new Error("Provider server is not running");
  let farm = new FarmApi(providerHarness.server.baseUrl);
  let collector: LedgerCollector | null = new LedgerCollector(providerHarness.server.wsUrl, 0);
  await collector.connect();
  await collector.waitUntilReady();

  try {
    const [taskA, taskB] = await Promise.all([
      farm.seed({
        repoPath: fixture.repository,
        title: "Provider task A harvest",
        prompt: "Edit only src/provider/task-a.txt so its full content is exactly `provider task A completed by real SDK` followed by one newline. Do not modify any other file. Verify git diff, then finish.",
        claims: [{ path: scenario.paths.magnet, mode: "shared" }],
        magnetPaths: [scenario.paths.magnet],
        autoStart: false,
      }),
      farm.seed({
        repoPath: fixture.repository,
        title: "Provider task B wilt",
        prompt: "Edit only src/provider/task-b.txt so its full content is exactly `provider task B completed by real SDK` followed by one newline. Do not modify any other file. Verify git diff, then finish.",
        claims: [{ path: scenario.paths.magnet, mode: "shared" }],
        magnetPaths: [scenario.paths.magnet],
        autoStart: false,
      }),
    ]);
    const runOptions = { timeout_ms: 240_000, max_budget_usd: 1.5, max_turns: 8 };
    const [startA, startB] = await Promise.all([
      farm.http.post<Record<string, unknown>>(`/api/tasks/${taskA.task.id}/runs`, runOptions, 202),
      farm.http.post<Record<string, unknown>>(`/api/tasks/${taskB.task.id}/runs`, runOptions, 202),
    ]);
    const runAId = String(startA.body.runId);
    const runBId = String(startB.body.runId);
    expect(runAId).toMatch(/^[0-9a-f-]{36}$/);
    expect(runBId).toMatch(/^[0-9a-f-]{36}$/);

    const terminalStatuses = new Set(["review_pending", "blocked", "failed", "cancelled", "recovery_required"]);
    const [readyA, readyB] = await Promise.all([
      farm.waitForTask(taskA.task.id, (detail) => terminalStatuses.has(detail.task.status), "provider task A terminal state", 6 * 60_000),
      farm.waitForTask(taskB.task.id, (detail) => terminalStatuses.has(detail.task.status), "provider task B terminal state", 6 * 60_000),
    ]);
    const attemptedRuns = [
      readyA.runs.find((run) => run.id === runAId),
      readyB.runs.find((run) => run.id === runBId),
    ];
    expect(attemptedRuns.every(Boolean)).toBe(true);
    const providerBlocked = attemptedRuns.some((run) => run?.status === "provider_blocked");
    if (providerBlocked) {
      expect(attemptedRuns.every((run) => run?.status === "provider_blocked" || run?.status === "succeeded")).toBe(true);
      for (const [detail, run] of [[readyA, attemptedRuns[0]], [readyB, attemptedRuns[1]]] as const) {
        expect(String(run?.session_id)).not.toBe("");
        expect(asObject(run?.provenance, "blocked provider run provenance").source).toBe("http_api");
        expect(asObject(run?.terminal_provenance, "blocked provider terminal provenance").source).toBe("claude_agent_sdk");
        expect(detail.timeline.some((event) => event.type === "agent.run.started")).toBe(true);
        if (run?.status === "provider_blocked") {
          expect(run.provider_status).toBe("blocked");
          expect(run.error_code).toBe("provider_auth_failed");
          expect(detail.task.status).toBe("blocked");
          expect(detail.task.blocking_reasons).toContain("provider_auth_blocked");
          expect(detail.timeline.some((event) => event.type === "agent.run.provider_blocked")).toBe(true);
        }
      }

      const beforeCleanup = await farm.events(0);
      await collector.waitForSequence(beforeCleanup.lastSeq);
      collector.assertContiguousThrough(beforeCleanup.lastSeq);
      const resumeAfter = collector.lastSeq;
      for (const detail of [readyA, readyB]) {
        const wilted = asObject((await farm.http.delete(`/api/tasks/${detail.task.id}`, {
          reason: "Runtime provider authentication was blocked; clean up the real E2E worktree.",
        }, 200)).body, "provider-blocked wilt");
        expect(asObject(wilted.task, "provider-blocked wilt task").status).toBe("wilted");
      }
      const afterCleanup = await farm.events(resumeAfter);
      await collector.waitForSequence(afterCleanup.lastSeq);
      collector.assertContiguousThrough(afterCleanup.lastSeq);
      await collector.close();
      collector = null;

      const restarted = await providerHarness.restartServer({ AGENT_FARM_RUN_PROVIDER_E2E: "1" });
      farm = new FarmApi(restarted.baseUrl);
      const replay = new LedgerCollector(restarted.wsUrl, resumeAfter);
      collector = replay;
      await replay.connect();
      const readySeq = await replay.waitUntilReady();
      if (readySeq > resumeAfter) await replay.waitForSequence(readySeq);
      replay.assertContiguousThrough(readySeq);
      expect((await farm.task(taskA.task.id)).task.status).toBe("wilted");
      expect((await farm.task(taskB.task.id)).task.status).toBe("wilted");

      const reportedCosts = attemptedRuns.map((run) => typeof run?.cost_usd === "number" ? run.cost_usd : null);
      const proof = {
        schema_version: "agent-farm.e2e-provider-proof.v1",
        generated_at: new Date().toISOString(),
        provider_status: "blocked",
        reason: "provider_auth_failed",
        runtime_attempted: true,
        tasks: [taskA.task.id, taskB.task.id],
        runs: [runAId, runBId],
        sessions: attemptedRuns.map((run) => run?.session_id),
        terminal_statuses: attemptedRuns.map((run) => run?.status),
        result_subtypes: attemptedRuns.map((run) => run?.result_subtype),
        cost: {
          reported_usd: reportedCosts,
          status: reportedCosts.every((cost) => cost !== null) ? "reported" : "partially_reported",
          source: "claude_agent_sdk_result",
          estimated: false,
        },
        cleanup: { outcomes: ["wilted", "wilted"], worktrees_removed: true },
        ledger: { first_seq: 1, last_seq: readySeq },
        restart_replay_contiguous: true,
      };
      expect(proof.sessions.some((session) => typeof session === "string" && session.length > 0)).toBe(true);
      expect(proof.terminal_statuses).toContain("provider_blocked");
      await writeFile(join(providerHarness.artifactDir, "provider-runtime-blocked.json"), `${JSON.stringify(proof, null, 2)}\n`);
      return;
    }

    for (const [detail, runId, expectedPath] of [
      [readyA, runAId, scenario.paths.providerA],
      [readyB, runBId, scenario.paths.providerB],
    ] as const) {
      const run = detail.runs.find((candidate) => candidate.id === runId);
      expect(run).toBeTruthy();
      expect(run!.status).toBe("succeeded");
      expect(run!.provider_status).toBe("verified");
      expect(run!.result_subtype).toBe("success");
      expect(typeof run!.cost_usd).toBe("number");
      const reportedCost = run!.cost_usd as number;
      expect(Number.isFinite(reportedCost)).toBe(true);
      expect(reportedCost).toBeGreaterThanOrEqual(0);
      expect(reportedTokenCount(run!.usage)).toBeGreaterThan(0);
      expect(Number(run!.num_turns)).toBeGreaterThan(0);
      expect(String(run!.session_id)).not.toBe("");
      expect(asObject(run!.provenance, "provider run provenance").source).toBe("http_api");
      expect(asObject(run!.terminal_provenance, "provider terminal provenance").source).toBe("claude_agent_sdk");
      expect(detail.timeline.some((event) => event.type === "agent.run.started")).toBe(true);
      expect(detail.timeline.some((event) => event.type === "agent.run.succeeded")).toBe(true);
      expect(detail.timeline.some((event) => event.type === "task.review_pending")).toBe(true);
      const overlap = detail.overlaps.find((evidence) => evidence.evidence_type === "claim" || evidence.evidence_type === "magnet");
      expect(overlap).toBeTruthy();
      expect(overlap!.blocking).toBe(false);
      const diff = asObject((await farm.http.get(`/api/tasks/${detail.task.id}/diff`, 200)).body, "provider diff");
      expect(diff.changed_paths as string[]).toEqual([expectedPath]);
      expect(String(diff.digest)).toMatch(/^[a-f0-9]{64}$/);
      expect(String(diff.patch)).toContain(expectedPath);
    }

    const diffA = asObject((await farm.http.get(`/api/tasks/${taskA.task.id}/diff`, 200)).body, "provider diff A");
    await farm.http.post(`/api/tasks/${taskA.task.id}/reviews`, {
      decision: "approved",
      diff_digest: diffA.digest,
      summary: "Real provider E2E approval for exact digest.",
    }, 201);
    const approved = await farm.task(taskA.task.id);
    expect(approved.task.review_status).toBe("approved");
    expect(approved.eligibility.can_harvest).toBe(true);
    const harvested = asObject((await farm.http.post(`/api/tasks/${taskA.task.id}/harvest`, { diff_digest: diffA.digest }, 200)).body, "provider harvest");
    expect(String(harvested.commit)).toMatch(/^[a-f0-9]{40,64}$/);
    expect(git(fixture.repository, "rev-parse", "HEAD")).toBe(harvested.commit);
    expect((await readFile(join(fixture.repository, scenario.paths.providerA), "utf8")).trim()).toBe("provider task A completed by real SDK");

    const diffB = asObject((await farm.http.get(`/api/tasks/${taskB.task.id}/diff`, 200)).body, "provider diff B");
    await farm.http.post(`/api/tasks/${taskB.task.id}/reviews`, {
      decision: "rejected",
      diff_digest: diffB.digest,
      summary: "Real provider E2E rejection before wilt.",
    }, 201);
    expect((await farm.task(taskB.task.id)).task.status).toBe("review_rejected");
    const wilted = asObject((await farm.http.delete(`/api/tasks/${taskB.task.id}`, { reason: "Provider E2E reject then wilt." }, 200)).body, "provider wilt");
    expect(asObject(wilted.task, "provider wilt task").status).toBe("wilted");

    const beforeRestart = await farm.events(0);
    await collector.waitForSequence(beforeRestart.lastSeq);
    collector.assertContiguousThrough(beforeRestart.lastSeq);
    const resumeAfter = collector.lastSeq;
    await collector.close();
    collector = null;
    const restarted = await providerHarness.restartServer({ AGENT_FARM_RUN_PROVIDER_E2E: "1" });
    farm = new FarmApi(restarted.baseUrl);
    const replay = new LedgerCollector(restarted.wsUrl, resumeAfter);
    collector = replay;
    await replay.connect();
    const readySeq = await replay.waitUntilReady();
    if (readySeq > resumeAfter) await replay.waitForSequence(readySeq);
    replay.assertContiguousThrough(readySeq);
    expect((await farm.task(taskA.task.id)).task.status).toBe("harvested");
    expect((await farm.task(taskB.task.id)).task.status).toBe("wilted");

    const finalA = await farm.task(taskA.task.id);
    const finalB = await farm.task(taskB.task.id);
    const finalRuns = [
      finalA.runs.find((run) => run.id === runAId),
      finalB.runs.find((run) => run.id === runBId),
    ];
    const taskCosts = [finalA.task.total_cost_usd, finalB.task.total_cost_usd];
    expect(taskCosts.every((cost) => typeof cost === "number" && Number.isFinite(cost) && cost >= 0)).toBe(true);
    const reportedCostUsd = taskCosts.reduce<number>((sum, cost) => sum + (cost as number), 0);
    const reportedTokens = finalRuns.reduce((sum, run) => sum + reportedTokenCount(run?.usage), 0);
    const proof = {
      schema_version: "agent-farm.e2e-provider-proof.v1",
      generated_at: new Date().toISOString(),
      provider_status: "verified",
      tasks: [taskA.task.id, taskB.task.id],
      runs: [runAId, runBId],
      sessions: finalRuns.map((run) => run?.session_id),
      result_subtypes: finalRuns.map((run) => run?.result_subtype),
      cost: {
        reported_usd: reportedCostUsd,
        status: reportedCostUsd === 0 ? "reported_zero" : "reported_positive",
        source: "claude_agent_sdk_result",
        estimated: false,
      },
      usage: { reported_tokens: reportedTokens, source: "claude_agent_sdk_result" },
      turns: [finalA, finalB].reduce((sum, detail) => sum + Number(detail.task.num_turns ?? 0), 0),
      actual_git_sha: git(fixture.repository, "rev-parse", "HEAD"),
      outcomes: { harvested: taskA.task.id, wilted: taskB.task.id },
      ledger: { first_seq: 1, last_seq: readySeq },
      restart_replay_contiguous: true,
    };
    expect(Number.isFinite(proof.cost.reported_usd)).toBe(true);
    expect(proof.cost.reported_usd).toBeGreaterThanOrEqual(0);
    expect(proof.usage.reported_tokens).toBeGreaterThan(0);
    expect(proof.turns).toBeGreaterThan(0);
    expect(proof.sessions.every((session) => typeof session === "string" && session.length > 0)).toBe(true);
    expect(proof.result_subtypes.every((subtype) => subtype === "success")).toBe(true);
    await writeFile(join(providerHarness.artifactDir, "provider-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
  } finally {
    if (collector) await collector.close().catch(() => undefined);
  }
});
