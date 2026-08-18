import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import "./config.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(moduleDir, "../migrations");

export const DATA_DIR_PATH = path.resolve(
  process.env.AGENT_FARM_DATA_DIR?.trim() || path.join(os.homedir(), ".agent-farm"),
);
export const WORKTREES_DIR = path.join(DATA_DIR_PATH, "worktrees");
export const ARTIFACTS_DIR = path.join(DATA_DIR_PATH, "artifacts");
export const LOGS_DIR = path.join(DATA_DIR_PATH, "logs");
export const BENCHMARKS_DIR = path.join(DATA_DIR_PATH, "benchmarks");
export const RUNS_DIR = path.join(DATA_DIR_PATH, "runs");
export const DB_PATH = path.join(DATA_DIR_PATH, "db.sqlite");

interface MigrationFile {
  version: string;
  filename: string;
  sql: string;
  sha256: string;
}

interface AppliedMigration {
  version: string;
  filename: string;
  sha256: string;
}

function migrationVersion(filename: string): string {
  const match = /^(\d+)[_-]/.exec(filename);
  if (!match) throw new Error(`invalid migration filename: ${filename}`);
  return match[1]!;
}

function compareMigrationVersions(left: string, right: string): number {
  const normalizedLeft = left.replace(/^0+(?=\d)/, "");
  const normalizedRight = right.replace(/^0+(?=\d)/, "");
  if (normalizedLeft.length !== normalizedRight.length) return normalizedLeft.length - normalizedRight.length;
  const numeric = normalizedLeft.localeCompare(normalizedRight);
  return numeric === 0 ? left.localeCompare(right) : numeric;
}

function localMigrations(): MigrationFile[] {
  const migrations = fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d+[_-].+\.sql$/.test(name))
    .map((filename) => {
      const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
      return {
        version: migrationVersion(filename),
        filename,
        sql,
        sha256: crypto.createHash("sha256").update(sql).digest("hex"),
      };
    })
    .sort((left, right) => compareMigrationVersions(left.version, right.version) || left.filename.localeCompare(right.filename));
  const versions = new Set<string>();
  for (const migration of migrations) {
    if (versions.has(migration.version)) throw new Error(`duplicate local migration version: ${migration.version}`);
    versions.add(migration.version);
  }
  if (migrations.length === 0) throw new Error(`no migrations found in ${migrationsDir}`);
  return migrations;
}

function tableExists(database: Database.Database, table: string): boolean {
  return database.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(table) !== undefined;
}

function assertDatabaseCompatible(databasePath: string | null, migrations: readonly MigrationFile[]): void {
  if (databasePath === null) return;

  // Open the existing file read-only before creating directories, schema_migrations, WAL files,
  // reconciliation events, or ledger metadata. A newer binary owns a
  // database containing any migration this binary does not know, regardless of how its version sorts.
  const probe = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    if (!tableExists(probe, "schema_migrations")) return;
    const applied = probe.prepare(
      "SELECT version, filename, sha256 FROM schema_migrations ORDER BY length(version), version",
    ).all() as AppliedMigration[];
    const localByVersion = new Map(migrations.map((migration) => [migration.version, migration]));
    const unknown = applied.filter((migration) => !localByVersion.has(migration.version));
    if (unknown.length > 0) {
      const detail = unknown.map((migration) => `${migration.version}:${migration.filename}`).join(", ");
      throw new Error(
        `database contains migration(s) unknown to this binary (${detail}); refusing startup before any database write`,
      );
    }
    for (const migration of applied) {
      const local = localByVersion.get(migration.version)!;
      if (migration.filename !== local.filename || migration.sha256 !== local.sha256) {
        throw new Error(
          `migration ${migration.version} checksum mismatch: database=${migration.filename}:${migration.sha256}, disk=${local.filename}:${local.sha256}`,
        );
      }
    }
  } finally {
    probe.close();
  }
}

const migrations = localMigrations();
const existingDatabasePath = fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 0 ? DB_PATH : null;
assertDatabaseCompatible(existingDatabasePath, migrations);

for (const directory of [DATA_DIR_PATH, WORKTREES_DIR, ARTIFACTS_DIR, LOGS_DIR, BENCHMARKS_DIR, RUNS_DIR]) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
}

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.pragma("synchronous = NORMAL");
db.function("sha256", { deterministic: true }, (value: string | Buffer) =>
  crypto.createHash("sha256").update(value).digest("hex"),
);

function prepareMigration(migration: MigrationFile): void {
  if (migration.filename !== "002_legacy_workspace_backfill.sql" || !tableExists(db, "workspaces")) return;
  const columns = new Set(
    (db.prepare("PRAGMA table_info(workspaces)").all() as Array<{ name: string }>).map((column) => column.name),
  );
  const legacyMetricColumns = [
    ["cost_usd", "REAL NOT NULL DEFAULT 0"],
    ["num_turns", "INTEGER NOT NULL DEFAULT 0"],
    ["duration_ms", "INTEGER NOT NULL DEFAULT 0"],
  ] as const;
  for (const [name, declaration] of legacyMetricColumns) {
    if (columns.has(name)) continue;
    // This runs inside the checksum migration transaction. Legacy Phase 1 databases lack these
    // columns, while Phase 2 databases already have them; SQLite has no ADD COLUMN IF NOT EXISTS.
    db.exec(`ALTER TABLE workspaces ADD COLUMN ${name} ${declaration}`);
  }
}

function applyMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      sha256 TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);
  const applied = new Map(
    (db.prepare("SELECT version, filename, sha256 FROM schema_migrations").all() as AppliedMigration[])
      .map((migration) => [migration.version, migration]),
  );

  for (const migration of migrations) {
    const existing = applied.get(migration.version);
    if (existing) {
      if (existing.filename !== migration.filename || existing.sha256 !== migration.sha256) {
        throw new Error(
          `migration ${migration.version} checksum mismatch: database=${existing.filename}:${existing.sha256}, disk=${migration.filename}:${migration.sha256}`,
        );
      }
      continue;
    }

    db.transaction(() => {
      prepareMigration(migration);
      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, filename, sha256, applied_at) VALUES (?, ?, ?, ?)",
      ).run(migration.version, migration.filename, migration.sha256, Date.now());
    })();
  }
}

function initializeLedgerMetadata(): void {
  if (!tableExists(db, "ledger_metadata")) throw new Error("ledger_metadata migration was not applied");
  db.transaction(() => {
    const rows = db.prepare("SELECT id, ledger_id FROM ledger_metadata ORDER BY id").all() as Array<{
      id: number;
      ledger_id: string;
    }>;
    if (rows.length > 1 || (rows.length === 1 && rows[0]!.id !== 1)) {
      throw new Error("ledger_metadata must contain exactly the singleton row id=1");
    }
    if (rows.length === 0) {
      db.prepare("INSERT INTO ledger_metadata (id, ledger_id, created_at) VALUES (1, ?, ?)")
        .run(crypto.randomUUID(), Date.now());
    }
  })();
}

try {
  applyMigrations();
  initializeLedgerMetadata();
} catch (error) {
  if (db.open) db.close();
  throw error;
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function closeDatabase(): void {
  if (db.open) db.close();
}
