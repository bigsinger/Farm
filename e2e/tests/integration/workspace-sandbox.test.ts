import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("workspace sandbox self-check proves isolation and cleanup barrier", { timeout: 60_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-farm-workspace-sandbox-"));
  const dataDir = join(root, "data");
  const worktree = join(root, "worktree");
  const previousDataDir = process.env.AGENT_FARM_DATA_DIR;
  const previousHost = process.env.HOST;
  process.env.AGENT_FARM_DATA_DIR = dataDir;
  process.env.HOST = "127.0.0.1";
  process.env.AGENT_FARM_DISABLE_USER_SETTINGS = "1";
  try {
    await mkdir(worktree, { recursive: true });
    await writeFile(join(worktree, "README.md"), "sandbox fixture\n");
    const {
      cleanupWorkspaceSandbox,
      createWorkspaceSandbox,
      markWorkspaceSandboxReleased,
      runWorkspaceCommand,
      verifyWorkspaceSandbox,
    } = await import("../../../server/src/agent-sandbox.js");

    const sandbox = await createWorkspaceSandbox(worktree, `run-${Date.now()}`);
    await verifyWorkspaceSandbox(sandbox);

    const quote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;
    const insidePath = join(sandbox.cwd, "inside.txt");
    const inside = await runWorkspaceCommand(
      sandbox,
      `printf ok > ${quote(insidePath)} && /bin/cat ${quote(insidePath)}`,
      { timeoutMs: 10_000 },
    );
    assert.equal(inside.status, "succeeded");
    assert.match(inside.stdout, /ok/);
    assert.equal(await readFile(insidePath, "utf8"), "ok");

    await markWorkspaceSandboxReleased(sandbox);
    const proof = await cleanupWorkspaceSandbox(sandbox);
    assert.equal(proof?.closed, true);
    assert.equal(proof?.directoryRemoved, true);
    assert.equal(proof?.retainedForRecovery, false);
  } finally {
    if (previousDataDir === undefined) delete process.env.AGENT_FARM_DATA_DIR;
    else process.env.AGENT_FARM_DATA_DIR = previousDataDir;
    if (previousHost === undefined) delete process.env.HOST;
    else process.env.HOST = previousHost;
    await rm(root, { recursive: true, force: true });
  }
});
