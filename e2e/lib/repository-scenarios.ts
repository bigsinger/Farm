import { createHash } from "node:crypto";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { git, sha256Bytes, type GitFixture } from "./harness.js";

export interface RepositoryScenarioProof {
  initialSha: string;
  remoteMainSha: string;
  fileDigests: Record<string, string>;
  paths: {
    exclusive: string;
    overlapParent: string;
    overlapChild: string;
    magnet: string;
    providerA: string;
    providerB: string;
    conflict: string;
    binary: string;
    symlink: string;
  };
}

export async function populateLifecycleRepository(fixture: GitFixture): Promise<RepositoryScenarioProof> {
  const textFiles: Record<string, string> = {
    "src/exclusive.ts": "export const exclusive = 'baseline';\n",
    "src/overlap/parent.ts": "export const parent = 'baseline';\n",
    "src/overlap/nested/child.ts": "export const child = 'baseline';\n",
    "src/magnets/shared-context.md": "shared semantic context\n",
    "src/provider/task-a.txt": "provider task A baseline\n",
    "src/provider/task-b.txt": "provider task B baseline\n",
    "src/conflict.txt": "common ancestor\n",
    "src/review-stale.txt": "review baseline\n",
    "src/rename-me.txt": "rename baseline\n",
    "src/delete-me.txt": "delete baseline\n",
    "empty/.keep": "keep\n",
  };
  const fileDigests: Record<string, string> = {};
  for (const [relativePath, content] of Object.entries(textFiles)) {
    const path = join(fixture.repository, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
    fileDigests[relativePath] = sha256Bytes(content);
  }
  const binaryPath = "assets/fixture.bin";
  const binary = Uint8Array.from(Array.from({ length: 8192 }, (_, index) => (index * 97 + 23) % 256));
  await mkdir(join(fixture.repository, "assets"), { recursive: true });
  await writeFile(join(fixture.repository, binaryPath), binary);
  fileDigests[binaryPath] = sha256Bytes(binary);

  const symlinkPath = "src/shared-link";
  if (process.platform !== "win32") {
    await symlink("magnets/shared-context.md", join(fixture.repository, symlinkPath));
    fileDigests[symlinkPath] = createHash("sha256").update("magnets/shared-context.md").digest("hex");
  }

  git(fixture.repository, "add", "--all");
  git(fixture.repository, "commit", "--quiet", "-m", "lifecycle scenario baseline");
  git(fixture.repository, "push", "--quiet", "origin", "main");
  fixture.initialSha = git(fixture.repository, "rev-parse", "HEAD");
  const remoteMainSha = git(fixture.repository, "rev-parse", "origin/main");
  if (remoteMainSha !== fixture.initialSha) throw new Error("Bare remote did not receive lifecycle scenario baseline");

  return {
    initialSha: fixture.initialSha,
    remoteMainSha,
    fileDigests,
    paths: {
      exclusive: "src/exclusive.ts",
      overlapParent: "src/overlap",
      overlapChild: "src/overlap/nested/child.ts",
      magnet: "src/magnets/shared-context.md",
      providerA: "src/provider/task-a.txt",
      providerB: "src/provider/task-b.txt",
      conflict: "src/conflict.txt",
      binary: binaryPath,
      symlink: symlinkPath,
    },
  };
}

export async function currentDigest(repository: string, relativePath: string): Promise<string> {
  const bytes = await readFile(join(repository, relativePath));
  return sha256Bytes(bytes);
}

export function actualCommitProof(repository: string): { head: string; tree: string; branch: string; status: string } {
  return {
    head: git(repository, "rev-parse", "HEAD"),
    tree: git(repository, "rev-parse", "HEAD^{tree}"),
    branch: git(repository, "branch", "--show-current"),
    status: git(repository, "status", "--porcelain=v2", "--untracked-files=all"),
  };
}
