import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { ApiClient, asObject } from "../../lib/api.js";
import { createHarness, pathExists, run, SERVER_ROOT, sha256File } from "../../lib/harness.js";
import { sqliteIntegrity, sqliteJson } from "../../lib/sqlite.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(HERE, "../../..");
const MIGRATIONS_ROOT = join(SERVER_ROOT, "migrations");
const TSX = join(SERVER_ROOT, "node_modules", ".bin", "tsx");
const DB_IMPORT = join(SERVER_ROOT, "src", "db.ts");
const MIGRATION_FILES = [
  "000_legacy_compat.sql",
  "001_hyperedge_core.sql",
  "002_legacy_workspace_backfill.sql",
  "003_sandbox_blocked_status.sql",
] as const;
const EXPECTED_PUBLISHED_CHECKSUMS = {
  "000_legacy_compat.sql": "45b8f5ff907f214b0e20f4a9b4f2d37f92a762651b8ce2d7305001ffeda9995d",
  "001_hyperedge_core.sql": "ce2a2754a3b95a39197642b71ef9054d509d7a6882f9f5f74ad46d77c0a78acd",
} as const;

interface SpawnResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

async function spawnResult(command: string, args: readonly string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<SpawnResult> {
  return await new Promise((resolveResult, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(Buffer.from(chunk)));
    child.once("error", reject);
    child.once("close", (exitCode, signal) => resolveResult({
      exitCode,
      signal,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    }));
  });
}

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function legacySchemaSql(): string {
  return `
    PRAGMA foreign_keys = ON;
    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY,
      repo_path TEXT NOT NULL,
      base_branch TEXT NOT NULL,
      worktree_path TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planted',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      cost_usd REAL NOT NULL DEFAULT 0,
      num_turns INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      payload TEXT,
      ts INTEGER NOT NULL
    );
    CREATE INDEX idx_events_workspace ON events(workspace_id, ts);
  `;
}

async function migrationChecksum(filename: typeof MIGRATION_FILES[number]): Promise<string> {
  return createHash("sha256").update(await readFile(join(MIGRATIONS_ROOT, filename))).digest("hex");
}

async function createLegacyDatabase(database: string, repository: string, worktreeRoot: string): Promise<void> {
  const checksums = Object.fromEntries(await Promise.all(
    MIGRATION_FILES.slice(0, 2).map(async (filename) => [filename, await migrationChecksum(filename)] as const),
  ));
  run("sqlite3", [database], {
    input: `.bail on
      BEGIN IMMEDIATE;
      ${legacySchemaSql()}
      CREATE TABLE schema_migrations (
        version TEXT PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        sha256 TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
      INSERT INTO schema_migrations VALUES
        ('000', '000_legacy_compat.sql', ${quoteSql(checksums["000_legacy_compat.sql"])}, 10),
        ('001', '001_hyperedge_core.sql', ${quoteSql(checksums["001_hyperedge_core.sql"])}, 20);
      INSERT INTO workspaces VALUES
        ('legacy-planted', ${quoteSql(repository)}, 'main', ${quoteSql(join(worktreeRoot, "planted"))}, 'legacy/planted', 'Plant a durable task', 'planted', 1000, 1100, 0.25, 2, 3000),
        ('legacy-growing', ${quoteSql(repository)}, 'main', ${quoteSql(join(worktreeRoot, "growing"))}, 'legacy/growing', 'Resume uncertain work', 'growing', 2000, 2300, 1.5, 8, 9000),
        ('legacy-ripe', ${quoteSql(repository)}, 'main', ${quoteSql(join(worktreeRoot, "ripe"))}, 'legacy/ripe', 'Review completed work', 'ripe', 3000, 3500, 2.75, 12, 15000),
        ('legacy-harvested', ${quoteSql(repository)}, 'main', ${quoteSql(join(worktreeRoot, "harvested"))}, 'legacy/harvested', 'Legacy claimed harvest', 'harvested', 4000, 4600, 4.5, 21, 25000),
        ('legacy-wilted', ${quoteSql(repository)}, 'main', ${quoteSql(join(worktreeRoot, "wilted"))}, 'legacy/wilted', 'Preserve wilt terminal state', 'wilted', 5000, 5700, 0.5, 3, 5000);
      INSERT INTO events(workspace_id, type, payload, ts) VALUES
        ('legacy-growing', 'assistant', '{"message":"working"}', 2200),
        ('legacy-ripe', 'result', '{"total_cost_usd":2.75,"num_turns":12,"duration_ms":15000}', 3400),
        ('legacy-harvested', 'raw_output', 'not-json: exact legacy bytes', 4500);
      COMMIT;
    `,
  });
}

async function runDatabaseImport(dataDir: string): Promise<SpawnResult> {
  return spawnResult(TSX, ["--eval", `import(${JSON.stringify(DB_IMPORT)}).then(({ closeDatabase }) => closeDatabase())`], {
    cwd: SERVER_ROOT,
    env: {
      AGENT_FARM_DATA_DIR: dataDir,
      AGENT_FARM_DISABLE_USER_SETTINGS: "1",
    },
  });
}

async function snapshotDatabase(dataDir: string): Promise<Map<string, { size: number; sha256: string }>> {
  const result = new Map<string, { size: number; sha256: string }>();
  if (!(await pathExists(dataDir))) return result;
  const entries = await readdir(dataDir, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const file = join(entry.parentPath, entry.name);
    const relative = file.slice(dataDir.length + 1);
    const bytes = await readFile(file);
    result.set(relative, { size: (await stat(file)).size, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  return result;
}

test("published migration checksums remain immutable and migration 002 has an explicit checksum", async () => {
  assert.equal(await migrationChecksum("000_legacy_compat.sql"), EXPECTED_PUBLISHED_CHECKSUMS["000_legacy_compat.sql"]);
  assert.equal(await migrationChecksum("001_hyperedge_core.sql"), EXPECTED_PUBLISHED_CHECKSUMS["001_hyperedge_core.sql"]);
  assert.match(await migrationChecksum("002_legacy_workspace_backfill.sql"), /^[a-f0-9]{64}$/);
  assert.match(await migrationChecksum("003_sandbox_blocked_status.sql"), /^[a-f0-9]{64}$/);
});

test("real legacy SQLite rows backfill idempotently and are visible through current and compatibility APIs", async () => {
  const harness = await createHarness("legacy-migration-backfill");
  try {
    const git = await harness.createGitFixture({ "README.md": "# migration fixture\n" });
    const database = join(harness.dataDir, "db.sqlite");
    await createLegacyDatabase(database, git.repository, join(harness.dataDir, "legacy-worktrees"));
    // A real historical database can contain the legacy schema while having no migration ledger;
    // current startup must register 000/001 from their immutable SQL before running 002.
    run("sqlite3", [database, "DROP TABLE schema_migrations;"]);

    const server = await harness.startServer({ AGENT_FARM_DISABLE_USER_SETTINGS: "1" });
    const api = new ApiClient(server.baseUrl);
    const current = asObject((await api.get("/api/tasks")).body, "task list");
    const tasks = current.tasks as Array<Record<string, unknown>>;
    assert.equal(tasks.length, 5);
    assert.deepEqual(Object.fromEntries(tasks.map((task) => [task.id, task.status])), {
      "legacy-planted": "seeded",
      "legacy-growing": "recovery_required",
      "legacy-ripe": "review_pending",
      "legacy-harvested": "review_pending",
      "legacy-wilted": "wilted",
    });
    assert.equal(tasks.some((task) => task.status === "harvested"), false, "legacy status must not synthesize a current harvest");
    const ripe = tasks.find((task) => task.id === "legacy-ripe")!;
    assert.deepEqual(
      { repo_path: ripe.repo_path, base_branch: ripe.base_branch, branch_name: ripe.branch_name, cost_usd: ripe.cost_usd, num_turns: ripe.num_turns, duration_ms: ripe.duration_ms },
      { repo_path: git.repository, base_branch: "main", branch_name: "legacy/ripe", cost_usd: 2.75, num_turns: 12, duration_ms: 15000 },
    );

    const compatibilityResponse = await fetch(`${server.baseUrl}/workspaces`);
    assert.equal(compatibilityResponse.status, 200);
    assert.equal(compatibilityResponse.headers.get("deprecation"), "true");
    const compatibility = asObject(await compatibilityResponse.json(), "compatibility task list");
    assert.equal((compatibility.tasks as unknown[]).length, 5);

    const events = asObject((await api.get("/api/events?after_seq=0")).body, "event page");
    const eventRows = events.events as Array<Record<string, unknown>>;
    const legacyRows = eventRows.filter((event) => String(event.type).startsWith("legacy."));
    assert.equal(legacyRows.length, 9, "one repository, five workspaces, and three legacy events are auditable");
    const invalidPayload = legacyRows.find((event) => event.type === "legacy.event.raw_output")!;
    assert.deepEqual((invalidPayload.payload as Record<string, unknown>).payload_text, "not-json: exact legacy bytes");
    assert.equal((invalidPayload.payload as Record<string, unknown>).payload_was_valid_json, 0);

    await harness.stopServer();
    const beforeRestart = await sqliteJson(database, harness.dataDir, `
      SELECT
        (SELECT COUNT(*) FROM repositories) AS repository_count,
        (SELECT COUNT(*) FROM tasks) AS task_count,
        (SELECT COUNT(*) FROM audit_events WHERE event_type LIKE 'legacy.%') AS legacy_event_count,
        (SELECT COUNT(*) FROM schema_migrations WHERE version = '002') AS migration_count,
        (SELECT ledger_id FROM ledger_metadata WHERE id = 1) AS ledger_id;
    `);
    const firstIdentity = beforeRestart[0]!.ledger_id;
    await harness.restartServer({ AGENT_FARM_DISABLE_USER_SETTINGS: "1" });
    await harness.stopServer();
    const afterRestart = await sqliteJson(database, harness.dataDir, `
      SELECT
        (SELECT COUNT(*) FROM repositories) AS repository_count,
        (SELECT COUNT(*) FROM tasks) AS task_count,
        (SELECT COUNT(*) FROM audit_events WHERE event_type LIKE 'legacy.%') AS legacy_event_count,
        (SELECT COUNT(*) FROM schema_migrations WHERE version = '002') AS migration_count,
        (SELECT ledger_id FROM ledger_metadata WHERE id = 1) AS ledger_id;
    `);
    assert.deepEqual(afterRestart, beforeRestart, "restart must preserve backfill cardinality and ledger identity");
    assert.match(String(firstIdentity), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    const lineage = await sqliteJson(database, harness.dataDir, `
      SELECT
        (SELECT COUNT(*) FROM repositories WHERE created_event_seq IS NOT NULL AND last_event_seq IS NOT NULL) AS repositories_linked,
        (SELECT COUNT(*) FROM tasks WHERE created_event_seq IS NOT NULL) AS tasks_linked,
        (SELECT COUNT(*) FROM repositories r LEFT JOIN audit_events e ON e.seq = r.last_event_seq WHERE e.seq IS NULL) AS broken_repository_refs,
        (SELECT COUNT(*) FROM tasks t LEFT JOIN audit_events e ON e.seq = t.created_event_seq WHERE e.seq IS NULL) AS broken_task_refs,
        (SELECT status FROM tasks WHERE id = 'legacy-harvested') AS harvested_mapping;
    `);
    assert.deepEqual(lineage, [{
      repositories_linked: 1,
      tasks_linked: 5,
      broken_repository_refs: 0,
      broken_task_refs: 0,
      harvested_mapping: "review_pending",
    }]);
    assert.deepEqual(await sqliteIntegrity(database, harness.dataDir), ["ok"]);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.dataDirectoryRemoved, true);
  }
});

test("server .env selects the data directory before db.ts opens SQLite", async () => {
  const envPath = join(SERVER_ROOT, ".env");
  const backup = await readFile(envPath).catch(() => null);
  const root = await mkdtemp(join(tmpdir(), "agent-farm-env-preload-"));
  const dataDir = join(root, "selected-by-env");
  try {
    await writeFile(envPath, `AGENT_FARM_DATA_DIR=${dataDir}\n`);
    const result = await spawnResult(TSX, ["--eval", `delete process.env.AGENT_FARM_DATA_DIR; import(${JSON.stringify(DB_IMPORT)}).then(({ DB_PATH, closeDatabase }) => { console.log(DB_PATH); closeDatabase(); })`], {
      cwd: SERVER_ROOT,
      env: { AGENT_FARM_DISABLE_USER_SETTINGS: "1", AGENT_FARM_DATA_DIR: undefined },
    });
    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(result.stdout.trim(), join(dataDir, "db.sqlite"));
    assert.equal(await pathExists(join(dataDir, "db.sqlite")), true);
  } finally {
    if (backup === null) await rm(envPath, { force: true });
    else await writeFile(envPath, backup);
    await rm(root, { recursive: true, force: true });
  }
});

test("unknown future migration fails before any database or reconciliation write", async () => {
  const harness = await createHarness("future-migration-readonly");
  try {
    const database = join(harness.dataDir, "db.sqlite");
    run("sqlite3", [database], {
      input: `
        ${legacySchemaSql()}
        CREATE TABLE schema_migrations (
          version TEXT PRIMARY KEY,
          filename TEXT NOT NULL UNIQUE,
          sha256 TEXT NOT NULL,
          applied_at INTEGER NOT NULL
        );
        INSERT INTO schema_migrations VALUES ('999', '999_future.sql', '${"f".repeat(64)}', 999);
        CREATE TABLE future_owned(value TEXT NOT NULL);
        INSERT INTO future_owned VALUES ('newer-binary-data');
      `,
    });
    const before = await snapshotDatabase(harness.dataDir);
    const result = await runDatabaseImport(harness.dataDir);
    const after = await snapshotDatabase(harness.dataDir);
    assert.notEqual(result.exitCode, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /unknown to this binary.*refusing startup before any database write/i);
    assert.deepEqual(after, before, "fail-fast probe must not create WAL, migration, metadata, or reconciliation writes");
    assert.deepEqual(await sqliteJson(database, harness.dataDir, "SELECT value FROM future_owned;"), [{ value: "newer-binary-data" }]);
    assert.deepEqual(await sqliteJson(database, harness.dataDir, "SELECT version FROM schema_migrations;"), [{ version: "999" }]);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.dataDirectoryRemoved, true);
  }
});

test("checksum failure rolls back migration 002 without partial schema or backfill rows", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-farm-migration-rollback-"));
  const dataDir = join(root, "data");
  const copiedServer = join(root, "server");
  try {
    await mkdir(dataDir, { recursive: true });
    await mkdir(join(copiedServer, "src"), { recursive: true });
    await mkdir(join(copiedServer, "migrations"), { recursive: true });
    await Promise.all([
      copyFile(join(SERVER_ROOT, "src", "db.ts"), join(copiedServer, "src", "db.ts")),
      copyFile(join(SERVER_ROOT, "src", "load-env.ts"), join(copiedServer, "src", "load-env.ts")),
      copyFile(join(SERVER_ROOT, "src", "config.ts"), join(copiedServer, "src", "config.ts")),
      copyFile(join(SERVER_ROOT, "src", "errors.ts"), join(copiedServer, "src", "errors.ts")),
      ...MIGRATION_FILES.map((filename) => copyFile(join(MIGRATIONS_ROOT, filename), join(copiedServer, "migrations", filename))),
    ]);
    await access(join(copiedServer, "src", "db.ts"));
    await access(join(copiedServer, "src", "config.ts"));
    const database = join(dataDir, "db.sqlite");
    run("sqlite3", [database], {
      input: `
        ${legacySchemaSql()}
        INSERT INTO workspaces VALUES ('rollback-task', '/tmp/rollback-repo', 'main', '/tmp/rollback-wt', 'legacy/rollback', 'Rollback fixture', 'planted', 1, 2, 3, 4, 5);
        CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, filename TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL, applied_at INTEGER NOT NULL);
        INSERT INTO schema_migrations VALUES
          ('000', '000_legacy_compat.sql', '${EXPECTED_PUBLISHED_CHECKSUMS["000_legacy_compat.sql"]}', 10),
          ('001', '001_hyperedge_core.sql', '${EXPECTED_PUBLISHED_CHECKSUMS["001_hyperedge_core.sql"]}', 20);
      `,
    });
    const brokenMigration = join(copiedServer, "migrations", "002_legacy_workspace_backfill.sql");
    await writeFile(brokenMigration, `${await readFile(brokenMigration, "utf8")}\nTHIS IS INVALID SQL;\n`);
    const copiedImport = join(copiedServer, "src", "db.ts");
    const result = await spawnResult(TSX, ["--eval", `import(${JSON.stringify(copiedImport)}).then(({ closeDatabase }) => closeDatabase())`], {
      cwd: copiedServer,
      env: { AGENT_FARM_DATA_DIR: dataDir, AGENT_FARM_DISABLE_USER_SETTINGS: "1" },
    });
    assert.notEqual(result.exitCode, 0);
    assert.deepEqual(await sqliteJson(database, dataDir, "SELECT version FROM schema_migrations ORDER BY version;"), [
      { version: "000" },
      { version: "001" },
    ]);
    const schema = await sqliteJson(database, dataDir, `
      SELECT name FROM sqlite_schema
      WHERE type = 'table' AND name IN ('audit_events', 'repositories', 'tasks', 'ledger_metadata')
      ORDER BY name;
    `);
    assert.deepEqual(schema, [], "failed 002 transaction must roll back 001 DDL and all backfill writes");
    assert.deepEqual(await sqliteJson(database, dataDir, "SELECT id, status FROM workspaces;"), [{ id: "rollback-task", status: "planted" }]);
    assert.deepEqual(await sqliteIntegrity(database, dataDir), ["ok"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
