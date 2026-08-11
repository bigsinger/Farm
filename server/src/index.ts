import "./load-env.js";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import express, { type Request, type Response } from "express";
import { cancelAllAgentRuns, providerKind } from "./agent.js";
import { closeDatabase, DB_PATH } from "./db.js";
import {
  activeBackgroundRuns,
  reconcileOnStartup,
  scheduleReadyTasks,
  waitForBackgroundRuns,
} from "./domain.js";
import {
  asyncRoute,
  errorMiddleware,
  requestIdMiddleware,
  serviceUnavailable,
} from "./errors.js";
import { lastEventSeq } from "./ledger.js";
import {
  addClaimHandler,
  addDependencyHandler,
  cancelRunHandler,
  createTaskHandler,
  eventsHandler,
  generateResidualHandler,
  getDiffHandler,
  getTaskHandler,
  harvestHandler,
  latestResidualHandler,
  listTasksHandler,
  recoverRunHandler,
  releaseClaimHandler,
  removeDependencyHandler,
  resolveOverlapHandler,
  retryRunHandler,
  reviewHandler,
  startRunHandler,
  wiltHandler,
} from "./workspaces.js";
import { attachWs, closeWs } from "./ws.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(moduleDir, "../..");
const webDist = path.join(repositoryRoot, "web-app", "dist");
const assetRoot = path.join(repositoryRoot, "FarmCreator", "assets");

const port = Number(process.env.PORT ?? 7878);
const host = process.env.HOST?.trim() || "127.0.0.1";
if (!Number.isSafeInteger(port) || port <= 0 || port > 65_535) throw new Error("PORT must be an integer from 1 to 65535.");

function isLoopbackHost(value: string): boolean {
  const normalized = value.trim().replace(/^\[|\]$/g, "").toLowerCase();
  if (normalized === "localhost" || normalized === "::1") return true;
  const octets = normalized.split(".");
  return octets.length === 4 && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255) && Number(octets[0]) === 127;
}

const servesLocalAssets = isLoopbackHost(host) && fs.existsSync(assetRoot);

const app = express();
app.disable("x-powered-by");
app.use(requestIdMiddleware);
app.use(express.json({ limit: process.env.AGENT_FARM_JSON_LIMIT ?? "2mb", strict: true }));
app.use((_req, res, next) => {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("cross-origin-resource-policy", "same-origin");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    ledger_last_seq: lastEventSeq(),
    active_runs: activeBackgroundRuns(),
    provider: providerKind(),
    database: path.basename(DB_PATH),
  });
});
app.get("/health", (_req, res) => {
  res.setHeader("deprecation", "true");
  res.json({ ok: true, ledger_last_seq: lastEventSeq() });
});

app.get("/api/tasks", asyncRoute(listTasksHandler));
app.post("/api/tasks", asyncRoute(createTaskHandler));
app.get("/api/tasks/:id", asyncRoute(getTaskHandler));
app.get("/api/tasks/:id/diff", asyncRoute(getDiffHandler));
app.post("/api/tasks/:id/dependencies", asyncRoute(addDependencyHandler));
app.post("/api/tasks/:id/dependencies/:dependencyId", asyncRoute(addDependencyHandler));
app.delete("/api/tasks/:id/dependencies/:dependencyId", asyncRoute(removeDependencyHandler));
app.delete("/api/tasks/:id/dependencies", asyncRoute(removeDependencyHandler));
app.post("/api/tasks/:id/claims", asyncRoute(addClaimHandler));
app.post("/api/tasks/:id/claims/:claimId/release", asyncRoute(releaseClaimHandler));
app.post("/api/tasks/:id/claims/:claimId", asyncRoute(releaseClaimHandler));
app.post("/api/tasks/:id/overlaps/:overlapId/resolve", asyncRoute(resolveOverlapHandler));
app.post("/api/tasks/:id/runs", asyncRoute(startRunHandler));
app.post("/api/tasks/:id/runs/start", asyncRoute(startRunHandler));
app.post("/api/tasks/:id/runs/retry", asyncRoute(retryRunHandler));
app.post("/api/tasks/:id/runs/:runId/retry", asyncRoute(retryRunHandler));
app.post("/api/tasks/:id/runs/recover", asyncRoute(recoverRunHandler));
app.post("/api/tasks/:id/runs/:runId/recover", asyncRoute(recoverRunHandler));
app.post("/api/tasks/:id/runs/cancel", asyncRoute(cancelRunHandler));
app.post("/api/tasks/:id/runs/:runId/cancel", asyncRoute(cancelRunHandler));
app.post("/api/tasks/:id/reviews", asyncRoute(reviewHandler));
app.post("/api/tasks/:id/reviews/:decision", asyncRoute(reviewHandler));
app.post("/api/tasks/:id/harvest", asyncRoute(harvestHandler));
app.delete("/api/tasks/:id", asyncRoute(wiltHandler));
app.delete("/api/tasks/:id/wilt", asyncRoute(wiltHandler));
app.get("/api/events", asyncRoute(eventsHandler));
app.get("/api/benchmarks/residual/latest", asyncRoute(latestResidualHandler));
app.post("/api/benchmarks/residual", asyncRoute(generateResidualHandler));

function deprecate(req: Request, res: Response, next: express.NextFunction): void {
  res.setHeader("deprecation", "true");
  res.setHeader("link", "</api/tasks>; rel=successor-version");
  next();
}
app.get("/workspaces", deprecate, asyncRoute(listTasksHandler));
app.post("/workspaces", deprecate, asyncRoute(createTaskHandler));
app.get("/workspaces/:id", deprecate, asyncRoute(getTaskHandler));
app.get("/workspaces/:id/diff", deprecate, asyncRoute(getDiffHandler));
app.post("/workspaces/:id/merge", deprecate, asyncRoute(harvestHandler));
app.delete("/workspaces/:id", deprecate, asyncRoute(wiltHandler));

if (servesLocalAssets) {
  app.use("/assets", express.static(assetRoot, { fallthrough: false, immutable: true, maxAge: "1h" }));
}

if (fs.existsSync(path.join(webDist, "index.html"))) {
  app.use("/web", express.static(webDist, { index: false, fallthrough: true }));
  app.get(["/", "/web", "/web/", "/web/*"], (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
} else {
  const unavailable = (_req: Request, _res: Response) => {
    throw serviceUnavailable(
      "web_build_missing",
      "The React application build is unavailable; API and health endpoints remain operational.",
      { expected_path: path.relative(repositoryRoot, path.join(webDist, "index.html")) },
    );
  };
  app.get(["/", "/web", "/web/", "/web/*"], unavailable);
}

app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: "route_not_found",
      message: "The requested endpoint does not exist.",
      request_id: res.locals.requestId,
    },
  });
});
app.use(errorMiddleware);

const httpServer = createServer(app);
attachWs(httpServer);
let stopping = false;

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`Stopping Agent Farm after ${signal}.`);
  await cancelAllAgentRuns();
  await waitForBackgroundRuns(10_000);
  await closeWs();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  closeDatabase();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal).then(() => process.exit(0)).catch((error) => {
      console.error("Graceful shutdown failed.", error);
      process.exit(1);
    });
  });
}

async function start(): Promise<void> {
  const reconciliation = await reconcileOnStartup();
  await scheduleReadyTasks();
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });
  console.log(`Agent Farm listening on http://${host}:${port}; ledger seq=${lastEventSeq()}; reconciled=${reconciliation.reconciled}; recovery_required=${reconciliation.recovery_required}.`);
  console.log(`Provider: ${providerKind() ?? "not configured"}.`);
  if (fs.existsSync(assetRoot) && !servesLocalAssets) {
    console.log("Local project art assets are not served on non-loopback bindings.");
  }
}

void start().catch(async (error) => {
  console.error("Agent Farm failed to start.", error);
  await closeWs().catch(() => undefined);
  closeDatabase();
  process.exitCode = 1;
});
