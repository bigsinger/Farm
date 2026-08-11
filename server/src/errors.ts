import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(code: string, message: string, details?: unknown): AppError {
  return new AppError(400, code, message, details);
}

export function notFound(code: string, message: string, details?: unknown): AppError {
  return new AppError(404, code, message, details);
}

export function conflict(code: string, message: string, details?: unknown): AppError {
  return new AppError(409, code, message, details);
}

export function serviceUnavailable(code: string, message: string, details?: unknown): AppError {
  return new AppError(503, code, message, details);
}

export function requestId(req: Request): string {
  const existing = req.header("x-request-id")?.trim();
  return existing && existing.length <= 128 ? existing : crypto.randomUUID();
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = requestId(req);
  res.locals.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}

export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

interface HttpParserError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

function parserError(error: unknown): { status: number; code: string; message: string } | null {
  if (!(error instanceof Error)) return null;
  const candidate = error as HttpParserError;
  const status = candidate.status ?? candidate.statusCode;
  if (candidate.type === "entity.parse.failed" && status === 400) {
    return { status: 400, code: "invalid_json", message: "The request body is not valid JSON." };
  }
  if (candidate.type === "entity.too.large" && status === 413) {
    return { status: 413, code: "request_body_too_large", message: "The request body exceeds the configured size limit." };
  }
  return null;
}

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const id = typeof res.locals.requestId === "string" ? res.locals.requestId : crypto.randomUUID();
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
        request_id: id,
      },
    });
    return;
  }

  const parsed = parserError(error);
  if (parsed) {
    res.status(parsed.status).json({
      error: {
        code: parsed.code,
        message: parsed.message,
        request_id: id,
      },
    });
    return;
  }

  console.error(`[request ${id}]`, error);
  res.status(500).json({
    error: {
      code: "internal_error",
      message: "The request failed unexpectedly. Use request_id to inspect server logs.",
      request_id: id,
    },
  });
}
