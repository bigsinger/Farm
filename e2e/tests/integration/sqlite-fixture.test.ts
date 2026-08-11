import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createHarness, pathExists, run } from "../../lib/harness.js";
import {
  applyControlledCorruptionFixture,
  findSqliteDatabase,
  sqliteIntegrity,
  sqliteJson,
  sqliteTables,
} from "../../lib/sqlite.js";

test("real SQLite fixture is isolated, read-only by default, explicitly corruptible and auditable", async () => {
  const harness = await createHarness("sqlite-corruption-helper");
  try {
    const database = join(harness.dataDir, "ledger.sqlite");
    run("sqlite3", [database], {
      input: [
        "PRAGMA journal_mode=WAL;",
        "CREATE TABLE ledger_events(seq INTEGER PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL);",
        "INSERT INTO ledger_events(seq, kind, payload) VALUES (1, 'task_seeded', '{}');",
      ].join("\n"),
    });
    assert.equal(await findSqliteDatabase(harness.dataDir), database);
    assert.deepEqual(await sqliteIntegrity(database, harness.dataDir), ["ok"]);
    const tables = await sqliteTables(database, harness.dataDir);
    assert.ok(tables.some((table) => table.name === "ledger_events"));
    assert.deepEqual(await sqliteJson(database, harness.dataDir, "SELECT seq, kind FROM ledger_events ORDER BY seq;"), [
      { seq: 1, kind: "task_seeded" },
    ]);
    await assert.rejects(
      () => sqliteJson(database, harness.dataDir, "INSERT INTO ledger_events VALUES (2, 'forbidden', '{}');"),
      /read-only/,
    );

    const manifest = await applyControlledCorruptionFixture({
      database,
      dataDir: harness.dataDir,
      artifactDir: harness.artifactDir,
      purpose: "corruption fixture only: create a dangling task event for formal reconciliation API coverage",
      statements: [
        {
          sql: "INSERT INTO ledger_events(seq, kind, payload) VALUES (?, ?, ?)",
          parameters: [2, "corruption_fixture_dangling_task", JSON.stringify({ fixture: true })],
        },
      ],
      corruption_fixture: true,
    });
    assert.equal(manifest.schema_version, "agent-farm.e2e-corruption-fixture.v1");
    assert.equal(manifest.corruption_fixture, true);
    assert.equal(manifest.must_reconcile_through_api, true);
    assert.match(manifest.statements_sha256 ?? "", /^[a-f0-9]{64}$/);
    const manifestPath = join(harness.artifactDir, `corruption-fixture-${manifest.fixture_id}.json`);
    assert.equal(await pathExists(manifestPath), true);
    const persisted = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    assert.equal(persisted.corruption_fixture, true);
    assert.equal("sql" in persisted, false);
    assert.deepEqual(await sqliteJson(database, harness.dataDir, "SELECT seq, kind FROM ledger_events ORDER BY seq;"), [
      { seq: 1, kind: "task_seeded" },
      { seq: 2, kind: "corruption_fixture_dangling_task" },
    ]);
    assert.deepEqual(await sqliteIntegrity(database, harness.dataDir), ["ok"]);
  } finally {
    const proof = await harness.cleanup();
    assert.equal(proof.dataDirectoryRemoved, true);
  }
});

test("SQLite helper rejects databases outside the isolated data directory and dangerous fixture SQL", async () => {
  const isolated = await createHarness("sqlite-boundary");
  const outside = await createHarness("sqlite-outside");
  try {
    const outsideDatabase = join(outside.dataDir, "outside.sqlite");
    run("sqlite3", [outsideDatabase, "CREATE TABLE example(id INTEGER PRIMARY KEY);"]);
    await assert.rejects(() => sqliteTables(outsideDatabase, isolated.dataDir), /outside isolated AGENT_FARM_DATA_DIR/);
    await assert.rejects(
      () => applyControlledCorruptionFixture({
        database: outsideDatabase,
        dataDir: outside.dataDir,
        artifactDir: outside.artifactDir,
        purpose: "must reject schema escape",
        statements: [{ sql: `ATTACH DATABASE '${join(outside.root, "forbidden.db").replaceAll("'", "''")}' AS forbidden` }],
        corruption_fixture: true,
      }),
      /must be INSERT, UPDATE, or DELETE|Forbidden/,
    );
  } finally {
    const [isolatedProof, outsideProof] = await Promise.all([isolated.cleanup(), outside.cleanup()]);
    assert.equal(isolatedProof.dataDirectoryRemoved, true);
    assert.equal(outsideProof.dataDirectoryRemoved, true);
  }
});
