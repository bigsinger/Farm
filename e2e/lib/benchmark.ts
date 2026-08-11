import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CleanupProof, JsonObject } from "./harness.js";
import { sha256File, TEST_RESULTS_ROOT } from "./harness.js";

export const RESIDUAL_SCHEMA_VERSION = "agent-farm.residual-benchmark.v1" as const;

export interface ResidualEntry extends JsonObject {
  type: string;
  severity: string;
  task_ref?: string | null;
  run_ref?: string | null;
  repository_ref?: string | null;
  detected_at: string | number;
  source_event_seq: number;
  provenance: unknown;
  evidence: unknown;
  remediation?: unknown;
  cleanup_proof?: unknown;
  provider_proof?: unknown;
}

export interface ResidualBenchmark extends JsonObject {
  schema_version: typeof RESIDUAL_SCHEMA_VERSION;
  artifact_id: string;
  generated_at: string | number;
  sha256: string;
  ledger: {
    first_seq: number;
    last_seq: number;
    event_count: number;
  };
  scope: unknown;
  summary: {
    total: number;
    by_type: Record<string, number>;
    by_severity: Record<string, number>;
  };
  residuals: ResidualEntry[];
}

export interface E2ERunArtifact extends JsonObject {
  schema_version: "agent-farm.e2e-run.v1";
  generated_at: string;
  environment: {
    node: string;
    platform: string;
    arch: string;
    provider_enabled: boolean;
  };
  cases: Array<Record<string, unknown>>;
  ledger_seq_range: { first: number | null; last: number | null };
  git_proof: Array<{ repository: string; sha: string; digests: Record<string, string> }>;
  residual_counts: Record<string, number>;
  cleanup_proof: CleanupProof[];
  provider_proof: Record<string, unknown>;
}

function object(value: unknown, path: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${path} must be an object`);
  return value as JsonObject;
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${path} must be a non-empty string`);
  return value;
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new TypeError(`${path} must be a non-negative integer`);
  return value as number;
}

function timestamp(value: unknown, path: string): string | number {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0 || Number.isNaN(new Date(value).getTime())) {
      throw new TypeError(`${path} must be a valid epoch-millisecond timestamp`);
    }
    return value;
  }
  const timestamp = nonEmptyString(value, path);
  if (Number.isNaN(Date.parse(timestamp))) throw new TypeError(`${path} must be an ISO timestamp or epoch milliseconds`);
  return timestamp;
}

function countBy(entries: ResidualEntry[], key: "type" | "severity"): Record<string, number> {
  const result: Record<string, number> = {};
  for (const entry of entries) result[entry[key]] = (result[entry[key]] ?? 0) + 1;
  return result;
}

function equalCounts(actual: unknown, expected: Record<string, number>, path: string): void {
  const counts = object(actual, path);
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(counts)) normalized[key] = nonNegativeInteger(value, `${path}.${key}`);
  const expectedWithDeclaredZeros = { ...expected };
  for (const [key, value] of Object.entries(normalized)) {
    if (!(key in expectedWithDeclaredZeros) && value === 0) expectedWithDeclaredZeros[key] = 0;
  }
  if (JSON.stringify(Object.fromEntries(Object.entries(normalized).sort())) !== JSON.stringify(Object.fromEntries(Object.entries(expectedWithDeclaredZeros).sort()))) {
    throw new Error(`${path} does not match residual entries: actual=${JSON.stringify(normalized)} expected=${JSON.stringify(expected)}`);
  }
}

export function validateResidualBenchmark(value: unknown): ResidualBenchmark {
  const root = object(value, "artifact");
  if (root.schema_version !== RESIDUAL_SCHEMA_VERSION) {
    throw new Error(`artifact.schema_version must be ${RESIDUAL_SCHEMA_VERSION}, got ${JSON.stringify(root.schema_version)}`);
  }
  nonEmptyString(root.artifact_id, "artifact.artifact_id");
  timestamp(root.generated_at, "artifact.generated_at");
  const digest = nonEmptyString(root.sha256, "artifact.sha256");
  if (!/^[a-f0-9]{64}$/i.test(digest)) throw new TypeError("artifact.sha256 must be a 64-character hexadecimal digest");
  const ledger = object(root.ledger, "artifact.ledger");
  const firstSeq = nonNegativeInteger(ledger.first_seq, "artifact.ledger.first_seq");
  const lastSeq = nonNegativeInteger(ledger.last_seq, "artifact.ledger.last_seq");
  const eventCount = nonNegativeInteger(ledger.event_count, "artifact.ledger.event_count");
  if (lastSeq < firstSeq && eventCount > 0) throw new Error("artifact.ledger sequence range is reversed");
  if (!("scope" in root)) throw new TypeError("artifact.scope is required");
  const residualValues = root.residuals;
  if (!Array.isArray(residualValues)) throw new TypeError("artifact.residuals must be an array");
  const residuals = residualValues.map((entryValue, index) => {
    const entry = object(entryValue, `artifact.residuals[${index}]`) as ResidualEntry;
    nonEmptyString(entry.type, `artifact.residuals[${index}].type`);
    nonEmptyString(entry.severity, `artifact.residuals[${index}].severity`);
    timestamp(entry.detected_at, `artifact.residuals[${index}].detected_at`);
    nonNegativeInteger(entry.source_event_seq, `artifact.residuals[${index}].source_event_seq`);
    for (const field of ["provenance", "evidence"] as const) {
      if (!(field in entry)) throw new TypeError(`artifact.residuals[${index}].${field} is required`);
    }
    if (!("remediation" in entry) && !("cleanup_proof" in entry) && !("provider_proof" in entry)) {
      throw new TypeError(`artifact.residuals[${index}] requires remediation, cleanup_proof, or provider_proof`);
    }
    return entry;
  });
  const summary = object(root.summary, "artifact.summary");
  const total = nonNegativeInteger(summary.total, "artifact.summary.total");
  if (total !== residuals.length) throw new Error(`artifact.summary.total=${total} but residuals.length=${residuals.length}`);
  equalCounts(summary.by_type, countBy(residuals, "type"), "artifact.summary.by_type");
  equalCounts(summary.by_severity, countBy(residuals, "severity"), "artifact.summary.by_severity");
  for (const [index, residual] of residuals.entries()) {
    if (residual.source_event_seq < firstSeq || residual.source_event_seq > lastSeq) {
      throw new Error(`artifact.residuals[${index}].source_event_seq is outside the ledger range`);
    }
  }
  return root as unknown as ResidualBenchmark;
}

export async function validateBenchmarkFile(path: string, response: unknown): Promise<ResidualBenchmark> {
  const bytes = await readFile(path);
  const parsed = validateResidualBenchmark(JSON.parse(bytes.toString("utf8")) as unknown);
  const responseArtifact = validateResidualBenchmark(response);
  if (JSON.stringify(parsed) !== JSON.stringify(responseArtifact)) {
    throw new Error("Residual benchmark response does not exactly match the generated artifact file");
  }
  const actualFileDigest = await sha256File(path);
  const declaredDigest = parsed.sha256.toLowerCase();
  if (actualFileDigest !== declaredDigest) {
    // Some producers define sha256 over canonical JSON with the digest field blanked to avoid self-reference.
    const canonical = { ...parsed, sha256: "" };
    const canonicalDigest = createHash("sha256").update(`${JSON.stringify(canonical)}\n`).digest("hex");
    if (canonicalDigest !== declaredDigest) {
      throw new Error(`Residual benchmark SHA mismatch: file=${actualFileDigest} canonical=${canonicalDigest} declared=${declaredDigest}`);
    }
  }
  return parsed;
}

export async function writeE2ERunArtifact(
  artifact: E2ERunArtifact,
  name = "benchmark.json",
  destinationRoot = TEST_RESULTS_ROOT,
): Promise<string> {
  if (artifact.schema_version !== "agent-farm.e2e-run.v1") throw new Error("Invalid E2E run artifact schema version");
  const destination = join(destinationRoot, name);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(artifact, null, 2)}\n`);
  return destination;
}
