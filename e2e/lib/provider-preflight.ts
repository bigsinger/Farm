import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export interface ProviderPreflight {
  schema_version: "agent-farm.provider-preflight.v1";
  checked_at: string;
  enabled: boolean;
  status: "ready" | "blocked";
  reason: string | null;
  settings_file: {
    path: string;
    exists: boolean;
    readable: boolean;
    valid_json: boolean;
  };
  credential_sources: {
    settings_env_key_present: boolean;
    process_env_key_present: boolean;
    endpoint_configured: boolean;
  };
  secrets_printed: false;
}

const CREDENTIAL_KEYS = ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"] as const;
const ENDPOINT_KEYS = ["ANTHROPIC_BASE_URL", "ANTHROPIC_BEDROCK_BASE_URL", "ANTHROPIC_VERTEX_BASE_URL"] as const;

function hasNonEmptyOwnString(object: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((key) => typeof object[key] === "string" && (object[key] as string).length > 0);
}

export async function providerPreflight(): Promise<ProviderPreflight> {
  const settingsPath = process.env.CLAUDE_SETTINGS_PATH || join(homedir(), ".claude", "settings.json");
  const enabled = process.env.AGENT_FARM_RUN_PROVIDER_E2E === "1";
  let exists = false;
  let readable = false;
  let validJson = false;
  let settingsEnv: Record<string, unknown> = {};
  try {
    await access(settingsPath, fsConstants.F_OK);
    exists = true;
    const text = await readFile(settingsPath, "utf8");
    readable = true;
    const parsed = JSON.parse(text) as unknown;
    validJson = Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed));
    if (validJson) {
      const root = parsed as Record<string, unknown>;
      if (root.env && typeof root.env === "object" && !Array.isArray(root.env)) {
        settingsEnv = root.env as Record<string, unknown>;
      }
    }
  } catch {
    // The result records only availability booleans; secret values and parse errors are never emitted.
  }

  const processEnv = process.env as Record<string, string | undefined>;
  const settingsCredential = hasNonEmptyOwnString(settingsEnv, CREDENTIAL_KEYS);
  const processCredential = CREDENTIAL_KEYS.some((key) => Boolean(processEnv[key]));
  const endpointConfigured = hasNonEmptyOwnString(settingsEnv, ENDPOINT_KEYS) || ENDPOINT_KEYS.some((key) => Boolean(processEnv[key]));

  let reason: string | null = null;
  if (!enabled) reason = "AGENT_FARM_RUN_PROVIDER_E2E is not set to 1";
  else if (!exists) reason = "Claude settings file does not exist";
  else if (!readable) reason = "Claude settings file is not readable";
  else if (!validJson) reason = "Claude settings file is not valid JSON";
  else if (!settingsCredential && !processCredential) reason = "No supported provider credential key is configured";

  return {
    schema_version: "agent-farm.provider-preflight.v1",
    checked_at: new Date().toISOString(),
    enabled,
    status: reason === null ? "ready" : "blocked",
    reason,
    settings_file: { path: settingsPath, exists, readable, valid_json: validJson },
    credential_sources: {
      settings_env_key_present: settingsCredential,
      process_env_key_present: processCredential,
      endpoint_configured: endpointConfigured,
    },
    secrets_printed: false,
  };
}

async function main(): Promise<void> {
  const result = await providerPreflight();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "ready" ? 0 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
