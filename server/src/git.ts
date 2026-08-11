import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const GIT_MAX_BUFFER = 256 * 1024 * 1024;
const TASK_BRANCH_PREFIX = "agent-farm/";
const TASK_TRAILER = "Agent-Farm-Task";
const HARVEST_HISTORY_LIMIT = 1_000;
const SHA_PATTERN = /^[0-9a-f]{40,64}$/;
const harvestQueues = new Map<string, Promise<void>>();

interface GitFailure extends Error {
  code?: number | string;
  stdout?: string | Buffer;
  stderr?: string | Buffer;
}

async function runGit(
  cwd: string,
  args: readonly string[],
  options: { env?: NodeJS.ProcessEnv; trim?: boolean } = {},
): Promise<{ stdout: string }> {
  const { stdout } = await exec("git", [...args], {
    cwd,
    env: options.env,
    encoding: "utf8",
    maxBuffer: GIT_MAX_BUFFER,
  });
  return { stdout: options.trim === false ? stdout : stdout.trim() };
}

async function runGitBuffer(cwd: string, args: readonly string[]): Promise<Buffer> {
  const { stdout } = await exec("git", [...args], {
    cwd,
    encoding: null,
    maxBuffer: GIT_MAX_BUFFER,
  });
  return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
}

async function git(cwd: string, args: readonly string[]): Promise<string> {
  return (await runGit(cwd, args)).stdout;
}

function failureText(error: unknown): string {
  if (error instanceof Error) {
    const failure = error as GitFailure;
    const stderr = typeof failure.stderr === "string" ? failure.stderr.trim() : "";
    return stderr || error.message;
  }
  return String(error);
}

function failureCode(error: unknown): number | string | undefined {
  return error instanceof Error ? (error as GitFailure).code : undefined;
}

function isGitlessFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const failure = error as GitFailure;
  const stderr = typeof failure.stderr === "string" ? failure.stderr : "";
  return /(?:not a git repository|must be run in a work tree)/i.test(stderr);
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.lstat(candidate);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function canonicalExistingPath(candidate: string): Promise<string> {
  return path.normalize(await fs.realpath(path.resolve(candidate)));
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function canonicalContainedPath(parentInput: string, candidateInput: string): Promise<string> {
  const parent = await canonicalExistingPath(parentInput);
  const candidate = path.resolve(candidateInput);
  if (!isWithin(parent, candidate)) {
    throw new Error(`refusing path outside '${parent}': ${candidate}`);
  }

  let cursor = candidate;
  const remainder: string[] = [];
  while (!(await pathExists(cursor))) {
    const next = path.dirname(cursor);
    if (next === cursor) break;
    remainder.unshift(path.basename(cursor));
    cursor = next;
  }
  const realAncestor = await canonicalExistingPath(cursor);
  const resolvedCandidate = path.resolve(realAncestor, ...remainder);
  if (!isWithin(parent, resolvedCandidate)) {
    throw new Error(`refusing path that escapes '${parent}' through a symbolic link: ${candidate}`);
  }
  return candidate;
}

function validateTaskId(taskId: string): string {
  const value = taskId.trim();
  if (
    value.length === 0 ||
    value.length > 160 ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.startsWith("-") ||
    value.endsWith(".") ||
    value.endsWith(".lock") ||
    value.includes("..") ||
    /[\x00-\x20~^:?*[\]]/.test(value) ||
    /[^A-Za-z0-9._-]/.test(value)
  ) {
    throw new Error(`invalid task id: ${JSON.stringify(taskId)}`);
  }
  return value;
}

function taskBranchName(taskId: string): string {
  return `${TASK_BRANCH_PREFIX}${validateTaskId(taskId)}`;
}

function taskIdFromBranchName(branchName: string): string {
  if (!branchName.startsWith(TASK_BRANCH_PREFIX)) {
    throw new Error(`refusing non-task branch: ${JSON.stringify(branchName)}`);
  }
  const taskId = branchName.slice(TASK_BRANCH_PREFIX.length);
  validateTaskId(taskId);
  return taskId;
}

function validateTaskBranch(branchName: string, taskId: string): string {
  const expected = taskBranchName(taskId);
  if (branchName !== expected) {
    throw new Error(`branch '${branchName}' does not belong to task '${taskId}'`);
  }
  return branchName;
}

function validateBranchArgument(branchName: string, label: string): string {
  if (
    branchName.length === 0 ||
    branchName.startsWith("-") ||
    branchName.includes("\0") ||
    /[\x00-\x20~^:?*[\]\\]/.test(branchName)
  ) {
    throw new Error(`invalid ${label}: ${JSON.stringify(branchName)}`);
  }
  return branchName;
}

function validateCommitish(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.startsWith("-") || trimmed.includes("\0") || /[\r\n]/.test(trimmed)) {
    throw new Error(`invalid ${label}: ${JSON.stringify(value)}`);
  }
  return trimmed;
}

function validateTitle(title: string): string {
  const normalized = title.replace(/[\r\n]+/g, " ").trim();
  return normalized || "Agent Farm task changes";
}

async function resolveCommit(repoRoot: string, value: string, label: string): Promise<string> {
  const candidate = validateCommitish(value, label);
  const commit = await git(repoRoot, ["rev-parse", "--verify", `${candidate}^{commit}`]);
  if (!SHA_PATTERN.test(commit)) throw new Error(`git returned an invalid commit for ${label}: ${commit}`);
  return commit;
}

async function currentHead(repoRoot: string): Promise<string> {
  return resolveCommit(repoRoot, "HEAD", "HEAD");
}

async function currentBranch(repoRoot: string): Promise<string | null> {
  try {
    const branch = await git(repoRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
    return branch || null;
  } catch {
    return null;
  }
}

async function repositoryStatus(repoRoot: string): Promise<string> {
  return (await runGit(repoRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { trim: false })).stdout;
}

async function verifyRepositoryRoot(repoRoot: string): Promise<string> {
  const root = await canonicalExistingPath(repoRoot);
  const topLevel = await canonicalExistingPath(await git(root, ["rev-parse", "--show-toplevel"]));
  if (root !== topLevel) throw new Error(`expected repository root '${topLevel}', received '${root}'`);
  return root;
}

async function referenceExists(repoRoot: string, reference: string): Promise<boolean> {
  try {
    await git(repoRoot, ["show-ref", "--verify", "--quiet", reference]);
    return true;
  } catch (error) {
    if (failureCode(error) === 1) return false;
    throw error;
  }
}

async function indexDiffersFromHead(repoRoot: string): Promise<boolean> {
  try {
    await git(repoRoot, ["diff-index", "--cached", "--quiet", "HEAD", "--"]);
    return false;
  } catch (error) {
    if (failureCode(error) === 1) return true;
    throw error;
  }
}

async function withHarvestLock<T>(root: string, operation: () => Promise<T>): Promise<T> {
  const predecessor = harvestQueues.get(root) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = predecessor.catch(() => undefined).then(() => current);
  harvestQueues.set(root, queued);
  await predecessor.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    if (harvestQueues.get(root) === queued) harvestQueues.delete(root);
  }
}

async function resolveDefaultBranch(repoRoot: string, branch: string | null): Promise<string | null> {
  if (branch) return branch;

  try {
    const originHead = await git(repoRoot, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
    const prefix = "refs/remotes/origin/";
    if (originHead.startsWith(prefix) && originHead.length > prefix.length) {
      return originHead.slice(prefix.length);
    }
  } catch {
    // A local repository does not need an origin remote.
  }

  for (const candidate of ["main", "master"] as const) {
    if (await referenceExists(repoRoot, `refs/heads/${candidate}`)) return candidate;
    if (await referenceExists(repoRoot, `refs/remotes/origin/${candidate}`)) return candidate;
  }
  return null;
}

export interface RepositoryInspection {
  inputPath: string;
  rootPath: string;
  gitDir: string | null;
  isGit: boolean;
  defaultBranch: string | null;
  headCommit: string | null;
  clean: boolean;
  statusPorcelain: string;
  error?: string;
}

export async function inspectRepository(inputPath: string): Promise<RepositoryInspection> {
  const absoluteInput = path.resolve(inputPath);
  let canonicalInput: string;
  try {
    canonicalInput = await canonicalExistingPath(absoluteInput);
  } catch (error) {
    return {
      inputPath,
      rootPath: absoluteInput,
      gitDir: null,
      isGit: false,
      defaultBranch: null,
      headCommit: null,
      clean: false,
      statusPorcelain: "",
      error: failureText(error),
    };
  }

  let rootPath: string;
  try {
    const inputStats = await fs.stat(canonicalInput);
    const inspectionCwd = inputStats.isDirectory() ? canonicalInput : path.dirname(canonicalInput);
    const root = await git(inspectionCwd, ["rev-parse", "--show-toplevel"]);
    rootPath = await canonicalExistingPath(root);
  } catch (error) {
    return {
      inputPath,
      rootPath: canonicalInput,
      gitDir: null,
      isGit: false,
      defaultBranch: null,
      headCommit: null,
      clean: true,
      statusPorcelain: "",
      ...(isGitlessFailure(error) ? {} : { error: failureText(error) }),
    };
  }

  try {
    const rawGitDir = await git(rootPath, ["rev-parse", "--absolute-git-dir"]);
    const gitDir = await canonicalExistingPath(rawGitDir);
    const [headResult, statusPorcelain, branch] = await Promise.all([
      currentHead(rootPath).then((commit) => ({ commit })).catch(() => ({ commit: null })),
      repositoryStatus(rootPath),
      currentBranch(rootPath),
    ]);
    return {
      inputPath,
      rootPath,
      gitDir,
      isGit: true,
      defaultBranch: await resolveDefaultBranch(rootPath, branch),
      headCommit: headResult.commit,
      clean: statusPorcelain.length === 0,
      statusPorcelain,
    };
  } catch (error) {
    return {
      inputPath,
      rootPath,
      gitDir: null,
      isGit: false,
      defaultBranch: null,
      headCommit: null,
      clean: false,
      statusPorcelain: "",
      error: failureText(error),
    };
  }
}

export async function detectDefaultBranch(repoPath: string): Promise<string> {
  const canonicalInput = await canonicalExistingPath(repoPath);
  const stats = await fs.stat(canonicalInput);
  const cwd = stats.isDirectory() ? canonicalInput : path.dirname(canonicalInput);
  const root = await canonicalExistingPath(await git(cwd, ["rev-parse", "--show-toplevel"]));
  const defaultBranch = await resolveDefaultBranch(root, await currentBranch(root));
  if (!defaultBranch) throw new Error(`cannot determine a default branch for '${root}'`);
  return defaultBranch;
}

export interface CreateTaskWorktreeSpec {
  repoRoot: string;
  taskId: string;
  baseCommit: string;
  worktreesDir: string;
}

export interface TaskWorktreeResult {
  worktreePath: string;
  branchName: string;
}

export async function createTaskWorktree({
  repoRoot,
  taskId,
  baseCommit,
  worktreesDir,
}: CreateTaskWorktreeSpec): Promise<TaskWorktreeResult> {
  const root = await verifyRepositoryRoot(repoRoot);
  const id = validateTaskId(taskId);
  const branchName = taskBranchName(id);
  const baseSha = await resolveCommit(root, baseCommit, "base commit");

  await fs.mkdir(path.resolve(worktreesDir), { recursive: true, mode: 0o700 });
  const worktreesRoot = await canonicalExistingPath(worktreesDir);
  const worktreePath = await canonicalContainedPath(worktreesRoot, path.join(worktreesRoot, id));
  if (await pathExists(worktreePath)) {
    throw new Error(`worktree path already exists: ${worktreePath}`);
  }
  if (await referenceExists(root, `refs/heads/${branchName}`)) {
    throw new Error(`task branch already exists: ${branchName}`);
  }

  try {
    await git(root, ["worktree", "add", "--no-track", "-b", branchName, worktreePath, baseSha]);
  } catch (error) {
    await git(root, ["worktree", "prune"]).catch(() => undefined);
    if (await pathExists(worktreePath)) await fs.rm(worktreePath, { recursive: true, force: true }).catch(() => undefined);
    if (await referenceExists(root, `refs/heads/${branchName}`).catch(() => false)) {
      await git(root, ["branch", "-D", "--", branchName]).catch(() => undefined);
    }
    throw error;
  }

  const actualPath = await canonicalExistingPath(worktreePath);
  if (!isWithin(worktreesRoot, actualPath)) {
    await git(root, ["worktree", "remove", "--force", actualPath]).catch(() => undefined);
    await git(root, ["branch", "-D", "--", branchName]).catch(() => undefined);
    throw new Error(`created worktree escaped '${worktreesRoot}': ${actualPath}`);
  }
  const headCommit = await currentHead(actualPath);
  const actualBranch = await currentBranch(actualPath);
  if (headCommit !== baseSha || actualBranch !== branchName) {
    await git(root, ["worktree", "remove", "--force", actualPath]).catch(() => undefined);
    await git(root, ["branch", "-D", "--", branchName]).catch(() => undefined);
    throw new Error(`created worktree verification failed for task '${id}'`);
  }

  return { worktreePath: actualPath, branchName };
}

export type DiffStatus = "added" | "modified" | "deleted" | "renamed" | "copied" | "type-changed" | "unmerged" | "unknown";

export interface DiffEntry {
  status: DiffStatus;
  statusCode: string;
  path: string;
  oldPath?: string;
  oldMode: string;
  newMode: string;
  oldSha: string;
  newSha: string;
  similarity?: number;
  binary: boolean;
  symlink: boolean;
}

export interface DiffArtifact {
  kind: "patch" | "diff_stat" | "manifest";
  path: string;
  mediaType: string;
  sha256: string;
  sizeBytes: number;
  metadata: Record<string, unknown>;
}

export interface DiffSnapshot {
  digest: string;
  changedPaths: string[];
  entries: DiffEntry[];
  hasChanges: boolean;
  artifacts: DiffArtifact[];
  // Compatibility/detail fields retained for callers that need provenance.
  taskId?: string;
  runId?: string;
  baseCommit?: string;
  sha256?: string;
  sizeBytes?: number;
}

function splitNull(value: string): string[] {
  const fields = value.split("\0");
  if (fields.at(-1) === "") fields.pop();
  return fields;
}

function mapDiffStatus(code: string): DiffStatus {
  switch (code[0]) {
    case "A": return "added";
    case "M": return "modified";
    case "D": return "deleted";
    case "R": return "renamed";
    case "C": return "copied";
    case "T": return "type-changed";
    case "U": return "unmerged";
    default: return "unknown";
  }
}

interface NameStatusEntry {
  statusCode: string;
  path: string;
  oldPath?: string;
}

function parseNameStatus(value: string): NameStatusEntry[] {
  const fields = splitNull(value);
  const entries: NameStatusEntry[] = [];
  for (let index = 0; index < fields.length;) {
    const statusCode = fields[index++];
    if (!statusCode || !/^[A-Z][0-9]*$/.test(statusCode)) {
      throw new Error(`unrecognized git name-status record: ${statusCode ?? "<missing>"}`);
    }
    const firstPath = fields[index++];
    if (firstPath === undefined) throw new Error("git name-status record is missing a path");
    if (statusCode[0] === "R" || statusCode[0] === "C") {
      const secondPath = fields[index++];
      if (secondPath === undefined) throw new Error("git rename/copy name-status record is missing its destination path");
      entries.push({ statusCode, oldPath: firstPath, path: secondPath });
    } else {
      entries.push({ statusCode, path: firstPath });
    }
  }
  return entries;
}

function assertNameStatusMatchesRaw(nameStatus: readonly NameStatusEntry[], entries: readonly DiffEntry[]): void {
  if (nameStatus.length !== entries.length) {
    throw new Error(`git diff metadata disagrees: name-status has ${nameStatus.length} entries, raw has ${entries.length}`);
  }
  for (let index = 0; index < entries.length; index += 1) {
    const named = nameStatus[index]!;
    const raw = entries[index]!;
    if (named.statusCode !== raw.statusCode || named.path !== raw.path || named.oldPath !== raw.oldPath) {
      throw new Error(`git diff metadata disagrees at entry ${index}: name-status and raw records differ`);
    }
  }
}

function parseRawDiff(raw: string, binaryPaths: ReadonlySet<string>): DiffEntry[] {
  const fields = splitNull(raw);
  const entries: DiffEntry[] = [];
  for (let index = 0; index < fields.length;) {
    const metadata = fields[index++];
    if (!metadata?.startsWith(":")) throw new Error("invalid git raw diff metadata");
    const match = /^:([0-7]{6}) ([0-7]{6}) ([0-9a-f]+) ([0-9a-f]+) ([A-Z][0-9]*)$/.exec(metadata);
    if (!match) throw new Error(`unrecognized git raw diff record: ${metadata}`);
    const [, oldMode, newMode, oldSha, newSha, statusCode] = match;
    const statusLetter = statusCode![0]!;
    const firstPath = fields[index++];
    if (firstPath === undefined) throw new Error("git raw diff record is missing a path");
    let oldPath: string | undefined;
    let entryPath = firstPath;
    if (statusLetter === "R" || statusLetter === "C") {
      oldPath = firstPath;
      const secondPath = fields[index++];
      if (secondPath === undefined) throw new Error("git rename/copy record is missing its destination path");
      entryPath = secondPath;
    }
    entries.push({
      status: mapDiffStatus(statusCode!),
      statusCode: statusCode!,
      path: entryPath,
      ...(oldPath === undefined ? {} : { oldPath }),
      oldMode: oldMode!,
      newMode: newMode!,
      oldSha: oldSha!,
      newSha: newSha!,
      ...(statusCode!.length > 1 ? { similarity: Number(statusCode!.slice(1)) } : {}),
      binary: binaryPaths.has(entryPath) || (oldPath !== undefined && binaryPaths.has(oldPath)),
      symlink: oldMode === "120000" || newMode === "120000",
    });
  }
  return entries;
}

interface NumstatSummary {
  binaryPaths: Set<string>;
  additions: number;
  deletions: number;
}

function summarizeNumstat(numstat: string): NumstatSummary {
  const fields = splitNull(numstat);
  const binaryPaths = new Set<string>();
  let totalAdditions = 0;
  let totalDeletions = 0;
  for (let index = 0; index < fields.length;) {
    const record = fields[index++];
    if (record === undefined) break;
    const firstTab = record.indexOf("\t");
    const secondTab = firstTab < 0 ? -1 : record.indexOf("\t", firstTab + 1);
    if (firstTab < 0 || secondTab < 0) throw new Error(`unrecognized git numstat record: ${record}`);
    const additions = record.slice(0, firstTab);
    const deletions = record.slice(firstTab + 1, secondTab);
    const pathField = record.slice(secondTab + 1);
    const paths: string[] = [];
    if (pathField === "") {
      const oldPath = fields[index++];
      const newPath = fields[index++];
      if (oldPath === undefined || newPath === undefined) throw new Error("git rename numstat record is incomplete");
      paths.push(oldPath, newPath);
    } else {
      paths.push(pathField);
    }
    if (additions === "-" && deletions === "-") {
      for (const changedPath of paths) binaryPaths.add(changedPath);
    } else {
      totalAdditions += Number(additions);
      totalDeletions += Number(deletions);
    }
  }
  return { binaryPaths, additions: totalAdditions, deletions: totalDeletions };
}

function stableStringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeAtomic(filePath: string, data: string | Buffer): Promise<void> {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporaryPath, data, { flag: "wx", mode: 0o600 });
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function artifact(
  kind: DiffArtifact["kind"],
  artifactPath: string,
  mediaType: string,
  contents: Buffer,
  metadata: Record<string, unknown>,
): DiffArtifact {
  return {
    kind,
    path: artifactPath,
    mediaType,
    sha256: crypto.createHash("sha256").update(contents).digest("hex"),
    sizeBytes: contents.byteLength,
    metadata,
  };
}

export interface CaptureTaskDiffSpec {
  worktreePath: string;
  baseCommit: string;
  artifactDir: string;
  taskId: string;
  runId?: string;
}

export async function captureTaskDiff({
  worktreePath,
  baseCommit,
  artifactDir,
  taskId,
  runId,
}: CaptureTaskDiffSpec): Promise<DiffSnapshot> {
  const worktree = await canonicalExistingPath(worktreePath);
  const id = validateTaskId(taskId);
  const baseSha = await resolveCommit(worktree, baseCommit, "base commit");
  await git(worktree, ["add", "-A"]);

  const diffProjection = (args: readonly string[]) => ["diff", "--cached", ...args, "--find-renames", baseSha, "--"];
  const [patchResult, statResult, nameStatusResult, rawResult, numstatResult] = await Promise.all([
    runGitBuffer(worktree, diffProjection(["--binary", "--full-index", "--no-ext-diff", "--no-textconv"])),
    runGit(worktree, diffProjection(["--stat"]), { trim: false }),
    runGit(worktree, diffProjection(["--name-status", "-z"]), { trim: false }),
    runGit(worktree, diffProjection(["--raw", "-z", "--no-abbrev"]), { trim: false }),
    runGit(worktree, diffProjection(["--numstat", "-z"]), { trim: false }),
  ]);

  const numstatSummary = summarizeNumstat(numstatResult.stdout);
  const entries = parseRawDiff(rawResult.stdout, numstatSummary.binaryPaths);
  assertNameStatusMatchesRaw(parseNameStatus(nameStatusResult.stdout), entries);
  const changedPaths = [...new Set(entries.flatMap((entry) => entry.oldPath ? [entry.oldPath, entry.path] : [entry.path]))].sort((left, right) => left.localeCompare(right));
  const hasChanges = entries.length > 0;
  const patchBuffer = patchResult;
  const statBuffer = Buffer.from(statResult.stdout, "utf8");
  const manifestMetadata: Record<string, unknown> = {
    file_count: entries.length,
    additions: numstatSummary.additions,
    deletions: numstatSummary.deletions,
    has_binary: entries.some((entry) => entry.binary),
    changed_paths: changedPaths,
  };

  const artifactRoot = path.resolve(artifactDir);
  await fs.mkdir(artifactRoot, { recursive: true, mode: 0o700 });
  const canonicalArtifactRoot = await canonicalExistingPath(artifactRoot);
  const patchPath = path.join(canonicalArtifactRoot, "patch.diff");
  const statPath = path.join(canonicalArtifactRoot, "stat.txt");
  const manifestPath = path.join(canonicalArtifactRoot, "manifest.json");
  const patchArtifact = artifact("patch", patchPath, "text/x-diff; charset=utf-8", patchBuffer, {
    base_commit: baseSha,
    has_binary: manifestMetadata.has_binary,
    changed_paths: changedPaths,
  });
  const statArtifact = artifact("diff_stat", statPath, "text/plain; charset=utf-8", statBuffer, manifestMetadata);
  const manifestPayload = {
    schemaVersion: "1.0",
    taskId: id,
    ...(runId === undefined ? {} : { runId }),
    baseCommit: baseSha,
    hasChanges,
    changedPaths,
    entries,
    ...manifestMetadata,
    patch: { sha256: patchArtifact.sha256, sizeBytes: patchArtifact.sizeBytes },
    stat: { sha256: statArtifact.sha256, sizeBytes: statArtifact.sizeBytes },
  };
  const manifestBuffer = Buffer.from(stableStringify(manifestPayload), "utf8");
  const manifestArtifact = artifact("manifest", manifestPath, "application/json; charset=utf-8", manifestBuffer, manifestMetadata);

  await Promise.all([
    writeAtomic(patchPath, patchBuffer),
    writeAtomic(statPath, statBuffer),
    writeAtomic(manifestPath, manifestBuffer),
  ]);

  return {
    digest: patchArtifact.sha256,
    changedPaths,
    entries,
    hasChanges,
    artifacts: [patchArtifact, statArtifact, manifestArtifact],
    taskId: id,
    ...(runId === undefined ? {} : { runId }),
    baseCommit: baseSha,
    sha256: patchArtifact.sha256,
    sizeBytes: patchArtifact.sizeBytes,
  };
}

function commitEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (!env.GIT_AUTHOR_NAME?.trim()) env.GIT_AUTHOR_NAME = "Agent Farm";
  if (!env.GIT_AUTHOR_EMAIL?.trim()) env.GIT_AUTHOR_EMAIL = "agent-farm@localhost";
  if (!env.GIT_COMMITTER_NAME?.trim()) env.GIT_COMMITTER_NAME = env.GIT_AUTHOR_NAME;
  if (!env.GIT_COMMITTER_EMAIL?.trim()) env.GIT_COMMITTER_EMAIL = env.GIT_AUTHOR_EMAIL;
  return env;
}

function commitMessage(taskId: string, title: string): string {
  return `${validateTitle(title)}\n\n${TASK_TRAILER}: ${validateTaskId(taskId)}`;
}

export interface CommitTaskChangesSpec {
  worktreePath: string;
  baseCommit: string;
  taskId: string;
  title: string;
  expectedDiffDigest?: string;
}

export interface CommitTaskChangesResult {
  commit: string;
  createdCommit: boolean;
  hasChanges: boolean;
  diffDigest: string;
}

async function diffDigest(repoRoot: string, baseCommit: string, target?: string): Promise<string> {
  const args = ["diff", "--binary", "--full-index", "--no-ext-diff", "--no-textconv", "--find-renames"];
  if (target === undefined) args.push("--cached", baseCommit, "--");
  else args.push(baseCommit, target, "--");
  return crypto.createHash("sha256").update(await runGitBuffer(repoRoot, args)).digest("hex");
}

async function rollbackCreatedTaskCommit(
  worktree: string,
  branchName: string,
  createdCommit: string,
  headBefore: string,
): Promise<void> {
  const [branch, head] = await Promise.all([currentBranch(worktree), currentHead(worktree)]);
  if (branch !== branchName || head !== createdCommit) {
    throw new Error(
      `refusing task commit rollback: expected '${branchName}' at '${createdCommit}', found '${branch ?? "detached HEAD"}' at '${head}'`,
    );
  }
  await git(worktree, ["update-ref", `refs/heads/${branchName}`, headBefore, createdCommit]);
  await git(worktree, ["read-tree", "--reset", headBefore]);
}

export async function commitTaskChanges({
  worktreePath,
  baseCommit,
  taskId,
  title,
  expectedDiffDigest,
}: CommitTaskChangesSpec): Promise<CommitTaskChangesResult> {
  const worktree = await canonicalExistingPath(worktreePath);
  const baseSha = await resolveCommit(worktree, baseCommit, "base commit");
  const branchName = taskBranchName(taskId);
  const branch = await currentBranch(worktree);
  if (branch !== branchName) throw new Error(`expected task branch '${branchName}', found '${branch ?? "detached HEAD"}'`);

  const headBefore = await currentHead(worktree);
  try {
    await git(worktree, ["merge-base", "--is-ancestor", baseSha, headBefore]);
  } catch {
    throw new Error(`task HEAD '${headBefore}' does not descend from base commit '${baseSha}'`);
  }

  await git(worktree, ["add", "-A"]);
  const stagedDigest = await diffDigest(worktree, baseSha);
  if (expectedDiffDigest !== undefined && stagedDigest !== expectedDiffDigest) {
    throw new Error(
      `reviewed diff digest '${expectedDiffDigest}' does not match staged task diff '${stagedDigest}'`,
    );
  }
  const indexChanged = await indexDiffersFromHead(worktree);

  if (!indexChanged) {
    const status = await repositoryStatus(worktree);
    if (status.length !== 0) throw new Error("task worktree remained dirty after staging all changes");
    return { commit: headBefore, createdCommit: false, hasChanges: headBefore !== baseSha, diffDigest: stagedDigest };
  }

  const intendedTree = await git(worktree, ["write-tree"]);
  let commit: string | null = null;
  try {
    await runGit(worktree, ["commit", "-m", commitMessage(taskId, title)], { env: commitEnvironment() });
    commit = await currentHead(worktree);
    const [committedTree, committedDigest, status, committedBranch] = await Promise.all([
      git(worktree, ["rev-parse", "--verify", `${commit}^{tree}`]),
      diffDigest(worktree, baseSha, commit),
      repositoryStatus(worktree),
      currentBranch(worktree),
    ]);
    if (committedBranch !== branchName) {
      throw new Error(`task commit switched to '${committedBranch ?? "detached HEAD"}', expected '${branchName}'`);
    }
    if (committedTree !== intendedTree) {
      throw new Error(`task commit tree '${committedTree}' differs from reviewed index tree '${intendedTree}'`);
    }
    if (committedDigest !== stagedDigest || (expectedDiffDigest !== undefined && committedDigest !== expectedDiffDigest)) {
      throw new Error(
        `task commit diff '${committedDigest}' differs from reviewed diff '${expectedDiffDigest ?? stagedDigest}'`,
      );
    }
    if (status.length !== 0) throw new Error(`task commit '${commit}' left the worktree dirty`);
    return { commit, createdCommit: true, hasChanges: true, diffDigest: committedDigest };
  } catch (error) {
    if (commit !== null) {
      try {
        await rollbackCreatedTaskCommit(worktree, branchName, commit, headBefore);
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], `task commit verification and rollback failed for '${taskId}'`);
      }
    }
    throw error;
  }
}

function exactTaskTrailer(message: string, taskId: string): boolean {
  const expected = `${TASK_TRAILER}: ${taskId}`;
  const normalized = message.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  const separator = normalized.lastIndexOf("\n\n");
  if (separator < 0) return false;
  const trailerBlock = normalized.slice(separator + 2).split("\n");
  return trailerBlock.filter((line) => line === expected).length === 1 && trailerBlock.at(-1) === expected;
}

export interface FindTaskHarvestCommitSpec {
  repoRoot: string;
  taskId: string;
  afterCommit?: string;
  baseBranch?: string;
}

export async function findTaskHarvestCommit({
  repoRoot,
  taskId,
  afterCommit,
  baseBranch,
}: FindTaskHarvestCommitSpec): Promise<string | null> {
  const root = await verifyRepositoryRoot(repoRoot);
  const id = validateTaskId(taskId);
  const checkedOutBranch = await currentBranch(root);
  if (checkedOutBranch === null) {
    throw new Error("refusing to locate a harvest commit from a detached base checkout");
  }
  const base = validateBranchArgument(baseBranch ?? checkedOutBranch, "base branch");
  if (checkedOutBranch !== base) {
    throw new Error(`refusing to locate a harvest commit: repository is on '${checkedOutBranch}', not '${base}'`);
  }
  const baseReference = `refs/heads/${base}`;
  const baseHead = await resolveCommit(root, baseReference, "base branch");
  let range = baseReference;
  if (afterCommit !== undefined) {
    const afterSha = await resolveCommit(root, afterCommit, "after commit");
    try {
      await git(root, ["merge-base", "--is-ancestor", afterSha, baseHead]);
    } catch {
      throw new Error(`after commit '${afterSha}' is not an ancestor of base branch '${base}' at '${baseHead}'`);
    }
    if (afterSha === baseHead) return null;
    range = `${afterSha}..${baseReference}`;
  }

  const output = (await runGit(root, [
    "log",
    "--first-parent",
    `--max-count=${HARVEST_HISTORY_LIMIT}`,
    "-z",
    "--format=%H%x00%B%x00",
    range,
  ], { trim: false })).stdout;
  const records = output.split("\0\0");
  for (const record of records) {
    const normalizedRecord = record.replace(/^\n+/, "");
    if (!normalizedRecord) continue;
    const separator = normalizedRecord.indexOf("\0");
    if (separator < 0) throw new Error("invalid git log output while locating task harvest commit");
    const commit = normalizedRecord.slice(0, separator);
    const message = normalizedRecord.slice(separator + 1);
    if (!SHA_PATTERN.test(commit)) throw new Error("invalid git log output while locating task harvest commit");
    if (exactTaskTrailer(message, id)) return commit;
  }
  return null;
}

export interface HarvestTaskBranchSpec {
  repoRoot: string;
  baseBranch: string;
  branchName: string;
  taskId: string;
  title: string;
  expectedBranchCommit?: string;
  expectedBaseCommit?: string;
}

export interface HarvestTaskBranchResult {
  commit: string;
  preCommit: string;
}

export async function harvestTaskBranch({
  repoRoot,
  baseBranch,
  branchName,
  taskId,
  title,
  expectedBranchCommit,
  expectedBaseCommit,
}: HarvestTaskBranchSpec): Promise<HarvestTaskBranchResult> {
  const root = await verifyRepositoryRoot(repoRoot);
  const id = validateTaskId(taskId);
  const base = validateBranchArgument(baseBranch, "base branch");
  validateTaskBranch(branchName, id);

  return withHarvestLock(root, async () => {
    const branch = await currentBranch(root);
    if (branch !== base) throw new Error(`refusing to harvest: repository is on '${branch ?? "detached HEAD"}', not '${base}'`);
    const initialStatus = await repositoryStatus(root);
    if (initialStatus.length !== 0) throw new Error(`refusing to harvest into dirty base repository '${root}'`);
    const preCommit = await currentHead(root);
    if (expectedBaseCommit !== undefined) {
      const expectedBaseSha = await resolveCommit(root, expectedBaseCommit, "recorded task base commit");
      try {
        await git(root, ["merge-base", "--is-ancestor", expectedBaseSha, preCommit]);
      } catch {
        throw new Error(
          `recorded task base commit '${expectedBaseSha}' is not an ancestor of base branch '${base}' at '${preCommit}'`,
        );
      }
    }
    const branchCommit = await resolveCommit(root, `refs/heads/${branchName}`, "task branch");
    if (expectedBranchCommit !== undefined) {
      const expectedCommit = await resolveCommit(root, expectedBranchCommit, "expected task branch commit");
      if (branchCommit !== expectedCommit) {
        throw new Error(`task branch moved from reviewed commit '${expectedCommit}' to '${branchCommit}'`);
      }
    }

    try {
      await git(root, ["merge", "--squash", "--", branchName]);
      if (!(await indexDiffersFromHead(root))) {
        throw new Error(`task branch '${branchName}' has no changes to harvest`);
      }
      await runGit(root, ["commit", "-m", commitMessage(id, title)], { env: commitEnvironment() });
      const commit = await currentHead(root);
      const [finalStatus, finalBranch] = await Promise.all([repositoryStatus(root), currentBranch(root)]);
      if (finalBranch !== base) {
        throw new Error(`harvest commit verification found '${finalBranch ?? "detached HEAD"}', expected '${base}'`);
      }
      if (finalStatus.length !== 0) throw new Error(`harvest commit '${commit}' left the base repository dirty`);
      return { commit, preCommit };
    } catch (error) {
      let recoveryError: unknown;
      try {
        await restoreBaseRepository({ repoRoot: root, preCommit, baseBranch: base });
      } catch (caught) {
        recoveryError = caught;
      }
      if (recoveryError !== undefined) {
        throw new AggregateError([error, recoveryError], `harvest failed and base recovery failed for task '${id}'`);
      }
      throw error;
    }
  });
}

export interface BaseCheckoutHealth {
  branchName: string | null;
  headCommit: string | null;
  clean: boolean;
  statusPorcelain: string;
  reasons: string[];
}

export async function baseCheckoutHealth({
  repoRoot,
  baseBranch,
  expectedHead,
  requiredAncestor,
}: {
  repoRoot: string;
  baseBranch: string;
  expectedHead?: string;
  requiredAncestor?: string;
}): Promise<BaseCheckoutHealth> {
  const root = await verifyRepositoryRoot(repoRoot);
  const base = validateBranchArgument(baseBranch, "base branch");
  const [branchName, headCommit, statusPorcelain] = await Promise.all([
    currentBranch(root),
    currentHead(root),
    repositoryStatus(root),
  ]);
  const reasons: string[] = [];
  if (branchName !== base) reasons.push(`base checkout is on '${branchName ?? "detached HEAD"}', not '${base}'`);
  if (statusPorcelain.length !== 0) reasons.push("base checkout is dirty");
  if (expectedHead !== undefined) {
    const expectedSha = await resolveCommit(root, expectedHead, "expected base HEAD");
    if (headCommit !== expectedSha) reasons.push(`base HEAD '${headCommit}' differs from expected '${expectedSha}'`);
  }
  if (requiredAncestor !== undefined) {
    const ancestorSha = await resolveCommit(root, requiredAncestor, "required base ancestor");
    try {
      await git(root, ["merge-base", "--is-ancestor", ancestorSha, headCommit]);
    } catch {
      reasons.push(`recorded task base commit '${ancestorSha}' is not an ancestor of base HEAD '${headCommit}'`);
    }
  }
  return { branchName, headCommit, clean: statusPorcelain.length === 0, statusPorcelain, reasons };
}

export interface RestoreBaseRepositorySpec {
  repoRoot: string;
  preCommit: string;
  baseBranch: string;
  requireClean?: boolean;
}

export interface RestoreBaseRepositoryResult {
  headCommit: string;
  clean: boolean;
}

export async function restoreBaseRepository({
  repoRoot,
  preCommit,
  baseBranch,
  requireClean = false,
}: RestoreBaseRepositorySpec): Promise<RestoreBaseRepositoryResult> {
  const root = await verifyRepositoryRoot(repoRoot);
  const base = validateBranchArgument(baseBranch, "base branch");
  const preSha = await resolveCommit(root, preCommit, "pre-harvest commit");
  const before = await baseCheckoutHealth({ repoRoot: root, baseBranch: base, expectedHead: preSha });
  if (before.branchName !== base || before.headCommit !== preSha) {
    throw new Error(`refusing unsafe base recovery: ${before.reasons.join("; ")}`);
  }
  if (requireClean && !before.clean) {
    throw new Error("refusing unsafe base recovery: checkout contains changes not proven to belong to the interrupted operation");
  }

  if (!before.clean) {
    await git(root, ["merge", "--abort"]).catch(() => undefined);
    await git(root, ["reset", "--hard", preSha]);
  }

  const headCommit = await currentHead(root);
  const status = await repositoryStatus(root);
  const clean = status.length === 0;
  if (headCommit !== preSha || !clean) {
    throw new Error(`base recovery verification failed: expected HEAD '${preSha}', found '${headCommit}', clean=${clean}`);
  }
  return { headCommit, clean };
}

export interface RegisteredWorktree {
  worktreePath: string;
  headCommit: string | null;
  branchName: string | null;
  bare: boolean;
  detached: boolean;
  locked: boolean;
  lockReason?: string;
  prunable: boolean;
  pruneReason?: string;
}

async function listRegisteredWorktreesFromRoot(root: string): Promise<RegisteredWorktree[]> {
  const output = (await runGit(root, ["worktree", "list", "--porcelain", "-z"], { trim: false })).stdout;
  const records = output.split("\0\0").filter(Boolean);
  return records.map((record) => {
    const fields = record.split("\0");
    const worktreeField = fields.shift();
    if (!worktreeField?.startsWith("worktree ")) throw new Error("invalid git worktree porcelain output");
    const worktreePath = worktreeField.slice("worktree ".length);
    const result: RegisteredWorktree = {
      worktreePath: path.normalize(worktreePath),
      headCommit: null,
      branchName: null,
      bare: false,
      detached: false,
      locked: false,
      prunable: false,
    };
    for (const field of fields) {
      if (field.startsWith("HEAD ")) result.headCommit = field.slice(5);
      else if (field.startsWith("branch ")) result.branchName = field.slice(7).replace(/^refs\/heads\//, "");
      else if (field === "bare") result.bare = true;
      else if (field === "detached") result.detached = true;
      else if (field === "locked" || field.startsWith("locked ")) {
        result.locked = true;
        if (field.length > 7) result.lockReason = field.slice(7);
      } else if (field === "prunable" || field.startsWith("prunable ")) {
        result.prunable = true;
        if (field.length > 9) result.pruneReason = field.slice(9);
      }
    }
    return result;
  });
}

export async function listRegisteredWorktrees(repoRoot: string): Promise<RegisteredWorktree[]> {
  return listRegisteredWorktreesFromRoot(await verifyRepositoryRoot(repoRoot));
}

function findRegisteredWorktree(
  worktrees: readonly RegisteredWorktree[],
  requestedPath: string,
  alternatePath?: string | null,
): RegisteredWorktree | undefined {
  return worktrees.find((entry) => {
    const registeredPath = path.normalize(path.resolve(entry.worktreePath));
    return registeredPath === requestedPath || (alternatePath != null && registeredPath === alternatePath);
  });
}

export interface WorktreeHealth {
  exists: boolean;
  registered: boolean;
  dirty: boolean;
  headCommit: string | null;
  branchName: string | null;
  reasons: string[];
}

export async function worktreeHealth({
  repoRoot,
  worktreePath,
  baseCommit,
  expectedBranch,
}: {
  repoRoot: string;
  worktreePath: string;
  baseCommit?: string;
  expectedBranch?: string;
}): Promise<WorktreeHealth> {
  const reasons: string[] = [];
  const root = await verifyRepositoryRoot(repoRoot);
  const requestedPath = path.resolve(worktreePath);
  const exists = await pathExists(requestedPath);
  let canonicalPath: string | null = null;
  if (exists) {
    try {
      canonicalPath = await canonicalExistingPath(requestedPath);
    } catch (error) {
      reasons.push(`worktree path cannot be resolved: ${failureText(error)}`);
    }
  } else {
    reasons.push("worktree path does not exist");
  }

  const registeredEntry = findRegisteredWorktree(
    await listRegisteredWorktreesFromRoot(root),
    requestedPath,
    canonicalPath,
  );
  const registered = registeredEntry !== undefined;
  if (!registered) reasons.push("worktree is not registered");
  if (registeredEntry?.prunable) reasons.push(`worktree registration is prunable${registeredEntry.pruneReason ? `: ${registeredEntry.pruneReason}` : ""}`);
  if (registeredEntry?.bare) reasons.push("registered worktree is bare");

  let dirty = false;
  let headCommit: string | null = registeredEntry?.headCommit ?? null;
  let branchName: string | null = registeredEntry?.branchName ?? null;
  if (canonicalPath !== null) {
    try {
      const status = await repositoryStatus(canonicalPath);
      dirty = status.length !== 0;
      if (dirty) reasons.push("worktree has uncommitted changes");
      headCommit = await currentHead(canonicalPath);
      branchName = await currentBranch(canonicalPath);
    } catch (error) {
      reasons.push(`worktree Git inspection failed: ${failureText(error)}`);
    }
  }
  if (expectedBranch !== undefined) {
    const expected = validateBranchArgument(expectedBranch, "expected worktree branch");
    if (branchName !== expected) reasons.push(`worktree branch '${branchName ?? "detached HEAD"}' differs from expected '${expected}'`);
  }

  if (baseCommit !== undefined && headCommit !== null) {
    try {
      const baseSha = await resolveCommit(root, baseCommit, "base commit");
      if (headCommit !== baseSha) reasons.push(`worktree HEAD '${headCommit}' differs from base commit '${baseSha}'`);
    } catch (error) {
      reasons.push(`base commit validation failed: ${failureText(error)}`);
    }
  }

  return { exists, registered, dirty, headCommit, branchName, reasons };
}

export interface RemoveTaskWorktreeResult {
  removedWorktree: boolean;
  removedBranch: boolean;
  errors: string[];
  // Compatibility aliases.
  removed?: boolean;
  branchDeleted?: boolean;
  cleanupErrors?: string[];
}

export async function removeTaskWorktree({
  repoRoot,
  worktreePath,
  branchName,
}: {
  repoRoot: string;
  worktreePath: string;
  branchName: string;
}): Promise<RemoveTaskWorktreeResult> {
  const cleanupErrors: string[] = [];
  const root = await verifyRepositoryRoot(repoRoot);
  taskIdFromBranchName(branchName);
  const requestedPath = path.normalize(path.resolve(worktreePath));
  const filesystemRoot = path.parse(requestedPath).root;
  if (requestedPath === filesystemRoot || requestedPath === root) {
    throw new Error(`refusing unsafe worktree cleanup path: ${requestedPath}`);
  }

  const registered = findRegisteredWorktree(
    await listRegisteredWorktreesFromRoot(root),
    requestedPath,
  );
  if (registered && registered.branchName !== branchName) {
    throw new Error(`worktree '${requestedPath}' is registered to '${registered.branchName ?? "detached HEAD"}', not '${branchName}'`);
  }

  const unregisteredPathExists = !registered && await pathExists(requestedPath);
  let removed = !registered && !unregisteredPathExists;
  if (registered) {
    try {
      await git(root, ["worktree", "remove", "--force", requestedPath]);
      removed = true;
    } catch (error) {
      cleanupErrors.push(`remove worktree: ${failureText(error)}`);
    }
  } else if (unregisteredPathExists) {
    cleanupErrors.push(`unregistered path was not deleted: ${requestedPath}`);
  }

  await git(root, ["worktree", "prune"]).catch((error) => {
    cleanupErrors.push(`prune worktrees: ${failureText(error)}`);
  });

  let branchDeleted = !(await referenceExists(root, `refs/heads/${branchName}`));
  if (!branchDeleted) {
    try {
      await git(root, ["branch", "-D", "--", branchName]);
      branchDeleted = true;
    } catch (error) {
      cleanupErrors.push(`delete branch '${branchName}': ${failureText(error)}`);
    }
  }

  return {
    removedWorktree: removed,
    removedBranch: branchDeleted,
    errors: cleanupErrors,
    removed,
    branchDeleted,
    cleanupErrors,
  };
}

// Compatibility exports for the original workspace API.
export interface WorktreeSpec {
  repoPath: string;
  workspaceId: string;
}

export interface WorktreeResult extends TaskWorktreeResult {
  baseBranch: string;
}

export async function createWorktree({ repoPath, workspaceId }: WorktreeSpec): Promise<WorktreeResult> {
  const inspection = await inspectRepository(repoPath);
  if (!inspection.isGit || !inspection.headCommit || !inspection.defaultBranch) {
    throw new Error(inspection.error || `repository '${repoPath}' has no usable HEAD/default branch`);
  }
  const result = await createTaskWorktree({
    repoRoot: inspection.rootPath,
    taskId: workspaceId,
    baseCommit: inspection.headCommit,
    worktreesDir: path.join(os.homedir(), ".agent-farm", "worktrees"),
  });
  return { ...result, baseBranch: inspection.defaultBranch };
}

export async function removeWorktree(repoPath: string, worktreePath: string, branchName: string): Promise<RemoveTaskWorktreeResult> {
  return removeTaskWorktree({ repoRoot: repoPath, worktreePath, branchName });
}

export async function getDiff(repoPath: string, baseBranch: string, branchName: string): Promise<string> {
  return git(repoPath, ["diff", "--binary", "--full-index", "--no-ext-diff", "--no-textconv", `${validateCommitish(baseBranch, "base branch")}...${validateCommitish(branchName, "branch")}`, "--"]);
}

export async function getDiffStat(repoPath: string, baseBranch: string, branchName: string): Promise<string> {
  return git(repoPath, ["diff", "--stat", `${validateCommitish(baseBranch, "base branch")}...${validateCommitish(branchName, "branch")}`, "--"]);
}

export interface MergeSpec {
  repoPath: string;
  baseBranch: string;
  branchName: string;
  worktreePath: string;
  commitMessage: string;
}

export async function mergeWorktree(spec: MergeSpec): Promise<{ commit: string }> {
  const taskId = taskIdFromBranchName(spec.branchName);
  const result = await harvestTaskBranch({
    repoRoot: spec.repoPath,
    baseBranch: spec.baseBranch,
    branchName: spec.branchName,
    taskId,
    title: spec.commitMessage,
  });
  await removeTaskWorktree({
    repoRoot: spec.repoPath,
    worktreePath: spec.worktreePath,
    branchName: spec.branchName,
  });
  return { commit: result.commit };
}
