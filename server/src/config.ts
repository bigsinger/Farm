import "./load-env.js";
import type { IncomingHttpHeaders } from "node:http";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errors.js";

function parsePort(value: string | undefined): number {
  const parsed = Number(value ?? 7878);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }
  return parsed;
}

export function isLoopbackHost(value: string): boolean {
  const normalized = value.trim().replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function canonicalHostname(value: string): string {
  const normalized = value.toLowerCase();
  return normalized === "[::1]" || normalized === "::1" ? "[::1]" : normalized;
}

function parseBrowserOrigin(raw: string): URL {
  let origin: URL;
  try {
    origin = new URL(raw);
  } catch {
    throw new Error(`AGENT_FARM_BROWSER_ORIGINS contains an invalid URL: ${raw}`);
  }
  if (
    (origin.protocol !== "http:" && origin.protocol !== "https:") ||
    !isLoopbackHost(origin.hostname) ||
    !origin.port ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error(
      `AGENT_FARM_BROWSER_ORIGINS entries must be absolute loopback HTTP(S) origins with an explicit port: ${raw}`,
    );
  }
  return origin;
}

export const PORT = parsePort(process.env.PORT);
export const HOST = process.env.HOST?.trim() || "127.0.0.1";
if (!isLoopbackHost(HOST)) {
  throw new Error(
    `HOST must be one of 127.0.0.1, localhost, or ::1; refusing non-loopback bind '${HOST}' before database initialization.`,
  );
}

const defaultBrowserOrigins = [
  `http://127.0.0.1:${PORT}`,
  `http://localhost:${PORT}`,
  `http://[::1]:${PORT}`,
];
const configuredOrigins = process.env.AGENT_FARM_BROWSER_ORIGINS
  ?.split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const browserOriginUrls = (configuredOrigins?.length ? configuredOrigins : defaultBrowserOrigins)
  .map(parseBrowserOrigin);
export const BROWSER_ORIGINS = new Set(browserOriginUrls.map((origin) => origin.origin));
const allowedHosts = new Set(
  browserOriginUrls.map((origin) => `${canonicalHostname(origin.hostname)}:${origin.port}`),
);

export type LocalBoundaryFailure = {
  status: 400 | 403;
  code: string;
  message: string;
};

function oneHeader(headers: IncomingHttpHeaders, name: keyof IncomingHttpHeaders): string | null {
  const value = headers[name];
  if (typeof value !== "string" || value.length === 0 || value.includes(",")) return null;
  return value;
}

function canonicalRequestHost(raw: string): string | null {
  if (/\s|[/\\@]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(`http://${raw}`);
  } catch {
    return null;
  }
  if (!url.port || !isLoopbackHost(url.hostname)) return null;
  const canonical = `${canonicalHostname(url.hostname)}:${url.port}`;
  return url.pathname === "/" && url.username === "" && url.password === "" ? canonical : null;
}

export function localRequestBoundary(headers: IncomingHttpHeaders): LocalBoundaryFailure | null {
  const rawHost = oneHeader(headers, "host");
  const host = rawHost ? canonicalRequestHost(rawHost) : null;
  if (!host || !allowedHosts.has(host)) {
    return {
      status: 400,
      code: "invalid_local_host",
      message: "HTTP Host must be an explicitly configured loopback origin with the expected port.",
    };
  }

  const originValue = headers.origin;
  if (originValue !== undefined) {
    const rawOrigin = oneHeader(headers, "origin");
    let origin: URL | null = null;
    try {
      origin = rawOrigin ? new URL(rawOrigin) : null;
    } catch {
      origin = null;
    }
    if (
      !origin ||
      (origin.protocol !== "http:" && origin.protocol !== "https:") ||
      !BROWSER_ORIGINS.has(origin.origin)
    ) {
      return {
        status: 403,
        code: "invalid_browser_origin",
        message: "Browser Origin must match an explicitly configured loopback origin.",
      };
    }
  }

  const fetchSite = oneHeader(headers, "sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "none") {
    return {
      status: 403,
      code: "cross_site_request_denied",
      message: "Cross-site browser requests are not accepted by the local control plane.",
    };
  }
  return null;
}

export function localBoundaryMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const failure = localRequestBoundary(req.headers);
  if (failure) {
    next(new AppError(failure.status, failure.code, failure.message));
    return;
  }
  next();
}
