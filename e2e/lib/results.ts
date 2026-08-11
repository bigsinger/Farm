import { readFile, realpath } from "node:fs/promises";
import { join, relative } from "node:path";
import { TEST_RESULTS_BASE, TEST_RESULTS_ROOT, pathExists } from "./harness.js";

export interface LatestRunPointer {
  schema_version: "agent-farm.e2e-latest.v1";
  run_id: string;
  suite: string;
  status: "running" | "passed" | "failed";
  run_root: string;
  updated_at: string;
}

export async function resolveEvidenceRoot(): Promise<string> {
  if (process.env.AGENT_FARM_E2E_RUN_ID) return TEST_RESULTS_ROOT;
  const pointerPath = join(TEST_RESULTS_BASE, "latest.json");
  if (!(await pathExists(pointerPath))) {
    throw new Error(`No E2E latest run pointer exists at ${pointerPath}; run a test suite before generating a report`);
  }
  const pointer = JSON.parse(await readFile(pointerPath, "utf8")) as Partial<LatestRunPointer>;
  if (pointer.schema_version !== "agent-farm.e2e-latest.v1" || typeof pointer.run_root !== "string") {
    throw new Error(`Invalid E2E latest run pointer at ${pointerPath}`);
  }
  if (!(await pathExists(pointer.run_root))) throw new Error(`Latest E2E run root does not exist: ${pointer.run_root}`);
  const [canonicalBase, canonicalRoot] = await Promise.all([realpath(TEST_RESULTS_BASE), realpath(pointer.run_root)]);
  const location = relative(canonicalBase, canonicalRoot);
  if (location.startsWith("..")) throw new Error(`Latest E2E run root escaped test-results: ${canonicalRoot}`);
  return canonicalRoot;
}

export async function readLatestRunPointer(): Promise<LatestRunPointer> {
  const pointerPath = join(TEST_RESULTS_BASE, "latest.json");
  const pointer = JSON.parse(await readFile(pointerPath, "utf8")) as LatestRunPointer;
  if (pointer.schema_version !== "agent-farm.e2e-latest.v1") throw new Error(`Invalid latest run schema at ${pointerPath}`);
  return pointer;
}
