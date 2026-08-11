import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { pathExists } from "../lib/harness.js";
import { resolveEvidenceRoot } from "../lib/results.js";

interface ReportEntry {
  path: string;
  schema_version?: string;
  bytes: number;
  kind: "benchmark" | "cleanup" | "preflight" | "build" | "other-json";
  valid: boolean;
  error?: string;
}

async function jsonFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".json")) result.push(path);
    }
  }
  if (await pathExists(root)) await visit(root);
  return result.sort();
}

async function main(): Promise<void> {
  const evidenceRoot = await resolveEvidenceRoot();
  const entries: ReportEntry[] = [];
  for (const path of await jsonFiles(evidenceRoot)) {
    const info = await stat(path);
    const name = relative(evidenceRoot, path);
    try {
      const parsed = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
      const schema = typeof parsed.schema_version === "string" ? parsed.schema_version : undefined;
      const kind = schema === "agent-farm.residual-benchmark.v1" || schema === "agent-farm.e2e-run.v1"
        ? "benchmark"
        : name.endsWith("cleanup-proof.json")
          ? "cleanup"
          : schema?.includes("preflight")
            ? "preflight"
            : schema === "agent-farm.web-build.v1"
              ? "build"
              : "other-json";
      let valid = true;
      let error: string | undefined;
      if (kind === "cleanup") {
        const failures = Object.entries(parsed)
          .filter(([key]) => key !== "checkedAt")
          .filter(([, value]) => value !== true)
          .map(([key]) => key);
        if (failures.length > 0) {
          valid = false;
          error = `cleanup failures: ${failures.join(", ")}`;
        }
      }
      entries.push({ path: name, schema_version: schema, bytes: info.size, kind, valid, ...(error ? { error } : {}) });
    } catch (error) {
      entries.push({
        path: name,
        bytes: info.size,
        kind: "other-json",
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const report = {
    schema_version: "agent-farm.e2e-report.v1",
    generated_at: new Date().toISOString(),
    test_results_root: evidenceRoot,
    summary: {
      total: entries.length,
      valid: entries.filter((entry) => entry.valid).length,
      invalid: entries.filter((entry) => !entry.valid).length,
      by_kind: Object.fromEntries(
        ["benchmark", "cleanup", "preflight", "build", "other-json"].map((kind) => [kind, entries.filter((entry) => entry.kind === kind).length]),
      ),
    },
    entries,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.summary.invalid > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
