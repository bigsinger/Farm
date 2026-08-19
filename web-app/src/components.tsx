import { useEffect, useId, useRef } from "react";
import type { AuditProvenance, UnknownRecord } from "./api";
import { errorPresentation } from "./api";

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage is optional; runtime state remains in memory.
  }
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "未报告";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function formatRelativeTime(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "未报告";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const seconds = Math.round((timestamp - now) / 1000);
  const absolute = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
  if (absolute < 60) return formatter.format(seconds, "second");
  if (absolute < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (absolute < 86_400) return formatter.format(Math.round(seconds / 3600), "hour");
  return formatter.format(Math.round(seconds / 86_400), "day");
}

export function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "未报告";
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} s`;
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.round((value % 60_000) / 1000);
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "未报告";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value === 0 ? 2 : 4,
    maximumFractionDigits: 6,
  }).format(value);
}

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "未报告"
    : new Intl.NumberFormat("zh-CN").format(value);
}

export function shortId(value: string | null | undefined, length = 8): string {
  if (!value) return "未报告";
  return value.length > length ? value.slice(0, length) : value;
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "未报告";
  const labels: Record<string, string> = {
    active: "运行队列",
    blocked: "阻塞",
    review: "待审查",
    terminal: "终态",
    created: "已建档",
    queued: "排队中",
    planted: "已播种",
    starting: "启动中",
    running: "运行中",
    growing: "运行中",
    retrying: "重试中",
    recovering: "恢复中",
    ripe: "可审查",
    pending: "待处理",
    approved: "已批准",
    rejected: "已拒绝",
    stale: "已过期",
    harvested: "已 harvest",
    merged: "已合并",
    completed: "已完成",
    failed: "失败",
    error: "错误",
    crashed: "Agent 崩溃",
    timeout: "超时",
    timed_out: "超时",
    cancelled: "已取消",
    canceled: "已取消",
    wilted: "已枯萎",
    rolled_back: "已回滚",
    cleaned: "已清理",
    conflict: "合并冲突",
    provider_blocked: "Provider 阻塞",
    provider_auth_blocked: "Provider 鉴权阻塞",
    sandbox_blocked: "沙箱不可用",
    auth_blocked: "鉴权阻塞",
    healthy: "健康",
    verified: "已真实验证",
    not_run: "未运行",
    live: "实时",
    replaying: "回放中",
    connecting: "连接中",
    disconnected: "已断开",
  };
  return labels[status.toLowerCase()] ?? status.replaceAll("_", " ");
}

export function statusTone(status: string | null | undefined): "neutral" | "working" | "good" | "warning" | "critical" {
  const value = (status ?? "").toLowerCase();
  if (["harvested", "merged", "completed", "approved", "healthy", "verified", "live", "resolved"].some((part) => value.includes(part))) return "good";
  if (["failed", "crash", "conflict", "blocking", "auth_blocked", "missing", "mismatch", "double_terminal"].some((part) => value.includes(part))) return "critical";
  if (["blocked", "timeout", "stale", "rejected", "dirty", "warning", "disconnected", "cancel"].some((part) => value.includes(part))) return "warning";
  if (["running", "growing", "starting", "queued", "recover", "retry", "replay", "connecting", "active"].some((part) => value.includes(part))) return "working";
  return "neutral";
}

export function StatusPill({ status, label }: { status: string | null | undefined; label?: string }) {
  const normalized = status ?? "unknown";
  return (
    <span className={cx("status-pill", `tone-${statusTone(normalized)}`)} data-status={normalized}>
      <span className="status-glyph" aria-hidden="true" />
      {label ?? statusLabel(normalized)}
    </span>
  );
}

export function FoldedPath({ value, label = "路径" }: { value: string | null | undefined; label?: string }) {
  if (!value) return <span className="missing-value">未报告</span>;
  const segments = value.split(/[\\/]/).filter(Boolean);
  const short = segments.length > 2 ? `…/${segments.slice(-2).join("/")}` : value;
  if (short === value || value.length < 42) return <code className="path-value">{value}</code>;
  return (
    <details className="folded-path">
      <summary aria-label={`展开完整${label}`}>{short}</summary>
      <code>{value}</code>
    </details>
  );
}

export function Provenance({ value, compact = false }: { value: AuditProvenance; compact?: boolean }) {
  const hasAny = value.eventId || value.seq !== null || value.kind || value.source || value.recordedAt || value.digest;
  return (
    <dl className={cx("provenance", compact && "provenance-compact")} aria-label="来源审计事件与 provenance">
      <div>
        <dt>source audit event</dt>
        <dd>{value.eventId ? <code>{value.eventId}</code> : value.seq !== null ? <code>seq {value.seq}</code> : <span className="missing-value">API 未报告</span>}</dd>
      </div>
      {!compact && (
        <>
          <div><dt>kind</dt><dd>{value.kind ?? <span className="missing-value">未报告</span>}</dd></div>
          <div><dt>source</dt><dd>{value.source ?? <span className="missing-value">未报告</span>}</dd></div>
          <div><dt>observed</dt><dd>{formatTimestamp(value.recordedAt)}</dd></div>
          <div><dt>digest</dt><dd>{value.digest ? <code>{value.digest}</code> : <span className="missing-value">未报告</span>}</dd></div>
        </>
      )}
      {compact && !hasAny && <div><dt>provenance</dt><dd className="missing-value">API 未报告</dd></div>}
    </dl>
  );
}

export function ErrorNotice({
  error,
  onRetry,
  title,
  compact = false,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
}) {
  const presentation = errorPresentation(error);
  return (
    <section className={cx("error-notice", compact && "error-notice-compact")} role="alert">
      <div className="error-notice-mark" aria-hidden="true">!</div>
      <div>
        <h3>{title ?? presentation.title}</h3>
        <p>{redactSensitiveText(presentation.message)}</p>
        <p className="error-guidance"><strong>如何修复：</strong>{redactSensitiveText(presentation.guidance)}</p>
        {presentation.requestId && <p className="request-id">request id <code>{presentation.requestId}</code></p>}
        {presentation.details !== null && presentation.details !== undefined && (
          <details>
            <summary>服务器错误详情</summary>
            <SafeJson value={presentation.details} />
          </details>
        )}
        {onRetry && <button type="button" className="button secondary" onClick={onRetry}>重试</button>}
      </div>
    </section>
  );
}

const SECRET_KEY = /(?:secret|token|password|passwd|authorization|cookie|private[_-]?key|api[_-]?key|access[_-]?key|client[_-]?secret|credential|session[_-]?key)/i;
const PRIVATE_KEY_BLOCK = /-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/gi;
const AUTHORIZATION_VALUE = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const KNOWN_TOKEN = /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g;
const JWT_VALUE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const SECRET_ASSIGNMENT = /\b(secret|token|password|passwd|authorization|cookie|private[_-]?key|api[_-]?key|access[_-]?key|client[_-]?secret|credential)(\s*[=:]\s*)(["']?)([^\s,;"'\]}]+)(["']?)/gi;
const SECRET_QUERY = /([?&](?:access_token|api_key|client_secret|token|password)=)[^&#\s]+/gi;

export function redactSensitiveText(value: string): string {
  return value
    .replace(PRIVATE_KEY_BLOCK, "[PRIVATE KEY REDACTED]")
    .replace(AUTHORIZATION_VALUE, "$1 [REDACTED]")
    .replace(KNOWN_TOKEN, "[TOKEN REDACTED]")
    .replace(JWT_VALUE, "[JWT REDACTED]")
    .replace(SECRET_ASSIGNMENT, (_match, key: string, separator: string) => `${key}${separator}[REDACTED]`)
    .replace(SECRET_QUERY, "$1[REDACTED]");
}

function sanitizeUnknown(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > 8) return "[payload depth omitted]";
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => sanitizeUnknown(item, depth + 1, seen));
  if (typeof value === "string") return redactSensitiveText(value);
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return "[cyclic value omitted]";
  seen.add(value);
  const safe: UnknownRecord = {};
  for (const [key, child] of Object.entries(value as UnknownRecord)) {
    if (SECRET_KEY.test(key)) continue;
    safe[key] = sanitizeUnknown(child, depth + 1, seen);
  }
  return safe;
}

export function sanitizedPayload(value: unknown): unknown {
  return sanitizeUnknown(value, 0, new WeakSet<object>());
}

export function SafeJson({ value }: { value: unknown }) {
  return <pre className="safe-json">{JSON.stringify(sanitizedPayload(value), null, 2)}</pre>;
}

export function Metric({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>{value}</dd>
    </div>
  );
}

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  busy?: boolean;
  testId?: string;
  className?: string;
}

const FOCUSABLE = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  busy = false,
  testId,
  className,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      const autofocus = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]");
      (autofocus ?? closeRef.current)?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!busy) onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!(document.activeElement instanceof Node) || !panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}
      data-testid={testId}
    >
      <div
        className={cx("dialog", className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="dialog-header">
          <div>
            <p className="eyebrow">central queue control</p>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label={`关闭“${title}”`}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </div>
  );
}

export function LiveRegion({ message }: { message: string }) {
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
