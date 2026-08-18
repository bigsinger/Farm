import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(moduleDir, "../.env");

const SETTINGS_PROVIDER_ENV = /^(?:ANTHROPIC_|CLAUDE_CODE_USE_|AWS_|GOOGLE_|CLOUD_ML_|AZURE_|HTTP_PROXY$|HTTPS_PROXY$|NO_PROXY$|SSL_CERT_FILE$|NODE_EXTRA_CA_CERTS$)/i;

export function userSettingEnvAllowed(key: string): boolean {
  return SETTINGS_PROVIDER_ENV.test(key);
}

if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

if (process.env.AGENT_FARM_DISABLE_USER_SETTINGS !== "1") {
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as { env?: Record<string, unknown> };
      if (settings.env && typeof settings.env === "object") {
        for (const [key, value] of Object.entries(settings.env)) {
          if (
            userSettingEnvAllowed(key) &&
            typeof value === "string" &&
            !(key in process.env)
          ) {
            process.env[key] = value;
          }
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
