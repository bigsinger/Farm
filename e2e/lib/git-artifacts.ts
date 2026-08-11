import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { git, run, sha256Bytes, type GitFixture } from "./harness.js";

export interface GitArtifactProof {
  head: string;
  statusPorcelainV2: string;
  stagedDiff: string;
  unstagedDiff: string;
  binaryPatch: string;
  digests: Record<string, string>;
  symlink: { path: string; target: string; mode: string };
}

export async function createTrackedBaseline(fixture: GitFixture): Promise<void> {
  const files: Record<string, string | Uint8Array> = {
    "claims/directory/alpha.txt": "alpha baseline\n",
    "claims/directory/nested/beta.txt": "beta baseline\n",
    "claims/magnets/shared.txt": "shared magnet baseline\n",
    "changes/staged.txt": "staged baseline\n",
    "changes/rename-source.txt": "rename baseline\n",
    "changes/delete.txt": "delete baseline\n",
    "changes/binary.bin": Uint8Array.from([0, 1, 2, 3, 255, 254, 128]),
    "changes/empty-target.txt": "unchanged\n",
  };
  for (const [relative, content] of Object.entries(files)) {
    const target = join(fixture.repository, relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  const link = join(fixture.repository, "changes", "tracked-link");
  try {
    await symlink("../README.md", link);
  } catch (error) {
    if (process.platform !== "win32") throw error;
  }
  git(fixture.repository, "add", "--all");
  git(fixture.repository, "commit", "--quiet", "-m", "tracked artifact baseline");
  git(fixture.repository, "push", "--quiet", "origin", "main");
  fixture.initialSha = git(fixture.repository, "rev-parse", "HEAD");
}

export async function createMixedWorkingTreeArtifacts(fixture: GitFixture): Promise<GitArtifactProof> {
  const repository = fixture.repository;
  await writeFile(join(repository, "changes", "untracked.txt"), "real untracked content\n");
  await writeFile(join(repository, "changes", "staged.txt"), "real staged content\n");
  git(repository, "add", "changes/staged.txt");
  await rename(join(repository, "changes", "rename-source.txt"), join(repository, "changes", "renamed.txt"));
  git(repository, "add", "--all", "changes/rename-source.txt", "changes/renamed.txt");
  await rm(join(repository, "changes", "delete.txt"));
  git(repository, "add", "changes/delete.txt");
  const binary = Uint8Array.from(Array.from({ length: 4096 }, (_, index) => (index * 37 + 11) % 256));
  await writeFile(join(repository, "changes", "binary.bin"), binary);
  git(repository, "add", "changes/binary.bin");
  const link = join(repository, "changes", "untracked-link");
  try {
    await symlink("untracked.txt", link);
  } catch (error) {
    if (process.platform !== "win32") throw error;
  }
  await writeFile(join(repository, "claims", "directory", "nested", "beta.txt"), "real unstaged nested edit\n");

  const statusPorcelainV2 = git(repository, "status", "--porcelain=v2", "--untracked-files=all");
  const stagedDiff = git(repository, "diff", "--cached", "--find-renames", "--binary");
  const unstagedDiff = git(repository, "diff", "--find-renames", "--binary");
  const binaryPatch = git(repository, "diff", "--cached", "--binary", "--", "changes/binary.bin");
  const symlinkInfo = await lstat(link);
  const target = run("readlink", [link]);
  const digests: Record<string, string> = {
    untracked: sha256Bytes(await readFile(join(repository, "changes", "untracked.txt"))),
    staged: sha256Bytes(await readFile(join(repository, "changes", "staged.txt"))),
    renamed: sha256Bytes(await readFile(join(repository, "changes", "renamed.txt"))),
    binary: sha256Bytes(binary),
    symlink_target: createHash("sha256").update(target).digest("hex"),
    status: sha256Bytes(statusPorcelainV2),
    staged_diff: sha256Bytes(stagedDiff),
    unstaged_diff: sha256Bytes(unstagedDiff),
  };
  return {
    head: git(repository, "rev-parse", "HEAD"),
    statusPorcelainV2,
    stagedDiff,
    unstagedDiff,
    binaryPatch,
    digests,
    symlink: {
      path: "changes/untracked-link",
      target,
      mode: (symlinkInfo.mode & 0o777777).toString(8),
    },
  };
}

export async function commitWorktreeChange(
  worktree: string,
  relativePath: string,
  content: string | Uint8Array,
  message: string,
): Promise<string> {
  if (relativePath.startsWith("/") || relativePath.split("/").includes("..")) throw new Error(`Unsafe path: ${relativePath}`);
  const target = join(worktree, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
  git(worktree, "add", "--all");
  git(worktree, "commit", "--quiet", "-m", message);
  return git(worktree, "rev-parse", "HEAD");
}

export async function createConflictingBaseAndWorktree(
  fixture: GitFixture,
  worktree: string,
  relativePath: string,
): Promise<{ baseSha: string; worktreeSha: string }> {
  const baseTarget = join(fixture.repository, relativePath);
  const worktreeTarget = join(worktree, relativePath);
  await Promise.all([mkdir(dirname(baseTarget), { recursive: true }), mkdir(dirname(worktreeTarget), { recursive: true })]);
  await writeFile(baseTarget, "base side conflict\n");
  git(fixture.repository, "add", "--all");
  git(fixture.repository, "commit", "--quiet", "-m", "base-side conflict");
  const baseSha = git(fixture.repository, "rev-parse", "HEAD");
  await writeFile(worktreeTarget, "task side conflict\n");
  git(worktree, "add", "--all");
  git(worktree, "commit", "--quiet", "-m", "task-side conflict");
  const worktreeSha = git(worktree, "rev-parse", "HEAD");
  return { baseSha, worktreeSha };
}

export function assertRepositoryClean(repository: string): void {
  const status = git(repository, "status", "--porcelain=v2", "--untracked-files=all");
  if (status !== "") throw new Error(`Repository is not clean:\n${status}`);
  const mergeHead = spawnSync("git", ["-C", repository, "rev-parse", "--verify", "-q", "MERGE_HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (mergeHead.status === 0) throw new Error(`Repository still has MERGE_HEAD ${mergeHead.stdout.trim()}`);
  if (mergeHead.status !== 1) throw new Error(`Failed to inspect MERGE_HEAD: ${mergeHead.stderr.trim()}`);
}

export async function makeExecutable(path: string): Promise<void> {
  await chmod(path, 0o755);
}
