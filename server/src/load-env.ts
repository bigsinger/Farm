import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(moduleDir, "../.env");

if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

if (process.env.AGENT_FARM_DISABLE_USER_SETTINGS !== "1") {
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as { env?: Record<string, unknown> };
      if (settings.env && typeof settings.env === "object") {
        for (const [key, value] of Object.entries(settings.env)) {
          if (typeof value === "string" && !(key in process.env)) process.env[key] = value;
        }
      }
    } catch (error) {
      console.warn(
        "Claude settings could not be loaded; provider preflight will report the resulting state.",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
