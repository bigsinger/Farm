import path from "node:path";
import { badRequest } from "./errors.js";

export function requireString(value: unknown, field: string, options: { max?: number; allowEmpty?: boolean } = {}): string {
  if (typeof value !== "string") throw badRequest("invalid_request", `${field} must be a string.`, { field });
  const normalized = value.trim();
  if (!options.allowEmpty && !normalized) throw badRequest("invalid_request", `${field} is required.`, { field });
  const max = options.max ?? 100_000;
  if (normalized.length > max) {
    throw badRequest("invalid_request", `${field} exceeds ${max} characters.`, { field, max });
  }
  if (normalized.includes("\0")) throw badRequest("invalid_request", `${field} contains a NUL byte.`, { field });
  return normalized;
}

export function optionalString(value: unknown, field: string, max = 10_000): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireString(value, field, { max });
}

export function stringArray(value: unknown, field: string, maxItems = 1_000): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest("invalid_request", `${field} must be an array.`, { field });
  if (value.length > maxItems) throw badRequest("invalid_request", `${field} exceeds ${maxItems} items.`, { field, maxItems });
  const values = value.map((item, index) => requireString(item, `${field}[${index}]`, { max: 4_096 }));
  const unique = [...new Set(values)];
  if (unique.length !== values.length) throw badRequest("duplicate_value", `${field} contains duplicate values.`, { field });
  return unique;
}

export function normalizedRepoRelativePath(value: unknown, field = "path"): string {
  const input = requireString(value, field, { max: 4_096 });
  const slash = input.replaceAll("\\", "/").replace(/^\.\//, "");
  if (path.posix.isAbsolute(slash) || /^[A-Za-z]:\//.test(slash)) {
    throw badRequest("unsafe_path", `${field} must be relative to the repository.`, { field, path: input });
  }
  const normalized = path.posix.normalize(slash);
  if (
    normalized === "." ||
    normalized === "" ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized === ".git" ||
    normalized.startsWith(".git/")
  ) {
    throw badRequest("unsafe_path", `${field} escapes or targets repository metadata.`, { field, path: input });
  }
  return normalized;
}

export interface ClaimInput {
  path: string;
  mode: "exclusive" | "shared";
}

export function claimsInput(value: unknown): ClaimInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest("invalid_request", "claims must be an array.", { field: "claims" });
  if (value.length > 1_000) throw badRequest("invalid_request", "claims exceeds 1000 items.", { field: "claims" });
  const claims: ClaimInput[] = value.map((item, index): ClaimInput => {
    if (!item || typeof item !== "object") {
      throw badRequest("invalid_request", `claims[${index}] must be an object.`, { field: `claims[${index}]` });
    }
    const record = item as Record<string, unknown>;
    const claimPath = normalizedRepoRelativePath(record.path, `claims[${index}].path`);
    const mode = record.mode ?? "exclusive";
    if (mode !== "exclusive" && mode !== "shared") {
      throw badRequest("invalid_claim_mode", `claims[${index}].mode must be exclusive or shared.`, { mode });
    }
    return { path: claimPath, mode };
  });
  const keys = claims.map((claim) => claim.path);
  if (new Set(keys).size !== keys.length) {
    throw badRequest("duplicate_claim", "claims contains duplicate paths.");
  }
  return claims;
}

export function magnetPathsInput(value: unknown): string[] {
  const raw = stringArray(value, "magnet_paths", 1_000);
  const paths = raw.map((entry, index) => normalizedRepoRelativePath(entry, `magnet_paths[${index}]`));
  if (new Set(paths).size !== paths.length) throw badRequest("duplicate_magnet_path", "magnet_paths contains duplicates.");
  return paths;
}

export function nonNegativeInteger(value: unknown, field: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw badRequest("invalid_request", `${field} must be a non-negative safe integer.`, { field });
  }
  return value;
}

export function positiveNumber(value: unknown, field: string, fallback?: number): number | undefined {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw badRequest("invalid_request", `${field} must be a positive number.`, { field });
  }
  return value;
}

export function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}
