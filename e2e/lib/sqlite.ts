import { randomUUID } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { pathExists, run, type JsonObject } from "./harness.js";

export interface CorruptionFixtureManifest extends JsonObject {
  schema_version: "agent-farm.e2e-corruption-fixture.v1";
  fixture_id: string;
  created_at: string;
  database: string;
  purpose: string;
  statements_sha256?: string;
  corruption_fixture: true;
  must_reconcile_through_api: true;
}

async function assertInsideDataDirectory(database: string, dataDir: string): Promise<void> {
  const canonicalData = await realpath(dataDir);
  const canonicalDatabase = await realpath(database);
  const location = relative(canonicalData, canonicalDatabase);
  if (location.startsWith("..") || resolve(canonicalData, location) !== canonicalDatabase) {
    throw new Error(`Refusing SQLite access outside isolated AGENT_FARM_DATA_DIR: ${database}`);
  }
}

export async function findSqliteDatabase(dataDir: string): Promise<string> {
  const candidates = [
    join(dataDir, "agent-farm.sqlite"),
    join(dataDir, "agent-farm.db"),
    join(dataDir, "db.sqlite"),
    join(dataDir, "ledger.sqlite"),
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      await assertInsideDataDirectory(candidate, dataDir);
      return candidate;
    }
  }
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dataDir, { recursive: true, withFileTypes: true });
  const discovered = entries
    .filter((entry) => entry.isFile() && /\.(?:sqlite|sqlite3|db)$/i.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
  if (discovered.length !== 1) {
    throw new Error(`Expected exactly one SQLite database under ${dataDir}, found ${discovered.length}: ${discovered.join(", ")}`);
  }
  await assertInsideDataDirectory(discovered[0]!, dataDir);
  return discovered[0]!;
}

export async function sqliteJson<T extends JsonObject = JsonObject>(database: string, dataDir: string, sql: string): Promise<T[]> {
  await assertInsideDataDirectory(database, dataDir);
  if (!/^\s*(?:SELECT|PRAGMA|WITH)\b/i.test(sql)) throw new Error("sqliteJson is read-only; use a controlled corruption fixture for writes");
  const output = run("sqlite3", ["-readonly", "-json", database, sql]);
  if (!output) return [];
  const parsed = JSON.parse(output) as unknown;
  if (!Array.isArray(parsed)) throw new TypeError(`sqlite3 did not return a JSON array: ${output}`);
  return parsed as T[];
}

export async function sqliteTables(database: string, dataDir: string): Promise<Array<{ name: string; sql: string }>> {
  return sqliteJson(database, dataDir, "SELECT name, sql FROM sqlite_schema WHERE type = 'table' ORDER BY name;");
}

export async function sqliteIntegrity(database: string, dataDir: string): Promise<string[]> {
  const rows = await sqliteJson<{ integrity_check: string }>(database, dataDir, "PRAGMA integrity_check;");
  return rows.map((row) => row.integrity_check);
}

export async function applyControlledCorruptionFixture(options: {
  database: string;
  dataDir: string;
  artifactDir: string;
  purpose: string;
  statements: readonly { sql: string; parameters?: readonly (string | number | null)[] }[];
  corruption_fixture: true;
}): Promise<CorruptionFixtureManifest> {
  if (options.corruption_fixture !== true) throw new Error("Controlled SQLite writes require corruption_fixture=true");
  await assertInsideDataDirectory(options.database, options.dataDir);
  if (!options.purpose.trim()) throw new Error("Corruption fixture purpose is required");
  if (options.statements.length === 0) throw new Error("Corruption fixture requires at least one statement");
  const forbidden = /\b(?:ATTACH|DETACH|VACUUM|PRAGMA\s+(?:writable_schema|journal_mode)|load_extension)\b/i;
  for (const [index, statement] of options.statements.entries()) {
    if (!/^\s*(?:INSERT|UPDATE|DELETE)\b/i.test(statement.sql)) {
      throw new Error(`Corruption statement ${index} must be INSERT, UPDATE, or DELETE`);
    }
    if (forbidden.test(statement.sql)) throw new Error(`Forbidden corruption statement ${index}`);
  }
  const fixtureId = randomUUID();
  const script = [".bail on", "BEGIN IMMEDIATE;"];
  const quote = (value: string | number | null) => {
    if (value === null) return "NULL";
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("SQLite fixture numeric parameters must be finite");
      return String(value);
    }
    return `'${value.replaceAll("'", "''")}'`;
  };
  for (const statement of options.statements) {
    let cursor = 0;
    const parameters = [...(statement.parameters ?? [])];
    const expanded = statement.sql.replace(/\?/g, () => {
      if (cursor >= parameters.length) throw new Error("Missing SQLite fixture parameter");
      return quote(parameters[cursor++]!);
    });
    if (cursor !== parameters.length) throw new Error("Unused SQLite fixture parameter");
    script.push(expanded.endsWith(";") ? expanded : `${expanded};`);
  }
  script.push("COMMIT;");
  const sqlText = `${script.join("\n")}\n`;
  const { createHash } = await import("node:crypto");
  const manifest: CorruptionFixtureManifest = {
    schema_version: "agent-farm.e2e-corruption-fixture.v1",
    fixture_id: fixtureId,
    created_at: new Date().toISOString(),
    database: options.database,
    purpose: options.purpose,
    statements_sha256: createHash("sha256").update(sqlText).digest("hex"),
    corruption_fixture: true,
    must_reconcile_through_api: true,
  };
  await mkdir(options.artifactDir, { recursive: true });
  await writeFile(join(options.artifactDir, `corruption-fixture-${fixtureId}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  // SQL text and values are intentionally not persisted because they may contain repository-local content.
  run("sqlite3", [options.database], { input: sqlText });
  return manifest;
}
