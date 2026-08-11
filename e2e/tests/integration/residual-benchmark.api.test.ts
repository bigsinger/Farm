import assert from "node:assert/strict";
import { cp, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";
import { ApiClient, asObject } from "../../lib/api.js";
import { RESIDUAL_SCHEMA_VERSION, validateBenchmarkFile, validateResidualBenchmark } from "../../lib/benchmark.js";
import { createHarness, pathExists } from "../../lib/harness.js";
import { findSqliteDatabase, sqliteIntegrity, sqliteJson, sqliteTables } from "../../lib/sqlite.js";

async function jsonFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  if (!(await pathExists(root))) return result;
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".json")) result.push(path);
    }
  }
  await visit(root);
  return result;
}

function responseArtifact(value: unknown): unknown {
  const root = asObject(value, "benchmark response");
  if (root.schema_version === RESIDUAL_SCHEMA_VERSION) return root;
  for (const key of ["artifact", "benchmark", "result"] as const) {
    const candidate = root[key];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const object = candidate as Record<string, unknown>;
      if (object.schema_version === RESIDUAL_SCHEMA_VERSION) return object;
    }
  }
  throw new TypeError(`Benchmark response does not contain ${RESIDUAL_SCHEMA_VERSION}`);
}

async function responseArtifactPath(value: unknown, dataDir: string): Promise<string | null> {
  const root = asObject(value, "benchmark response");
  const paths = [root.artifact_path, root.path, root.file_path];
  const nested = root.artifact && typeof root.artifact === "object" && !Array.isArray(root.artifact)
    ? root.artifact as Record<string, unknown>
    : undefined;
  if (nested) paths.push(nested.artifact_path, nested.path, nested.file_path);
  for (const candidate of paths) {
    if (typeof candidate !== "string" || candidate.length === 0) continue;
    const absolute = resolve(dataDir, candidate);
    if (!(await pathExists(absolute))) throw new Error(`Benchmark response artifact path does not exist: ${absolute}`);
    const [canonicalData, canonicalArtifact] = await Promise.all([realpath(dataDir), realpath(absolute)]);
    const location = relative(canonicalData, canonicalArtifact);
    if (location.startsWith("..")) throw new Error(`Benchmark artifact escaped AGENT_FARM_DATA_DIR: ${canonicalArtifact}`);
    return canonicalArtifact;
  }
  return null;
}

async function discoverArtifact(dataDir: string, artifactId: string, generatedAfterMs: number): Promise<string> {
  const matches: string[] = [];
  for (const path of await jsonFiles(dataDir)) {
    const info = await stat(path);
    if (info.mtimeMs + 1_000 < generatedAfterMs) continue;
    try {
      const parsed = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
      if (parsed.schema_version === RESIDUAL_SCHEMA_VERSION && parsed.artifact_id === artifactId) matches.push(path);
    } catch {
      // Non-JSON or concurrently written files are not benchmark candidates.
    }
  }
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one generated benchmark artifact ${artifactId}, found ${matches.length}: ${matches.join(", ")}`);
  }
  return matches[0]!;
}

test("residual benchmark generation persists v1 artifact, exact SHA and survives restart", { timeout: 120_000 }, async () => {
  const harness = await createHarness("residual-benchmark-api");
  try {
    const server = await harness.startServer();
    const api = new ApiClient(server.baseUrl);
    const beforeGeneration = Date.now();
    const generatedResponse = await api.post<unknown>("/api/benchmarks/residual", {}, [200, 201]);
    const generated = validateResidualBenchmark(responseArtifact(generatedResponse.body));
    assert.equal(generated.schema_version, RESIDUAL_SCHEMA_VERSION);
    assert.ok(generated.ledger.last_seq >= generated.ledger.first_seq);
    assert.equal(generated.summary.total, generated.residuals.length);
    assert.equal(
      Object.values(generated.summary.by_type).reduce((sum, count) => sum + count, 0),
      generated.summary.total,
    );
    assert.equal(
      Object.values(generated.summary.by_severity).reduce((sum, count) => sum + count, 0),
      generated.summary.total,
    );
    for (const residual of generated.residuals) {
      assert.ok(residual.source_event_seq >= generated.ledger.first_seq);
      assert.ok(residual.source_event_seq <= generated.ledger.last_seq);
      assert.ok(residual.provenance !== undefined);
      assert.ok(residual.evidence !== undefined);
    }

    const declaredPath = await responseArtifactPath(generatedResponse.body, harness.dataDir);
    const artifactPath = declaredPath ?? await discoverArtifact(harness.dataDir, generated.artifact_id, beforeGeneration);
    await validateBenchmarkFile(artifactPath, generated);
    const resultCopy = join(harness.artifactDir, `residual-${generated.artifact_id}.json`);
    await cp(artifactPath, resultCopy, { force: true });
    assert.equal(await pathExists(resultCopy), true);

    const latestBeforeRestart = await api.get<unknown>("/api/benchmarks/residual/latest", 200);
    assert.deepEqual(responseArtifact(latestBeforeRestart.body), generated);

    const database = await findSqliteDatabase(harness.dataDir);
    assert.deepEqual(await sqliteIntegrity(database, harness.dataDir), ["ok"]);
    const tables = await sqliteTables(database, harness.dataDir);
    assert.ok(tables.some((table) => table.name === "audit_events"), "SQLite schema must persist the append-only audit_events ledger");
    const triggers = await sqliteJson<{ name: string }>(
      database,
      harness.dataDir,
      "SELECT name FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = 'audit_events' ORDER BY name;",
    );
    assert.deepEqual(triggers.map((trigger) => trigger.name), ["audit_events_no_delete", "audit_events_no_update"]);

    const restarted = await harness.restartServer();
    const replayApi = new ApiClient(restarted.baseUrl);
    const latestAfterRestart = await replayApi.get<unknown>("/api/benchmarks/residual/latest", 200);
    assert.deepEqual(responseArtifact(latestAfterRestart.body), generated);
    await writeFile(join(harness.artifactDir, "benchmark-proof.json"), `${JSON.stringify({
      schema_version: "agent-farm.e2e-benchmark-proof.v1",
      generated_artifact: relative(harness.dataDir, artifactPath),
      copied_artifact: relative(harness.artifactDir, resultCopy),
      artifact_id: generated.artifact_id,
      sha256: generated.sha256,
      ledger: generated.ledger,
      residual_counts: generated.summary,
      restart_latest_equal: true,
      sqlite_integrity: "ok",
    }, null, 2)}\n`);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.processStopped, true);
    assert.equal(proof.dataDirectoryRemoved, true);
    assert.equal(proof.worktreesPruned, true);
    assert.equal(proof.branchesRemoved, true);
  }
});
