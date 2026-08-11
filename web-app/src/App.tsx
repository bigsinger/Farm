import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "./api";
import type {
  LedgerEvent,
  ResidualHealth,
  TaskDetail,
  TaskSnapshot,
  TaskSummary,
  WsState,
} from "./api";
import {
  ErrorNotice,
  LiveRegion,
  StatusPill,
  cx,
  formatCount,
  formatMoney,
  formatRelativeTime,
  formatTimestamp,
  safeStorageGet,
  safeStorageSet,
  shortId,
  statusLabel,
} from "./components";
import { ImpactView } from "./ImpactView";
import { QueueView } from "./QueueView";
import type { QueueFilter } from "./QueueView";
import { ResidualHealthPanel } from "./ResidualHealthPanel";
import { SeedDialog } from "./SeedDialog";
import { TaskInspector } from "./TaskInspector";

type AppView = "queue" | "impact" | "residual";
type SyncTone = "neutral" | "working" | "good" | "warning" | "critical";

interface StreamNotice {
  tone: SyncTone;
  title: string;
  message: string;
}

const LAST_SEQ_KEY = "agent-farm.ledger.last-seq";
const SERVER_ID_KEY = "agent-farm.ws.server-id";
const LEDGER_ID_KEY = "agent-farm.ws.ledger-id";

function storedNonNegativeInteger(key: string): number {
  const value = Number(safeStorageGet(key));
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function jitter(max = 650): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] % (max + 1);
  }
  return Math.floor(Math.random() * (max + 1));
}

function mergeTask(tasks: TaskSummary[], task: TaskSummary): TaskSummary[] {
  return [task, ...tasks.filter((current) => current.id !== task.id)];
}

export function App() {
  const [view, setView] = useState<AppView>("queue");
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [hasTaskSnapshot, setHasTaskSnapshot] = useState(false);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [query, setQuery] = useState("");
  const [seedOpen, setSeedOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wsState, setWsState] = useState<WsState>("connecting");
  const [lastSeq, setLastSeq] = useState(() => storedNonNegativeInteger(LAST_SEQ_KEY));
  const [streamNotice, setStreamNotice] = useState<StreamNotice>(() => ({
    tone: "working",
    title: storedNonNegativeInteger(LAST_SEQ_KEY) > 0 ? "等待 replay" : "连接 ledger stream",
    message: storedNonNegativeInteger(LAST_SEQ_KEY) > 0
      ? `将从持久化 last seq ${storedNonNegativeInteger(LAST_SEQ_KEY)} 之后开始回放。`
      : "首次连接将等待 hello、replay、ready，再进入 live。",
  }));
  const [recentEvents, setRecentEvents] = useState<LedgerEvent[]>([]);
  const [liveMessage, setLiveMessage] = useState("");
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const [impactDetails, setImpactDetails] = useState<Map<string, TaskDetail>>(new Map());
  const [impactErrors, setImpactErrors] = useState<Map<string, unknown>>(new Map());
  const [impactLoading, setImpactLoading] = useState(false);
  const [residual, setResidual] = useState<ResidualHealth | null>(null);
  const [residualLoading, setResidualLoading] = useState(true);
  const [residualRunning, setResidualRunning] = useState(false);
  const [residualError, setResidualError] = useState<unknown>(null);

  const lastSeqRef = useRef(lastSeq);
  const wsStateRef = useRef<WsState>(wsState);
  const tasksRef = useRef(tasks);
  const refreshTimerRef = useRef<number | null>(null);
  const impactControllerRef = useRef<AbortController | null>(null);
  const resyncPromiseRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { wsStateRef.current = wsState; }, [wsState]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const updateLastSeq = useCallback((value: number) => {
    if (!Number.isInteger(value) || value < 0) return;
    lastSeqRef.current = value;
    safeStorageSet(LAST_SEQ_KEY, String(value));
    if (mountedRef.current) setLastSeq(value);
  }, []);

  const updateWsState = useCallback((value: WsState) => {
    wsStateRef.current = value;
    if (mountedRef.current) setWsState(value);
  }, []);

  const applySnapshot = useCallback((snapshot: TaskSnapshot) => {
    setTasks(snapshot.tasks);
    setHasTaskSnapshot(true);
    setSnapshotAt(snapshot.generatedAt);
    if (snapshot.residualHealth) setResidual(snapshot.residualHealth);
    setSelectedId((current) => current && !snapshot.tasks.some((task) => task.id === current) ? null : current);
  }, []);

  const refreshTasks = useCallback(async (options: { quiet?: boolean; signal?: AbortSignal } = {}) => {
    if (!options.quiet) setLoading(true);
    setLoadError(null);
    try {
      const snapshot = await api.listTasks(options.signal);
      if (options.signal?.aborted) return snapshot;
      applySnapshot(snapshot);
      return snapshot;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setLoadError(error);
      throw error;
    } finally {
      if (!options.quiet && !options.signal?.aborted) setLoading(false);
    }
  }, [applySnapshot]);

  const loadResidual = useCallback(async (options: { quiet?: boolean; signal?: AbortSignal } = {}) => {
    if (!options.quiet) setResidualLoading(true);
    setResidualError(null);
    try {
      const artifact = await api.getResidualHealth(options.signal);
      if (!options.signal?.aborted) setResidual(artifact);
      return artifact;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setResidualError(error);
      throw error;
    } finally {
      if (!options.quiet && !options.signal?.aborted) setResidualLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      refreshTasks({ signal: controller.signal }),
      loadResidual({ signal: controller.signal }),
    ]);
    return () => controller.abort();
  }, [loadResidual, refreshTasks]);

  const recordEvents = useCallback((events: LedgerEvent[]) => {
    if (!events.length) return;
    setRecentEvents((current) => {
      const merged = new Map(current.map((event) => [event.seq, event]));
      events.forEach((event) => merged.set(event.seq, event));
      return Array.from(merged.values()).sort((a, b) => b.seq - a.seq).slice(0, 24);
    });
    const latest = events.at(-1)!;
    setLiveMessage(`Ledger seq ${latest.seq}：${statusLabel(latest.type)}${latest.taskId ? `，task ${shortId(latest.taskId)}` : ""}`);
  }, []);

  const scheduleProjectionRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshTasks({ quiet: true }).catch(() => undefined);
    }, 180);
  }, [refreshTasks]);

  useEffect(() => () => {
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
  }, []);

  const restResync = useCallback((reason: string): Promise<void> => {
    if (resyncPromiseRef.current) return resyncPromiseRef.current;
    const promise = (async () => {
      updateWsState("replaying");
      setStreamNotice({
        tone: "warning",
        title: "自动 REST resync",
        message: `${reason}。正在对比 GET /api/events 与 /api/tasks 快照；期间不把 stream 标为 live。`,
      });
      const startingSeq = lastSeqRef.current;
      try {
        applySnapshot(await api.listTasks());
      } catch (error) {
        setLoadError(error);
        setStreamNotice({
          tone: "critical",
          title: "REST resync 失败",
          message: "无法取得 /api/tasks 快照。保留现有投影并继续指数退避重连；请检查服务与 structured error。",
        });
        throw error;
      }

      let cursor = startingSeq;
      while (true) {
        let page: api.EventPage;
        try {
          page = await api.getEventPage(cursor);
        } catch (error) {
          if (error instanceof api.ApiError && error.code === "event_cursor_ahead" && cursor !== 0) {
            updateLastSeq(0);
            setRecentEvents([]);
            cursor = 0;
            continue;
          }
          throw error;
        }
        const result = api.acceptsLedgerEvents(cursor, page.events);
        if (result.gapAt !== null || result.lastSeq !== page.lastSeq) {
          throw new api.ProtocolError(
            `REST event page 不连续：cursor ${cursor}，page last seq ${page.lastSeq}，gap ${result.gapAt ?? "none"}`,
            page,
          );
        }
        recordEvents(result.accepted);
        cursor = result.lastSeq;
        // Persist only a cursor whose preceding events were accepted one by one.
        updateLastSeq(cursor);
        if (!page.hasMore) {
          if (cursor !== page.ledgerLastSeq) {
            throw new api.ProtocolError(
              `REST event pagination ended at ${cursor} before ledger head ${page.ledgerLastSeq}`,
              page,
            );
          }
          break;
        }
        if (page.events.length === 0) {
          throw new api.ProtocolError("REST event pagination cannot advance an empty page", page);
        }
      }

      const finalSnapshot = await api.listTasks();
      if (finalSnapshot.lastSeq === null || finalSnapshot.lastSeq !== cursor) {
        throw new api.ProtocolError(
          `REST resync 最终 task snapshot seq ${finalSnapshot.lastSeq ?? "missing"} 与已接受 cursor ${cursor} 不一致`,
          finalSnapshot,
        );
      }
      applySnapshot(finalSnapshot);
      setStreamNotice({
        tone: "good",
        title: "REST resync 已完成",
        message: `所有 event 已连续接受到 last seq ${lastSeqRef.current}，并已应用 catch-up 后的最终任务快照。`,
      });
    })().finally(() => {
      resyncPromiseRef.current = null;
      if (mountedRef.current) setReconnectVersion((current) => current + 1);
    });
    resyncPromiseRef.current = promise;
    return promise;
  }, [applySnapshot, recordEvents, updateLastSeq, updateWsState]);

  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | null = null;
    let attempt = 0;
    let replayedCount = 0;

    const scheduleReconnect = () => {
      if (stopped) return;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)) + jitter();
      attempt += 1;
      updateWsState("disconnected");
      setStreamNotice({
        tone: "warning",
        title: "Ledger stream 已断开",
        message: `${Math.ceil(delay / 100) / 10}s 后重连；REST 操作仍会立即更新投影。last seq ${lastSeqRef.current}。`,
      });
      retryTimer = window.setTimeout(connect, delay);
    };

    const failProtocol = (reason: string) => {
      if (stopped) return;
      socket?.close(4002, "protocol resync");
      void restResync(reason).catch(() => undefined);
    };

    const accept = (events: LedgerEvent[], source: "replay" | "live") => {
      const result = api.acceptsLedgerEvents(lastSeqRef.current, events);
      if (result.accepted.length) {
        recordEvents(result.accepted);
        updateLastSeq(result.lastSeq);
        scheduleProjectionRefresh();
        if (source === "replay") replayedCount += result.accepted.length;
      }
      if (result.gapAt !== null) {
        failProtocol(`检测到全局 seq gap：期望 ${result.lastSeq + 1}，收到 ${result.gapAt}`);
        return false;
      }
      return true;
    };

    const handleEnvelope = (envelope: api.WsEnvelope) => {
      if (envelope.kind === "hello") {
        if (!envelope.ledgerId) {
          failProtocol("hello 缺少持久 ledger id，不能安全复用本地 cursor");
          return;
        }
        const previousServer = safeStorageGet(SERVER_ID_KEY);
        const previousLedger = safeStorageGet(LEDGER_ID_KEY);
        const serverChanged = Boolean(previousServer && envelope.serverId && previousServer !== envelope.serverId);
        // A cursor without a stored ledger binding predates durable ledger identity
        // and is unsafe to reuse just like an explicitly changed identity.
        const ledgerChanged = api.ledgerCursorRequiresReset(previousLedger, envelope.ledgerId, lastSeqRef.current);
        if (envelope.serverId) safeStorageSet(SERVER_ID_KEY, envelope.serverId);
        safeStorageSet(LEDGER_ID_KEY, envelope.ledgerId);
        const restarted = envelope.restarted === true || serverChanged || ledgerChanged;
        updateWsState("replaying");
        if (ledgerChanged) {
          updateLastSeq(0);
          setRecentEvents([]);
          failProtocol("ledger id 已变化；旧 ledger 的持久化 cursor/事件尾已丢弃并要求从 seq 0 完整 REST resync");
          return;
        }
        setStreamNotice({
          tone: restarted ? "warning" : "working",
          title: restarted ? "服务重启 / ledger 身份变化" : "Hello 已校验",
          message: restarted
            ? `服务器身份已变化；正在从持久化 last seq ${lastSeqRef.current} 请求 replay，随后等待 ready。`
            : `连接已建立；从 last seq ${lastSeqRef.current} 回放，ready 之前不会标为 live。`,
        });
        if (envelope.lastSeq !== null && envelope.lastSeq < lastSeqRef.current) {
          updateLastSeq(0);
          failProtocol(`服务器 last seq ${envelope.lastSeq} 小于本地持久化 seq，按 ledger reset 处理`);
        }
        return;
      }
      if (envelope.kind === "replay") {
        updateWsState("replaying");
        setStreamNotice({
          tone: "working",
          title: "Ledger replay 进行中",
          message: `正在按全局 seq 应用 ${envelope.events.length} 个 replay event；当前 last seq ${lastSeqRef.current}。`,
        });
        accept(envelope.events, "replay");
        return;
      }
      if (envelope.kind === "ready") {
        if (envelope.lastSeq !== null && envelope.lastSeq > lastSeqRef.current) {
          failProtocol(`ready 宣告 last seq ${envelope.lastSeq}，客户端仅到 ${lastSeqRef.current}`);
          return;
        }
        attempt = 0;
        updateWsState("live");
        setStreamNotice({
          tone: "good",
          title: replayedCount > 0 ? "Replay 完成，已进入 live" : "Ledger stream live",
          message: replayedCount > 0
            ? `服务重连后回放 ${replayedCount} 个 event；last seq ${lastSeqRef.current}，现已 ready。`
            : `hello/replay/ready 握手完成；last seq ${lastSeqRef.current}。`,
        });
        return;
      }
      if (envelope.kind === "live") {
        if (wsStateRef.current !== "live") {
          failProtocol(`ready 之前收到 live seq ${envelope.event.seq}`);
          return;
        }
        accept([envelope.event], "live");
      }
    };

    const connect = () => {
      if (stopped) return;
      updateWsState("connecting");
      setStreamNotice((current) => ({
        tone: "working",
        title: "连接 ledger stream",
        message: `请求 /ws?after_seq=${lastSeqRef.current}；等待 typed hello/replay/ready。${current.tone === "critical" ? " REST resync 最近失败。" : ""}`,
      }));
      socket = new WebSocket(api.makeWebSocketUrl(lastSeqRef.current));
      socket.onopen = () => {
        if (stopped) return;
        replayedCount = 0;
        updateWsState("replaying");
      };
      socket.onmessage = (message) => {
        if (stopped) return;
        try {
          if (typeof message.data !== "string") throw new api.ProtocolError("WebSocket payload 不是 JSON 文本", message.data);
          const parsed: unknown = JSON.parse(message.data);
          handleEnvelope(api.decodeWsEnvelope(parsed));
        } catch (error) {
          failProtocol(error instanceof Error ? `无效 WebSocket payload：${error.message}` : "无效 WebSocket payload");
        }
      };
      socket.onerror = () => {
        if (stopped) return;
        setStreamNotice({
          tone: "warning",
          title: "Ledger stream 网络错误",
          message: `连接错误；关闭后将指数退避重连。last seq ${lastSeqRef.current}。`,
        });
      };
      socket.onclose = () => {
        socket = null;
        if (!stopped && !resyncPromiseRef.current) scheduleReconnect();
      };
    };

    const onOnline = () => {
      if (stopped || socket) return;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      connect();
    };
    window.addEventListener("online", onOnline);
    connect();
    return () => {
      stopped = true;
      window.removeEventListener("online", onOnline);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      socket?.close(1000, "component cleanup");
    };
  }, [reconnectVersion, recordEvents, restResync, scheduleProjectionRefresh, updateLastSeq, updateWsState]);

  const loadImpactDetails = useCallback(async () => {
    impactControllerRef.current?.abort();
    const controller = new AbortController();
    impactControllerRef.current = controller;
    setImpactLoading(true);
    setImpactErrors(new Map());
    const taskSnapshot = [...tasksRef.current];
    const nextDetails = new Map<string, TaskDetail>();
    const nextErrors = new Map<string, unknown>();
    let cursor = 0;
    const workers = Array.from({ length: Math.min(6, Math.max(1, taskSnapshot.length)) }, async () => {
      while (!controller.signal.aborted && cursor < taskSnapshot.length) {
        const task = taskSnapshot[cursor];
        cursor += 1;
        try {
          nextDetails.set(task.id, await api.getTask(task.id, controller.signal));
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) nextErrors.set(task.id, error);
        }
      }
    });
    await Promise.all(workers);
    if (mountedRef.current && !controller.signal.aborted && impactControllerRef.current === controller) {
      setImpactDetails(nextDetails);
      setImpactErrors(nextErrors);
      setImpactLoading(false);
    }
  }, []);

  const impactRevision = useMemo(
    () => tasks.map((task) => `${task.id}:${task.updatedAt ?? task.lastActivityAt ?? ""}`).sort().join("|"),
    [tasks],
  );

  useEffect(() => {
    if (view === "impact") void loadImpactDetails();
    return () => impactControllerRef.current?.abort();
  }, [impactRevision, loadImpactDetails, view]);

  const runResidual = async () => {
    setResidualRunning(true);
    setResidualError(null);
    try {
      const artifact = await api.runResidualReconciliation();
      setResidual(artifact);
      setLiveMessage(`Residual reconciliation ${shortId(artifact.artifactId, 12)} 已生成，真实 total ${artifact.summary.total ?? "未报告"}`);
      await refreshTasks({ quiet: true }).catch(() => undefined);
    } catch (error) {
      setResidualError(error);
    } finally {
      setResidualRunning(false);
    }
  };

  const handleCreated = async (created: TaskDetail | TaskSummary) => {
    const summary = "task" in created ? created.task : created;
    setTasks((current) => mergeTask(current, summary));
    setHasTaskSnapshot(true);
    setLiveMessage(`Task ${shortId(summary.id)} 已由 POST /api/tasks 创建；正在重拉 REST 投影。`);
    try {
      await refreshTasks({ quiet: true });
    } catch {
      setLiveMessage(`Task ${shortId(summary.id)} 已创建，但后续 REST 投影刷新失败；本地保留 POST 返回任务，请手动重试刷新。`);
    }
  };

  const handleMutated = async (taskId: string, options?: { close?: boolean }) => {
    if (options?.close) setSelectedId(null);
    const snapshot = await refreshTasks({ quiet: true });
    setLiveMessage(`Task ${shortId(taskId)} 操作成功；REST 已立即重拉 ${snapshot?.tasks.length ?? ""} 项投影。`);
  };

  const selectedTask = selectedId ? tasks.find((task) => task.id === selectedId) ?? null : null;
  const totals = useMemo(() => {
    const costs = tasks.map((task) => task.costUsd).filter((value): value is number => value !== null);
    return {
      cost: costs.length ? costs.reduce((sum, value) => sum + value, 0) : null,
      costCoverage: costs.length,
      blocked: tasks.filter((task) => api.classifyTask(task) === "blocked").length,
      review: tasks.filter((task) => api.classifyTask(task) === "review").length,
    };
  }, [tasks]);

  const views: Array<{ id: AppView; label: string; description: string }> = [
    { id: "queue", label: "Central queue", description: "任务地块与 harvest gate" },
    { id: "impact", label: "影响 / 证据", description: "显式 lineage 与 overlap" },
    { id: "residual", label: "Residual health", description: "版本化 reconciliation artifact" },
  ];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主内容</a>
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <div><p className="eyebrow">local agent farm / audit console</p><h1>Harvest Ledger</h1></div>
        </div>
        <div className="topbar-proof">
          <div className="stream-chip" data-testid="ws-status">
            <StatusPill status={wsState} />
            <span>last seq <strong>{lastSeq}</strong></span>
          </div>
          <button type="button" className="button primary" onClick={() => setSeedOpen(true)} data-testid="seed-task">播种任务</button>
        </div>
      </header>

      <div className="console-layout">
        <aside className="rail" aria-label="主要导航与真实摘要">
          <nav className="view-nav" aria-label="控制台视图">
            {views.map((item) => (
              <button type="button" className={view === item.id ? "active" : undefined} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)} key={item.id}>
                <span>{item.label}</span><small>{item.description}</small>
              </button>
            ))}
          </nav>

          <section className="rail-ledger" aria-labelledby="rail-ledger-title">
            <p className="eyebrow" id="rail-ledger-title">REST snapshot</p>
            <dl>
              <div><dt>tasks</dt><dd>{!hasTaskSnapshot ? "未报告" : tasks.length}</dd></div>
              <div><dt>blocked</dt><dd>{!hasTaskSnapshot ? "未报告" : totals.blocked}</dd></div>
              <div><dt>review</dt><dd data-testid="ripe-count">{!hasTaskSnapshot ? "未报告" : totals.review}</dd></div>
              <div><dt>cost</dt><dd data-testid="total-cost">{totals.cost === null ? "未报告" : formatMoney(totals.cost)}</dd></div>
            </dl>
            {totals.cost !== null && totals.costCoverage < tasks.length && <p>{totals.costCoverage}/{tasks.length} tasks reported cost</p>}
            <p>snapshot {formatTimestamp(snapshotAt)}</p>
          </section>

          <section className="rail-events" aria-labelledby="rail-events-title">
            <div><p className="eyebrow" id="rail-events-title">ledger tail</p><span>{recentEvents.length}</span></div>
            <ol data-testid="event-log">
              {recentEvents.slice(0, 8).map((event) => (
                <li key={event.seq}>
                  <strong>{event.seq}</strong>
                  <span>{statusLabel(event.type)}{event.taskId ? ` · ${shortId(event.taskId)}` : ""}</span>
                  <time title={formatTimestamp(event.occurredAt)}>{formatRelativeTime(event.occurredAt)}</time>
                </li>
              ))}
              {!recentEvents.length && <li className="empty-event">等待真实 ledger event；不会生成示例日志。</li>}
            </ol>
          </section>

          <footer className="rail-contract">
            <strong>Central queue only</strong>
            <p>没有 P2P / swarm 协作宣称。关系只由显式 audit evidence 建立。</p>
          </footer>
        </aside>

        <main id="main-content" className="main-canvas">
          <section className={cx("stream-banner", `banner-${streamNotice.tone}`)} aria-labelledby="stream-banner-title" role="status" aria-live="polite" aria-atomic="true">
            <span className="stream-banner-mark" aria-hidden="true" />
            <div><strong id="stream-banner-title">{streamNotice.title}</strong><p>{streamNotice.message}</p></div>
            <div className="banner-seq"><span>last seq</span><strong>{lastSeq}</strong></div>
          </section>

          {loadError !== null && !hasTaskSnapshot && <ErrorNotice error={loadError} onRetry={() => void refreshTasks()} title="无法加载任务 central queue" />}
          {loading && !hasTaskSnapshot && (
            <section className="queue-loading" aria-busy="true" aria-label="加载真实任务">
              <div className="loading-furrow" /><div className="loading-furrow" /><div className="loading-furrow" />
              <div><span className="loader" aria-hidden="true" /><h2>读取 REST / SQLite / git 投影</h2><p>不会用 fixture 填充地块或统计。</p></div>
            </section>
          )}
          {loadError !== null && hasTaskSnapshot && <ErrorNotice error={loadError} compact onRetry={() => void refreshTasks({ quiet: true })} title="刷新失败，保留上一个真实快照" />}

          {view === "residual" && <ResidualHealthPanel artifact={residual} loading={residualLoading} running={residualRunning} error={residualError} onRetry={() => void loadResidual()} onRun={() => void runResidual()} />}
          {hasTaskSnapshot && view === "queue" && <QueueView tasks={tasks} filter={filter} query={query} onFilterChange={setFilter} onQueryChange={setQuery} onInspect={setSelectedId} onSeed={() => setSeedOpen(true)} />}
          {hasTaskSnapshot && view === "impact" && <ImpactView tasks={tasks} details={impactDetails} errors={impactErrors} loading={impactLoading} onReload={() => void loadImpactDetails()} onInspect={setSelectedId} />}
        </main>
      </div>

      <SeedDialog open={seedOpen} tasks={tasks} onClose={() => setSeedOpen(false)} onCreated={handleCreated} />
      <TaskInspector task={selectedTask} allTasks={tasks} open={selectedTask !== null} onClose={() => setSelectedId(null)} onMutated={handleMutated} />
      <LiveRegion message={liveMessage} />
    </div>
  );
}
