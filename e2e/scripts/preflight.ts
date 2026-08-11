import { chromium } from "@playwright/test";
import { access, mkdir, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { providerPreflight } from "../lib/provider-preflight.js";
import { REPOSITORY_ROOT, TEST_RESULTS_ROOT } from "../lib/harness.js";

async function executable(command: string, args: string[] = ["--version"]): Promise<boolean> {
  const { spawn } = await import("node:child_process");
  return await new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const provider = await providerPreflight();
  const chromiumPath = chromium.executablePath();
  const checks = {
    schema_version: "agent-farm.e2e-preflight.v1",
    checked_at: new Date().toISOString(),
    local: {
      node: process.version,
      git: await executable("git"),
      sqlite3: await executable("sqlite3"),
      pnpm: await executable("pnpm"),
      server_package: await exists(join(REPOSITORY_ROOT, "server", "package.json")),
      web_app_package: await exists(join(REPOSITORY_ROOT, "web-app", "package.json")),
      chromium: await exists(chromiumPath),
    },
    provider,
  };
  const localReady = Object.entries(checks.local)
    .filter(([key]) => key !== "node")
    .every(([, value]) => value === true);
  const result = { ...checks, status: localReady ? "ready" as const : "blocked" as const };
  await mkdir(TEST_RESULTS_ROOT, { recursive: true });
  await writeFile(join(TEST_RESULTS_ROOT, "preflight.json"), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = localReady ? 0 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
