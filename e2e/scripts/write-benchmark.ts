import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { writeE2ERunArtifact, type E2ERunArtifact, validateResidualBenchmark } from "../lib/benchmark.js";
import { pathExists, type CleanupProof } from "../lib/harness.js";
import { providerPreflight } from "../lib/provider-preflight.js";
import { resolveEvidenceRoot } from "../lib/results.js";

interface EvidenceFile {
  path: string;
  value: Record<string, unknown>;
}

async function evidenceFiles(root: string): Promise<EvidenceFile[]> {
  const results: EvidenceFile[] = [];
  if (!(await pathExists(root))) return results;
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "benchmark.json") {
        try {
          const value = JSON.parse(await readFile(path, "utf8")) as unknown;
          if (value && typeof value === "object" && !Array.isArray(value)) {
            results.push({ path, value: value as Record<string, unknown> });
          }
        } catch {
          // Playwright and third-party JSON files are ignored unless they parse as objects.
        }
      }
    }
  }
  await visit(root);
  return results.sort((left, right) => left.path.localeCompare(right.path));
}

function cleanupProof(value: Record<string, unknown>): CleanupProof | null {
  const keys = ["processStopped", "dataDirectoryRemoved", "repositoryRemoved", "remoteRemoved", "worktreesPruned", "branchesRemoved"] as const;
  if (!keys.every((key) => typeof value[key] === "boolean") || typeof value.checkedAt !== "string") return null;
  return value as unknown as CleanupProof;
}

function mergeCounts(target: Record<string, number>, source: unknown, prefix = ""): void {
  if (!source || typeof source !== "object" || Array.isArray(source)) return;
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) target[`${prefix}${key}`] = (target[`${prefix}${key}`] ?? 0) + value;
  }
}

export function selectProviderProof(
  runtimeProof: Record<string, unknown> | null,
  preflight: {
    schema_version: string;
    status: string;
    reason: string | null;
    settings_file: unknown;
    credential_sources: unknown;
    secrets_printed: boolean;
  },
): Record<string, unknown> {
  return runtimeProof ?? {
    schema_version: preflight.schema_version,
    status: preflight.status,
    reason: preflight.reason,
    settings_file: preflight.settings_file,
    credential_sources: preflight.credential_sources,
    secrets_printed: preflight.secrets_printed,
    runtime_attempted: false,
  };
}

async function main(): Promise<void> {
  const evidenceRoot = await resolveEvidenceRoot();
  const files = await evidenceFiles(evidenceRoot);
  const cleanups = files.map((file) => cleanupProof(file.value)).filter((value): value is CleanupProof => value !== null);
  const cleanupFailures = cleanups.flatMap((proof, index) =>
    Object.entries(proof)
      .filter(([key]) => key !== "checkedAt")
      .filter(([, value]) => value !== true)
      .map(([key]) => `cleanup[${index}].${key}`),
  );
  if (cleanupFailures.length > 0) throw new Error(`Cannot publish E2E benchmark with cleanup failures: ${cleanupFailures.join(", ")}`);

  const cases: Array<Record<string, unknown>> = [];
  const gitProof: E2ERunArtifact["git_proof"] = [];
  const residualCounts: Record<string, number> = {};
  let firstSeq: number | null = null;
  let lastSeq: number | null = null;
  let runtimeProviderProof: Record<string, unknown> | null = null;

  for (const file of files) {
    const schema = file.value.schema_version;
    if (schema === "agent-farm.residual-benchmark.v1") {
      const residual = validateResidualBenchmark(file.value);
      firstSeq = firstSeq === null ? residual.ledger.first_seq : Math.min(firstSeq, residual.ledger.first_seq);
      lastSeq = lastSeq === null ? residual.ledger.last_seq : Math.max(lastSeq, residual.ledger.last_seq);
      mergeCounts(residualCounts, residual.summary.by_type, "type:");
      mergeCounts(residualCounts, residual.summary.by_severity, "severity:");
      cases.push({
        id: residual.artifact_id,
        kind: "residual-benchmark",
        status: "observed",
        evidence: relative(evidenceRoot, file.path),
        ledger: residual.ledger,
      });
    } else if (schema === "agent-farm.e2e-benchmark-proof.v1") {
      const ledger = file.value.ledger as Record<string, unknown> | undefined;
      if (ledger && typeof ledger.first_seq === "number" && typeof ledger.last_seq === "number") {
        firstSeq = firstSeq === null ? ledger.first_seq : Math.min(firstSeq, ledger.first_seq);
        lastSeq = lastSeq === null ? ledger.last_seq : Math.max(lastSeq, ledger.last_seq);
      }
      const counts = file.value.residual_counts as Record<string, unknown> | undefined;
      if (counts) mergeCounts(residualCounts, counts.by_type, "type:");
      cases.push({
        id: String(file.value.artifact_id ?? basename(file.path)),
        kind: "benchmark-proof",
        status: file.value.restart_latest_equal === true ? "passed" : "failed",
        evidence: relative(evidenceRoot, file.path),
      });
    } else if (schema === "agent-farm.e2e-provider-proof.v1") {
      if (file.value.provider_status !== "verified" && file.value.provider_status !== "blocked") {
        throw new Error(`Runtime provider proof has invalid provider_status in ${relative(evidenceRoot, file.path)}`);
      }
      runtimeProviderProof = { ...file.value, evidence: relative(evidenceRoot, file.path) };
      cases.push({
        id: basename(file.path),
        kind: "provider-runtime",
        status: file.value.provider_status,
        evidence: relative(evidenceRoot, file.path),
      });
    } else if (schema === "agent-farm.e2e-git-proof.v1") {
      if (typeof file.value.repository === "string" && typeof file.value.sha === "string") {
        gitProof.push({
          repository: file.value.repository,
          sha: file.value.sha,
          digests: file.value.digests && typeof file.value.digests === "object" && !Array.isArray(file.value.digests)
            ? file.value.digests as Record<string, string>
            : {},
        });
      }
    } else if (typeof schema === "string" && schema.startsWith("agent-farm.e2e-") && schema !== "agent-farm.e2e-run.v1") {
      cases.push({
        id: basename(file.path),
        kind: schema,
        status: "observed",
        evidence: relative(evidenceRoot, file.path),
      });
    }
  }

  const provider = await providerPreflight();
  const selectedProviderProof = selectProviderProof(runtimeProviderProof, provider);
  const artifact: E2ERunArtifact = {
    schema_version: "agent-farm.e2e-run.v1",
    generated_at: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      provider_enabled: provider.enabled,
    },
    cases,
    ledger_seq_range: { first: firstSeq, last: lastSeq },
    git_proof: gitProof,
    residual_counts: residualCounts,
    cleanup_proof: cleanups,
    provider_proof: selectedProviderProof,
  };
  const destination = await writeE2ERunArtifact(artifact, "benchmark.json", evidenceRoot);
  const info = await stat(destination);
  process.stdout.write(`${JSON.stringify({
    schema_version: artifact.schema_version,
    artifact: destination,
    bytes: info.size,
    cases: cases.length,
    cleanup_proofs: cleanups.length,
    residual_count_keys: Object.keys(residualCounts).length,
    provider_status: selectedProviderProof.provider_status ?? selectedProviderProof.status,
  })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
