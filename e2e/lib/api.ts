import type { JsonObject } from "./harness.js";

export class ApiError extends Error {
  readonly status: number;
  readonly method: string;
  readonly url: string;
  readonly body: unknown;

  constructor(method: string, url: string, status: number, body: unknown) {
    super(`${method} ${url} returned HTTP ${status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    this.name = "ApiError";
    this.method = method;
    this.url = url;
    this.status = status;
    this.body = body;
  }
}

export interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  expectedStatus?: number | readonly number[];
}

export interface ApiResponse<T> {
  status: number;
  headers: Headers;
  body: T;
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!text) return null;
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw new Error(`Invalid JSON from ${response.url}: ${error instanceof Error ? error.message : String(error)}\n${text}`);
    }
  }
  return text;
}

export class ApiClient {
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async request<T = JsonObject>(method: string, path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    if (!path.startsWith("/api/")) throw new Error(`E2E API paths must use the /api prefix: ${path}`);
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        accept: "application/json",
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 30_000),
    });
    const body = await parseResponse(response);
    const expected = options.expectedStatus === undefined
      ? undefined
      : Array.isArray(options.expectedStatus)
        ? options.expectedStatus
        : [options.expectedStatus];
    if (expected ? !expected.includes(response.status) : !response.ok) {
      throw new ApiError(method, url, response.status, body);
    }
    return { status: response.status, headers: response.headers, body: body as T };
  }

  get<T = JsonObject>(path: string, expectedStatus?: number | readonly number[]): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path, { expectedStatus });
  }

  post<T = JsonObject>(path: string, body?: unknown, expectedStatus?: number | readonly number[]): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, { body, expectedStatus });
  }

  patch<T = JsonObject>(path: string, body?: unknown, expectedStatus?: number | readonly number[]): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", path, { body, expectedStatus });
  }

  delete<T = JsonObject>(path: string, body?: unknown, expectedStatus?: number | readonly number[]): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", path, { body, expectedStatus });
  }
}

export async function waitFor<T>(
  description: string,
  probe: () => Promise<T>,
  predicate: (value: T) => boolean,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 100;
  const deadline = Date.now() + timeoutMs;
  let lastValue: T | undefined;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      lastValue = await probe();
      if (predicate(lastValue)) return lastValue;
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  const detail = lastError instanceof Error
    ? lastError.stack ?? lastError.message
    : lastValue === undefined
      ? String(lastError ?? "no value")
      : JSON.stringify(lastValue);
  throw new Error(`Timed out waiting for ${description} after ${timeoutMs}ms. Last observation: ${detail}`);
}

export function asObject(value: unknown, context = "value"): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${context} must be an object, got ${JSON.stringify(value)}`);
  }
  return value as JsonObject;
}

export function requiredString(object: JsonObject, key: string): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${key} must be a non-empty string`);
  return value;
}

export function requiredNumber(object: JsonObject, key: string): number {
  const value = object[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${key} must be a finite number`);
  return value;
}
