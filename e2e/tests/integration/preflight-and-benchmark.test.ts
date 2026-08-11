import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { validateResidualBenchmark, RESIDUAL_SCHEMA_VERSION, writeE2ERunArtifact } from "../../lib/benchmark.js";
import { createHarness, pathExists, REPOSITORY_ROOT, SERVER_ROOT } from "../../lib/harness.js";
import { providerPreflight } from "../../lib/provider-preflight.js";
import { selectProviderProof } from "../../scripts/write-benchmark.js";

function dynamicResidualArtifact(count: number) {
  const firstSeq = Math.floor(Date.now() / 10);
  const types = ["orphan_worktree", "dangling_task", "cost_event_mismatch"];
  const severities = ["warning", "critical"];
  const residuals = Array.from({ length: count }, (_, index) => ({
    type: types[index % types.length]!,
    severity: severities[index % severities.length]!,
    task_ref: `task-${randomUUID()}`,
    run_ref: index % 2 === 0 ? `run-${randomUUID()}` : null,
    repository_ref: `repo-${randomUUID()}`,
    detected_at: new Date(Date.now() + index).toISOString(),
    source_event_seq: firstSeq + index,
    provenance: { table: "ledger_events", seq: firstSeq + index, fixture: "validator-self-test" },
    evidence: { observed: randomUUID(), expected: randomUUID() },
    remediation: { action: "reconcile", correlation_id: randomUUID() },
  }));
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const residual of residuals) {
    byType[residual.type] = (byType[residual.type] ?? 0) + 1;
    bySeverity[residual.severity] = (bySeverity[residual.severity] ?? 0) + 1;
  }
  return {
    schema_version: RESIDUAL_SCHEMA_VERSION,
    artifact_id: randomUUID(),
    generated_at: new Date().toISOString(),
    sha256: createHash("sha256").update(randomUUID()).digest("hex"),
    ledger: {
      first_seq: firstSeq,
      last_seq: firstSeq + Math.max(0, count - 1),
      event_count: count,
    },
    scope: { kind: "all", fixture: "schema-validator-only" },
    summary: { total: count, by_type: byType, by_severity: bySeverity },
    residuals,
  };
}

test("provider preflight reads real settings metadata without exposing secret values", async () => {
  const previous = process.env.AGENT_FARM_RUN_PROVIDER_E2E;
  delete process.env.AGENT_FARM_RUN_PROVIDER_E2E;
  try {
    const result = await providerPreflight();
    assert.equal(result.schema_version, "agent-farm.provider-preflight.v1");
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "AGENT_FARM_RUN_PROVIDER_E2E is not set to 1");
    assert.equal(result.secrets_printed, false);
    assert.equal(typeof result.settings_file.exists, "boolean");
    assert.equal(typeof result.credential_sources.settings_env_key_present, "boolean");
    const serialized = JSON.stringify(result);
    for (const key of ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"]) {
      const secret = process.env[key];
      if (secret) assert.equal(serialized.includes(secret), false, `${key} value leaked from preflight`);
    }
  } finally {
    if (previous === undefined) delete process.env.AGENT_FARM_RUN_PROVIDER_E2E;
    else process.env.AGENT_FARM_RUN_PROVIDER_E2E = previous;
  }
});

test("runtime provider proof overrides preflight readiness without changing blocked semantics", () => {
  const preflight = {
    schema_version: "agent-farm.provider-preflight.v1",
    status: "ready",
    reason: null,
    settings_file: { exists: true },
    credential_sources: { endpoint_configured: true },
    secrets_printed: false,
  };
  const blocked = {
    schema_version: "agent-farm.e2e-provider-proof.v1",
    provider_status: "blocked",
    reason: "provider_auth_failed",
    runtime_attempted: true,
  };
  assert.equal(selectProviderProof(blocked, preflight), blocked);
  const fallback = selectProviderProof(null, preflight);
  assert.equal(fallback.status, "ready");
  assert.equal(fallback.runtime_attempted, false);
});

test("residual benchmark validator derives counts and rejects count or provenance corruption", () => {
  const dynamicCount = 4 + (Date.now() % 4);
  const artifact = dynamicResidualArtifact(dynamicCount);
  const validated = validateResidualBenchmark(artifact);
  assert.equal(validated.summary.total, dynamicCount);
  assert.equal(Object.values(validated.summary.by_type).reduce((sum, count) => sum + count, 0), dynamicCount);
  assert.equal(Object.values(validated.summary.by_severity).reduce((sum, count) => sum + count, 0), dynamicCount);

  const wrongCount = structuredClone(artifact);
  wrongCount.summary.total += 1;
  assert.throws(() => validateResidualBenchmark(wrongCount), /summary\.total/);

  const missingProvenance = structuredClone(artifact);
  delete (missingProvenance.residuals[0] as Partial<(typeof artifact.residuals)[number]>).provenance;
  assert.throws(() => validateResidualBenchmark(missingProvenance), /provenance is required/);

  const outOfRange = structuredClone(artifact);
  outOfRange.residuals[0]!.source_event_seq = outOfRange.ledger.last_seq + 1;
  assert.throws(() => validateResidualBenchmark(outOfRange), /outside the ledger range/);
});

test("published Draft 2020 schemas compile and require run ids for verified or blocked provider proof", async () => {
  const requireFromServer = createRequire(join(SERVER_ROOT, "package.json"));
  const Ajv2020 = (requireFromServer("ajv/dist/2020") as { default: new (options: object) => {
    compile(schema: object): ((value: unknown) => boolean) & { errors?: unknown };
  } }).default;
  const addFormats = (requireFromServer("ajv-formats") as { default: (ajv: object) => void }).default;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const schemasRoot = join(REPOSITORY_ROOT, "docs", "agent-farm", "schemas");
  const ledgerSchema = JSON.parse(await readFile(join(schemasRoot, "ledger-event.v1.schema.json"), "utf8")) as object;
  const residualSchema = JSON.parse(await readFile(join(schemasRoot, "residual-benchmark.v1.schema.json"), "utf8")) as object;
  assert.equal(typeof ajv.compile(ledgerSchema), "function");
  const validate = ajv.compile(residualSchema);
  const base = {
    schema_version: "agent-farm.residual-benchmark.v1",
    artifact_id: "schema-boundary",
    generated_at: "2026-08-10T00:00:00.000Z",
    sha256: "0".repeat(64),
    ledger: { first_seq: 0, last_seq: 0, event_count: 0 },
    scope: { repository_ids: [], task_ids: [] },
    summary: { total: 0, by_type: {}, by_severity: {} },
    residuals: [],
    cleanup_proof: { checked_paths: [], remaining_paths: [] },
  };
  for (const provider_proof of [
    { status: "verified", run_ids: ["run-verified"], cost_usd: 0 },
    { status: "blocked", reason: "provider_auth_failed", run_ids: ["run-blocked"] },
    { status: "not_run", reason: "No Agent SDK run has been recorded.", run_ids: [] },
  ]) assert.equal(validate({ ...base, provider_proof }), true, JSON.stringify(validate.errors));
  for (const provider_proof of [
    { status: "verified", run_ids: [] },
    { status: "blocked", reason: "provider_auth_failed", run_ids: [] },
  ]) assert.equal(validate({ ...base, provider_proof }), false);
});

test("versioned E2E run artifact is written under gitignored test-results with runtime and cleanup proof", async () => {
  const harness = await createHarness("run-artifact-writer");
  let cleanup;
  try {
    await harness.createGitFixture();
  } finally {
    cleanup = await harness.cleanup();
  }
  const name = `self-test-${randomUUID()}.json`;
  const destination = await writeE2ERunArtifact(
    {
      schema_version: "agent-farm.e2e-run.v1",
      generated_at: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        provider_enabled: false,
      },
      cases: [{ id: randomUUID(), kind: "artifact-writer-self-test", status: "passed" }],
      ledger_seq_range: { first: null, last: null },
      git_proof: [],
      residual_counts: {},
      cleanup_proof: [cleanup],
      provider_proof: { status: "blocked", reason: "self-test does not run provider" },
    },
    name,
  );
  try {
    assert.equal(await pathExists(destination), true);
    const parsed = JSON.parse(await readFile(destination, "utf8")) as Record<string, unknown>;
    assert.equal(parsed.schema_version, "agent-farm.e2e-run.v1");
    assert.match(destination, /e2e\/test-results\//);
  } finally {
    const { rm } = await import("node:fs/promises");
    await rm(destination, { force: true });
  }
});
