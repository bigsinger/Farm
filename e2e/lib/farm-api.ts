import { ApiClient, ApiError, asObject, waitFor } from "./api.js";
import type { JsonObject } from "./harness.js";

const GIT_MUTATION_TIMEOUT_MS = Number(process.env.AGENT_FARM_E2E_GIT_MUTATION_TIMEOUT_MS ?? 120_000);

export interface TaskSummaryWire extends JsonObject {
  id: string;
  status: string;
  repository_id: string;
  title: string;
  prompt: string;
  repo_path: string | null;
  base_branch: string | null;
  base_commit: string | null;
  branch_name: string | null;
  worktree_path: string | null;
  dependency_ids: string[];
  blocking_reasons: string[];
  group_id: string | null;
  claims: JsonObject[];
  run: JsonObject | null;
  diff: JsonObject | null;
}

export interface TaskDetailWire extends JsonObject {
  task: TaskSummaryWire;
  repository: JsonObject | null;
  dependencies: JsonObject[];
  dependents: JsonObject[];
  claims: JsonObject[];
  overlaps: JsonObject[];
  runs: JsonObject[];
  artifacts: JsonObject[];
  reviews: JsonObject[];
  outcomes: JsonObject[];
  timeline: JsonObject[];
  group: JsonObject | null;
  eligibility: JsonObject;
  worktree_health: JsonObject | null;
  residual_health: JsonObject | null;
}

function requiredArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  return value;
}

export function decodeTaskDetail(value: unknown): TaskDetailWire {
  const root = asObject(value, "task detail");
  const task = asObject(root.task, "task detail.task") as TaskSummaryWire;
  for (const key of ["id", "status", "repository_id", "title", "prompt"] as const) {
    if (typeof task[key] !== "string" || task[key].length === 0) throw new TypeError(`task.${key} must be a non-empty string`);
  }
  for (const key of ["dependency_ids", "blocking_reasons"] as const) requiredArray(task[key], `task.${key}`);
  for (const key of ["dependencies", "dependents", "claims", "overlaps", "runs", "artifacts", "reviews", "outcomes", "timeline"] as const) {
    requiredArray(root[key], `task detail.${key}`);
  }
  if (!root.eligibility || typeof root.eligibility !== "object") throw new TypeError("task detail.eligibility is required");
  return root as unknown as TaskDetailWire;
}

export function errorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const body = asObject(error.body, "API error body");
  const envelope = body.error && typeof body.error === "object" && !Array.isArray(body.error)
    ? body.error as JsonObject
    : body;
  return typeof envelope.code === "string" ? envelope.code : null;
}

export async function expectApiError(
  operation: Promise<unknown>,
  status: number,
  code: string,
): Promise<ApiError> {
  try {
    await operation;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status !== status) throw new Error(`Expected HTTP ${status}, got ${error.status}: ${error.message}`);
    const actual = errorCode(error);
    if (actual !== code) throw new Error(`Expected API error ${code}, got ${actual}: ${JSON.stringify(error.body)}`);
    return error;
  }
  throw new Error(`Expected HTTP ${status} ${code}, but request succeeded`);
}

export class FarmApi {
  readonly http: ApiClient;

  constructor(baseUrl: string) {
    this.http = new ApiClient(baseUrl);
  }

  async seed(input: {
    repoPath: string;
    prompt: string;
    title?: string;
    dependencies?: string[];
    claims?: Array<{ path: string; mode: "exclusive" | "shared" }>;
    magnetPaths?: string[];
    autoStart?: boolean;
  }): Promise<TaskDetailWire> {
    const response = await this.http.request<unknown>("POST", "/api/tasks", {
      body: {
        repo_path: input.repoPath,
        prompt: input.prompt,
        ...(input.title ? { title: input.title } : {}),
        dependencies: input.dependencies ?? [],
        claims: input.claims ?? [],
        magnet_paths: input.magnetPaths ?? [],
        auto_start: input.autoStart ?? false,
      },
      expectedStatus: 201,
      timeoutMs: GIT_MUTATION_TIMEOUT_MS,
    });
    return decodeTaskDetail(response.body);
  }

  async task(id: string): Promise<TaskDetailWire> {
    return decodeTaskDetail((await this.http.get<unknown>(`/api/tasks/${encodeURIComponent(id)}`, 200)).body);
  }

  async list(): Promise<{ tasks: TaskSummaryWire[]; lastSeq: number; generatedAt: number }> {
    const root = asObject((await this.http.get<unknown>("/api/tasks", 200)).body, "task list");
    const tasks = requiredArray(root.tasks, "task list.tasks") as TaskSummaryWire[];
    if (!Number.isSafeInteger(root.last_seq) || (root.last_seq as number) < 0) throw new TypeError("task list.last_seq is invalid");
    if (!Number.isSafeInteger(root.generated_at) || (root.generated_at as number) < 0) throw new TypeError("task list.generated_at is invalid");
    return { tasks, lastSeq: root.last_seq as number, generatedAt: root.generated_at as number };
  }

  async waitForTask(id: string, predicate: (detail: TaskDetailWire) => boolean, description: string, timeoutMs = 30_000): Promise<TaskDetailWire> {
    return waitFor(description, () => this.task(id), predicate, { timeoutMs, intervalMs: 100 });
  }

  async events(afterSeq = 0): Promise<{ events: JsonObject[]; lastSeq: number }> {
    const root = asObject((await this.http.get<unknown>(`/api/events?after_seq=${afterSeq}`, 200)).body, "events response");
    const events = requiredArray(root.events, "events response.events").map((entry, index) => asObject(entry, `events[${index}]`));
    if (!Number.isSafeInteger(root.last_seq) || (root.last_seq as number) < 0) throw new TypeError("events.last_seq is invalid");
    return { events, lastSeq: root.last_seq as number };
  }
}
