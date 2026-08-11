import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

export interface RegisteredServerProcess {
  schema_version: "agent-farm.e2e-server-process.v1";
  state: "started" | "stopped";
  run_id: string;
  pid: number;
  process_group_id: number;
  port: number;
  data_directory: string;
  cleanup_token: string;
  registered_at: string;
}

export interface ProcessCleanupProof {
  registry_entries: number;
  registered_process_groups: number[];
  initially_alive_process_groups: number[];
  terminated_process_groups: number[];
  killed_process_groups: number[];
  remaining_process_groups: number[];
  identity_mismatch_process_groups: number[];
  registry_parse_errors: string[];
}

export function registerServerProcess(registryPath: string, entry: RegisteredServerProcess): void {
  appendFileSync(registryPath, `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 });
}

function groupAlive(processGroupId: number): boolean {
  try {
    process.kill(process.platform === "win32" ? processGroupId : -processGroupId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function groupHasCleanupToken(entry: RegisteredServerProcess): boolean {
  if (process.platform === "win32") return true;
  const result = spawnSync("ps", ["eww", "-p", String(entry.pid), "-o", "pid=,pgid=,command="], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return false;
  const match = /^\s*(\d+)\s+(\d+)\s+([\s\S]*)$/.exec(result.stdout.trim());
  return (
    match !== null &&
    Number(match[1]) === entry.pid &&
    Number(match[2]) === entry.process_group_id &&
    match[3]!.includes(`AGENT_FARM_E2E_CLEANUP_TOKEN=${entry.cleanup_token}`)
  );
}

function signalGroup(processGroupId: number, signal: NodeJS.Signals): void {
  try {
    process.kill(process.platform === "win32" ? processGroupId : -processGroupId, signal);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ESRCH") throw error;
  }
}

async function waitForGroupsToExit(processGroupIds: readonly number[], timeoutMs: number): Promise<number[]> {
  const deadline = Date.now() + timeoutMs;
  let alive = processGroupIds.filter(groupAlive);
  while (alive.length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    alive = alive.filter(groupAlive);
  }
  return alive;
}

export async function cleanupRegisteredServerProcesses(
  registryPath: string,
  timeoutMs = 10_000,
): Promise<ProcessCleanupProof> {
  let contents = "";
  try {
    contents = await readFile(registryPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const entries: RegisteredServerProcess[] = [];
  const registryParseErrors: string[] = [];
  for (const [index, line] of contents.split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as Partial<RegisteredServerProcess>;
      if (
        parsed.schema_version !== "agent-farm.e2e-server-process.v1" ||
        (parsed.state !== "started" && parsed.state !== "stopped") ||
        !Number.isSafeInteger(parsed.process_group_id) ||
        (parsed.process_group_id ?? 0) <= 0 ||
        !Number.isSafeInteger(parsed.pid) ||
        (parsed.pid ?? 0) <= 0 ||
        typeof parsed.cleanup_token !== "string" ||
        !/^[a-f0-9]{32}$/.test(parsed.cleanup_token)
      ) {
        throw new Error("invalid process registry entry");
      }
      entries.push(parsed as RegisteredServerProcess);
    } catch (error) {
      registryParseErrors.push(`line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const registered = [...new Set(entries.map((entry) => entry.process_group_id))].sort((left, right) => left - right);
  const lastEntryByGroup = new Map<number, RegisteredServerProcess>();
  for (const entry of entries) {
    const previous = lastEntryByGroup.get(entry.process_group_id);
    if (previous && previous.cleanup_token !== entry.cleanup_token) {
      registryParseErrors.push(`process group ${entry.process_group_id} changed cleanup token inside the registry`);
      continue;
    }
    lastEntryByGroup.set(entry.process_group_id, entry);
  }
  const activeEntries = [...lastEntryByGroup.values()].filter((entry) => entry.state === "started");
  const aliveEntries = activeEntries.filter((entry) => groupAlive(entry.process_group_id));
  const identityMismatchProcessGroups: number[] = [];
  const authenticatedEntries = aliveEntries.filter((entry) => {
    if (groupHasCleanupToken(entry)) return true;
    identityMismatchProcessGroups.push(entry.process_group_id);
    registryParseErrors.push(`process group ${entry.process_group_id} is alive but does not carry its registered cleanup token`);
    return false;
  });
  const initiallyAlive = authenticatedEntries.map((entry) => entry.process_group_id);
  for (const processGroupId of initiallyAlive) signalGroup(processGroupId, "SIGTERM");
  let remaining = await waitForGroupsToExit(initiallyAlive, timeoutMs);
  const killed = [...remaining];
  for (const processGroupId of remaining) signalGroup(processGroupId, "SIGKILL");
  remaining = await waitForGroupsToExit(remaining, 5_000);

  return {
    registry_entries: entries.length,
    registered_process_groups: registered,
    initially_alive_process_groups: initiallyAlive,
    terminated_process_groups: initiallyAlive.filter((id) => !killed.includes(id)),
    killed_process_groups: killed.filter((id) => !remaining.includes(id)),
    remaining_process_groups: remaining,
    identity_mismatch_process_groups: identityMismatchProcessGroups,
    registry_parse_errors: registryParseErrors,
  };
}
