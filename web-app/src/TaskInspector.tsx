import { useEffect, useMemo, useRef, useState } from "react";
import { html as renderDiff } from "diff2html";
import * as api from "./api";
import type {
  Claim,
  DiffArtifact,
  OverlapEvidence,
  TaskDetail,
  TaskSummary,
} from "./api";
import {
  Dialog,
  ErrorNotice,
  FoldedPath,
  Metric,
  Provenance,
  SafeJson,
  StatusPill,
  cx,
  formatCount,
  formatDuration,
  formatMoney,
  formatRelativeTime,
  formatTimestamp,
  redactSensitiveText,
  shortId,
  statusLabel,
} from "./components";

type InspectorTab = "overview" | "evidence" | "timeline" | "diff" | "control";
type ActionName =
  | "add-dependency"
  | "remove-dependency"
  | "add-claim"
  | "release-claim"
  | "start-run"
  | "recover-run"
  | "cancel-run"
  | "approve"
  | "reject"
  | "harvest"
  | "wilt"
  | "resolve-overlap";

interface PendingConfirmation {
  action: ActionName;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  execute: () => Promise<void>;
}

interface Props {
  task: TaskSummary | null;
  allTasks: TaskSummary[];
  open: boolean;
  onClose: () => void;
  onMutated: (taskId: string, options?: { close?: boolean }) => Promise<void>;
}

function activeRunStatus(status: string): boolean {
  return ["queued", "starting", "running", "growing", "recovering", "retrying", "cancelling"].includes(status.toLowerCase());
}

function recoverableRunStatus(status: string): boolean {
  return ["failed", "error", "crashed", "timeout", "timed_out", "cancelled", "canceled", "provider_auth_blocked", "auth_blocked"].includes(status.toLowerCase());
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    agent_start: "Agent 启动",
    agent_started: "Agent 启动",
    agent_result: "Agent 结果",
    agent_error: "Agent 错误",
    agent_crash: "Agent 崩溃",
    agent_cancel: "Agent 取消",
    agent_cancelled: "Agent 取消",
    agent_recovery: "Agent 恢复",
    run_retry: "运行重试",
    retry: "重试",
    run_timeout: "运行超时",
    timeout: "超时",
    claim: "Path claim",
    claim_added: "Path claim",
    claim_release: "Claim 释放",
    claim_released: "Claim 释放",
    diff_snapshot: "Diff snapshot",
    review_approved: "Review 批准",
    review_rejected: "Review 拒绝",
    merge: "Merge",
    merged: "Merge",
    rollback: "Rollback",
    cleanup: "Cleanup",
    harvest: "Harvest",
    harvested: "Harvest",
    wilt: "Wilt",
    provider_auth_blocked: "Provider 鉴权阻塞",
  };
  return labels[type] ?? statusLabel(type);
}

function latestReview(detail: TaskDetail) {
  return [...detail.reviews].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return leftTime - rightTime;
  }).at(-1) ?? null;
}

function harvestEvidence(detail: TaskDetail, diff: DiffArtifact | null) {
  const latestDecision = latestReview(detail);
  const latestApproval = latestDecision?.decision === "approved" ? latestDecision : null;
  const digestMatches = Boolean(latestApproval?.diffDigest && diff?.digest && latestApproval.diffDigest === diff.digest);
  const reviewCurrent = latestApproval?.stale === false && digestMatches;
  const reviewFreshness = latestApproval === null
    ? "没有 approved review"
    : latestApproval.stale === true
      ? "服务器确认 stale"
      : latestApproval.stale === false
        ? "服务器确认 current"
        : "服务器尚未实时验证 freshness";
  return [
    {
      label: "服务器 eligibility 允许 harvest",
      met: detail.eligibility?.canHarvest === true,
      note: detail.eligibility ? (detail.eligibility.reasons.join("；") || "服务器未报告阻塞原因") : "eligibility 未报告",
    },
    {
      label: "Review approved 且未 stale",
      met: reviewCurrent,
      note: latestApproval ? `review ${shortId(latestApproval.id)} · digest ${latestApproval.diffDigest ?? "未报告"} · ${reviewFreshness}` : reviewFreshness,
    },
    {
      label: "当前 diff 有可审计 digest",
      met: Boolean(diff?.digest),
      note: diff?.digest ?? "请加载 diff；服务器未提供 digest 时不能由客户端证明一致性",
    },
    {
      label: "Worktree health 无阻塞",
      met: detail.worktreeHealth?.healthy === true && detail.worktreeHealth.blockingReasons.length === 0,
      note: detail.worktreeHealth ? (detail.worktreeHealth.blockingReasons.join("；") || detail.worktreeHealth.state) : "worktree health 未报告",
    },
    {
      label: "显式 dependencies 已由服务器评估",
      met: detail.eligibility !== null && !detail.eligibility.reasons.some((reason) => /depend/i.test(reason)),
      note: detail.dependencies.length ? `${detail.dependencies.length} 条显式 dependency` : "没有显式 dependency",
    },
  ];
}

function OverviewTab({ detail }: { detail: TaskDetail }) {
  const task = detail.task;
  return (
    <div className="inspector-stack">
      <section className="inspector-hero">
        <div>
          <div className="pill-row"><StatusPill status={task.status} />{task.reviewStatus && <StatusPill status={task.reviewStatus} />}{task.reviewStale && <StatusPill status="stale" />}</div>
          <h3>{task.title || `Task ${shortId(task.id)}`}</h3>
          <p data-testid="modal-prompt">{task.prompt ? redactSensitiveText(task.prompt) : <span className="missing-value">Prompt 未报告</span>}</p>
        </div>
        <code className="task-id-full">{task.id}</code>
      </section>

      {task.blockingReasons.length > 0 && (
        <section className="blocking-reasons" role="alert">
          <h3>为什么不能 harvest</h3>
          <ul>{task.blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </section>
      )}

      <dl className="inspector-metrics" data-testid="modal-metrics">
        <Metric label="repository" value={detail.repository?.name ?? task.repoName ?? "未报告"} />
        <Metric label="repo path" value={<FoldedPath value={detail.repository?.path ?? task.repoPath} label="仓库路径" />} />
        <Metric label="base → branch" value={<><code>{task.baseBranch ?? "未报告"}</code>{task.baseCommit && <code title={task.baseCommit}>@{shortId(task.baseCommit, 12)}</code>}<span aria-hidden="true"> → </span><code>{task.branchName ?? "未报告"}</code></>} />
        <Metric label="worktree" value={<FoldedPath value={task.worktreePath} label="worktree 路径" />} />
        <Metric label="last activity" value={<span title={formatTimestamp(task.lastActivityAt)}>{formatRelativeTime(task.lastActivityAt)}</span>} />
        <Metric label="agent session" value={task.run?.sessionId ? <code>{task.run.sessionId}</code> : "未报告"} />
        <Metric label="run" value={task.run ? <><code>{task.run.id}</code> · <StatusPill status={task.run.status} /></> : "未报告"} />
        <Metric label="cost" value={formatMoney(task.costUsd)} />
        <Metric label="turns" value={formatCount(task.numTurns)} />
        <Metric label="duration" value={formatDuration(task.durationMs)} />
        <Metric label="artifacts" value={task.artifacts?.count === null || !task.artifacts ? "未报告" : formatCount(task.artifacts.count)} />
        <Metric label="outcome" value={task.outcomeStatus ? <StatusPill status={task.outcomeStatus} /> : "未报告"} />
      </dl>

      <section className="detail-block">
        <header><h3>Worktree health</h3>{detail.worktreeHealth && <StatusPill status={detail.worktreeHealth.healthy === true ? "healthy" : detail.worktreeHealth.state} />}</header>
        {detail.worktreeHealth ? (
          <>
            <dl className="inline-proof-list">
              <Metric label="exists" value={detail.worktreeHealth.exists === null ? "未报告" : detail.worktreeHealth.exists ? "是" : "否"} />
              <Metric label="dirty" value={detail.worktreeHealth.dirty === null ? "未报告" : detail.worktreeHealth.dirty ? "是" : "否"} />
              <Metric label="checked" value={formatTimestamp(detail.worktreeHealth.checkedAt)} />
            </dl>
            {detail.worktreeHealth.blockingReasons.length > 0 && <ul className="reason-list">{detail.worktreeHealth.blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
            <Provenance value={detail.worktreeHealth.provenance} />
          </>
        ) : <p className="missing-value">服务器未报告 worktree health。</p>}
      </section>

      <section className="detail-block eligibility-block">
        <header><h3>Harvest eligibility</h3>{detail.eligibility && <StatusPill status={detail.eligibility.canHarvest ? "approved" : "blocked"} label={detail.eligibility.canHarvest ? "可 harvest" : "不可 harvest"} />}</header>
        {detail.eligibility ? (
          <>
            {detail.eligibility.reasons.length ? <ul className="reason-list">{detail.eligibility.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>服务器评估未返回阻塞原因。</p>}
            <p className="timestamp-line">评估于 {formatTimestamp(detail.eligibility.evaluatedAt)}</p>
            <Provenance value={detail.eligibility.provenance} />
          </>
        ) : <p className="missing-value">服务器未报告 eligibility；客户端不会自行批准 harvest。</p>}
      </section>

      <section className="detail-block">
        <header><h3>Agent runs</h3><span className="register-count">{detail.runs.length}</span></header>
        {detail.runs.length ? <ul className="run-detail-list">{detail.runs.map((run) => {
          const providerBlocked = run.status.includes("auth_blocked") || run.errorCode?.toLowerCase().includes("auth") || run.blockingReasons.some((reason) => /provider.*auth|auth.*provider/i.test(reason));
          return <li key={run.id} className={providerBlocked ? "provider-blocked-run" : undefined}>
            <header><div><code>{run.id}</code><StatusPill status={run.status} /></div>{run.provider && <span>{run.provider}</span>}</header>
            {providerBlocked && <p className="run-proof-blocked" role="alert"><strong>Provider auth blocked：真实 Agent SDK / E2E 未成功。</strong> 修复 provider 凭据后使用“恢复 run”，不要把当前投影当作成功。</p>}
            <dl className="inline-proof-list">
              <Metric label="session" value={run.sessionId ? <code>{run.sessionId}</code> : "未报告"} />
              <Metric label="started" value={formatTimestamp(run.startedAt)} />
              <Metric label="finished" value={formatTimestamp(run.finishedAt)} />
              <Metric label="updated" value={formatTimestamp(run.updatedAt)} />
              <Metric label="cost" value={formatMoney(run.costUsd)} />
              <Metric label="turns" value={formatCount(run.numTurns)} />
              <Metric label="duration" value={formatDuration(run.durationMs)} />
              <Metric label="retry of" value={run.retryOfRunId ? <code>{run.retryOfRunId}</code> : "无/未报告"} />
              <Metric label="recovery of" value={run.recoveryOfRunId ? <code>{run.recoveryOfRunId}</code> : "无/未报告"} />
            </dl>
            {(run.errorCode || run.errorMessage) && <p className="run-error"><strong>{run.errorCode ?? "run error"}</strong>{run.errorMessage ? redactSensitiveText(run.errorMessage) : "错误消息未报告"}</p>}
            {run.blockingReasons.length > 0 && <ul className="reason-list">{run.blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
          </li>;
        })}</ul> : <p className="empty-inline">服务器未返回 run。</p>}
      </section>

      <section className="detail-block">
        <header><h3>Artifacts / changed paths</h3><span className="register-count">{detail.artifacts.length}</span></header>
        {detail.artifacts.length ? <ul className="artifact-detail-list">{detail.artifacts.map((artifact) => <li key={artifact.id}><header><StatusPill status={artifact.type} /><strong>{artifact.path ? <FoldedPath value={artifact.path} label="artifact 路径" /> : artifact.id}</strong></header><dl className="inline-proof-list"><Metric label="digest" value={artifact.digest ? <code>{artifact.digest}</code> : "未报告"} /><Metric label="created" value={formatTimestamp(artifact.createdAt)} /><Metric label="size" value={artifact.sizeBytes === null ? "未报告" : `${formatCount(artifact.sizeBytes)} bytes`} /><Metric label="media type" value={artifact.mediaType ?? "未报告"} /></dl>{artifact.changedPaths.length > 0 && <details><summary>Changed paths · {artifact.changedPaths.length}</summary><ul>{artifact.changedPaths.map((path) => <li key={path}><FoldedPath value={path} /></li>)}</ul></details>}</li>)}</ul> : <p className="empty-inline">服务器未返回 artifact manifest。</p>}
      </section>

      <section className="detail-block">
        <header><h3>Reviews</h3><span className="register-count">{detail.reviews.length}</span></header>
        {detail.reviews.length ? <ul className="audit-record-list">{detail.reviews.map((review) => <li key={review.id}><header><div><StatusPill status={review.decision} />{review.stale && <StatusPill status="stale" />}</div><time>{formatTimestamp(review.createdAt)}</time></header><p>{review.summary ? redactSensitiveText(review.summary) : <span className="missing-value">Summary 未报告</span>}</p><dl className="inline-proof-list"><Metric label="diff digest" value={review.diffDigest ? <code>{review.diffDigest}</code> : "未报告"} /><Metric label="reviewer" value={review.reviewer ?? "未报告"} /></dl><Provenance value={review.provenance} /></li>)}</ul> : <p className="empty-inline">没有 review。</p>}
      </section>

      <section className="detail-block">
        <header><h3>Outcomes</h3><span className="register-count">{detail.outcomes.length}</span></header>
        {detail.outcomes.length ? <ul className="audit-record-list">{detail.outcomes.map((outcome) => <li key={outcome.id}><header><StatusPill status={outcome.status} /><time>{formatTimestamp(outcome.createdAt)}</time></header><p>{outcome.summary ? redactSensitiveText(outcome.summary) : <span className="missing-value">Summary 未报告</span>}</p><dl className="inline-proof-list"><Metric label="commit" value={outcome.commit ? <code>{outcome.commit}</code> : "未报告"} /><Metric label="rollback commit" value={outcome.rollbackCommit ? <code>{outcome.rollbackCommit}</code> : "无/未报告"} /></dl><Provenance value={outcome.provenance} /></li>)}</ul> : <p className="empty-inline">没有 outcome。</p>}
      </section>

      {detail.residualHealth && (
        <section className="detail-block residual-ref">
          <header><h3>Residual artifact 引用</h3><StatusPill status={(detail.residualHealth.blocking ?? 0) > 0 ? "blocking" : "neutral"} label={`${formatCount(detail.residualHealth.total)} residual`} /></header>
          <dl className="inline-proof-list">
            <Metric label="artifact" value={<code>{detail.residualHealth.artifactId}</code>} />
            <Metric label="schema" value={<code>{detail.residualHealth.schemaVersion}</code>} />
            <Metric label="blocking" value={formatCount(detail.residualHealth.blocking)} />
            <Metric label="residual ids" value={detail.residualHealth.residualIds.length ? detail.residualHealth.residualIds.map((id) => <code key={id}>{id} </code>) : "未报告"} />
          </dl>
        </section>
      )}
    </div>
  );
}

function EvidenceTab({
  detail,
  onRequestAction,
  acting,
}: {
  detail: TaskDetail;
  onRequestAction: (confirmation: PendingConfirmation) => void;
  acting: ActionName | null;
}) {
  const taskId = detail.task.id;
  const [resolutionById, setResolutionById] = useState<Record<string, string>>({});
  return (
    <div className="inspector-stack">
      <section className="semantic-warning">
        <strong>证据语义边界</strong>
        <p>Dependency 是显式有向关系。Overlap 是 claim / magnet / diff 的路径证据，不等于 dependency、协作、P2P 或 swarm。</p>
      </section>

      {detail.group && (
        <section className="detail-block">
          <header><h3>Dependency group</h3><StatusPill status={detail.group.state} /></header>
          <dl className="inline-proof-list">
            <Metric label="group id" value={<code>{detail.group.id}</code>} />
            <Metric label="task ids" value={detail.group.taskIds.length ? detail.group.taskIds.map((id) => <code key={id}>{id} </code>) : "未报告"} />
          </dl>
          <Provenance value={detail.group.provenance} />
        </section>
      )}

      <section className="detail-block">
        <header><h3>显式 dependencies</h3><span className="register-count">{detail.dependencies.length}</span></header>
        {detail.dependencies.length ? <ul className="relation-list">{detail.dependencies.map((edge) => <li key={edge.edgeId ?? edge.taskId}><div><strong>{edge.title || `Task ${shortId(edge.taskId)}`}</strong><code>{edge.taskId}</code>{edge.status && <StatusPill status={edge.status} />}</div><Provenance value={edge.provenance} /></li>)}</ul> : <p className="empty-inline">没有显式 dependency。</p>}
      </section>

      <section className="detail-block">
        <header><h3>Dependents</h3><span className="register-count">{detail.dependents.length}</span></header>
        {detail.dependents.length ? <ul className="relation-list">{detail.dependents.map((edge) => <li key={edge.edgeId ?? edge.taskId}><div><strong>{edge.title || `Task ${shortId(edge.taskId)}`}</strong><code>{edge.taskId}</code>{edge.status && <StatusPill status={edge.status} />}</div><Provenance value={edge.provenance} /></li>)}</ul> : <p className="empty-inline">没有 dependents。</p>}
      </section>

      <section className="detail-block">
        <header><h3>Claims / release provenance</h3><span className="register-count">{detail.claims.length}</span></header>
        {detail.claims.length ? <ul className="relation-list">{detail.claims.map((claim) => <li key={claim.id}><div><FoldedPath value={claim.path} label="claim 路径" /><StatusPill status={claim.status} /><code>{claim.mode}</code></div><dl className="inline-proof-list"><Metric label="claimed" value={formatTimestamp(claim.createdAt)} /><Metric label="released" value={formatTimestamp(claim.releasedAt)} /></dl><Provenance value={claim.provenance} /></li>)}</ul> : <p className="empty-inline">没有 claim。</p>}
      </section>

      <section className="detail-block" data-testid="overlap-evidence-inspector">
        <header><h3>Overlap evidence</h3><span className="register-count">{detail.overlaps.length}</span></header>
        {detail.overlaps.length ? (
          <ul className="overlap-list inspector-overlaps">
            {detail.overlaps.map((evidence) => {
              const resolution = resolutionById[evidence.id] ?? "";
              const resolved = evidence.status === "resolved";
              return (
                <li className={`overlap-record severity-${evidence.severity}`} key={evidence.id}>
                  <div className="overlap-spine" aria-hidden="true" />
                  <div className="overlap-main">
                    <header><div><p className="eyebrow">{evidence.type}</p><h4>{evidence.path ? <FoldedPath value={evidence.path} /> : "路径未报告"}</h4></div><div className="pill-row"><StatusPill status={evidence.severity} /><StatusPill status={evidence.status} /></div></header>
                    <dl className="overlap-fields">
                      <Metric label="task pair" value={<><code>{evidence.leftTaskId}</code><span aria-hidden="true"> ↔ </span><code>{evidence.rightTaskId}</code></>} />
                      <Metric label="detected" value={formatTimestamp(evidence.detectedAt)} />
                      <Metric label="resolution" value={evidence.resolution ?? "未解决"} />
                    </dl>
                    <Provenance value={evidence.provenance} />
                    {!resolved && (
                      <form className="inline-action-form" onSubmit={(event) => {
                        event.preventDefault();
                        if (!resolution.trim()) return;
                        onRequestAction({
                          action: "resolve-overlap",
                          title: "确认 resolve overlap evidence",
                          description: `将记录人工 resolution：“${resolution.trim()}”。这不会创建或删除 dependency。`,
                          confirmLabel: "记录 resolution",
                          execute: async () => api.resolveOverlap(taskId, evidence.id, resolution),
                        });
                      }}>
                        <label className="field"><span>Resolution <span aria-hidden="true">*</span></span><textarea rows={2} value={resolution} onChange={(event) => setResolutionById((current) => ({ ...current, [evidence.id]: event.target.value }))} required /></label>
                        <button type="submit" className="button secondary compact" disabled={acting !== null || !resolution.trim()}>Resolve evidence</button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className="empty-inline">服务器未返回 overlap evidence。</p>}
      </section>
    </div>
  );
}

function TimelineTab({ detail }: { detail: TaskDetail }) {
  if (!detail.timeline.length) return <section className="empty-inspector"><h3>没有 timeline event</h3><p>服务器 detail 没有返回按 seq 排序的活动。客户端不会合成事件。</p></section>;
  return (
    <ol className="timeline" data-testid="timeline">
      {detail.timeline.map((event) => (
        <li key={`${event.seq}-${event.id ?? event.type}`} className={`timeline-event event-${event.type}`}>
          <div className="timeline-seq"><span>seq</span><strong>{event.seq}</strong></div>
          <div className="timeline-rail" aria-hidden="true"><span /></div>
          <article>
            <header><div><h3>{eventLabel(event.type)}</h3><code>{event.type}</code></div><time dateTime={event.occurredAt ?? undefined}>{formatTimestamp(event.occurredAt)}</time></header>
            <Provenance value={event.provenance} compact />
            {event.payload && <details><summary>Payload（secret / credential 字段不渲染）</summary><SafeJson value={event.payload} /></details>}
          </article>
        </li>
      ))}
    </ol>
  );
}

function DiffTab({
  detail,
  diff,
  loading,
  error,
  onReload,
}: {
  detail: TaskDetail;
  diff: DiffArtifact | null;
  loading: boolean;
  error: unknown;
  onReload: () => void;
}) {
  const rendered = useMemo(() => {
    if (!diff || diff.kind !== "patch" || !diff.text.trim()) return null;
    return renderDiff(redactSensitiveText(diff.text), { drawFileList: true, matching: "lines", outputFormat: "line-by-line" });
  }, [diff]);

  return (
    <div className="inspector-stack diff-tab">
      <header className="diff-toolbar">
        <div><h3>真实 patch / artifact manifest</h3><p>Review 绑定服务器 digest；结构与 digest 来自真实响应，匹配到的 absolute secret 值会在显示层脱敏。digest 变化后必须重审。</p></div>
        <button type="button" className="button secondary compact" onClick={onReload} disabled={loading}>{loading ? "刷新中…" : "刷新 diff"}</button>
      </header>
      {loading && <div className="inline-loading" role="status" data-testid="diff-loading"><span className="loader" aria-hidden="true" />读取真实 patch…</div>}
      {error !== null && <div data-testid="diff-error"><ErrorNotice error={error} onRetry={onReload} title="Diff 加载失败" /></div>}
      {diff && (
        <>
          <dl className="diff-proof">
            <Metric label="kind" value={<StatusPill status={diff.kind} />} />
            <Metric label="diff digest" value={diff.digest ? <code>{diff.digest}</code> : "未报告"} />
            <Metric label="artifact digest" value={diff.artifactDigest ? <code>{diff.artifactDigest}</code> : "未报告"} />
            <Metric label="changed paths" value={formatCount(diff.changedPaths.length)} />
            <Metric label="manifest entries" value={formatCount(diff.manifest.length)} />
            <Metric label="media type" value={diff.mediaType ?? "未报告"} />
          </dl>
          {diff.changedPaths.length > 0 && <details className="changed-paths" open><summary>Changed paths · {diff.changedPaths.length}</summary><ul>{diff.changedPaths.map((path) => <li key={path}><FoldedPath value={path} /></li>)}</ul></details>}
          {diff.manifest.length > 0 && <details className="artifact-manifest"><summary>Artifact manifest · {diff.manifest.length}</summary><ul>{diff.manifest.map((artifact) => <li key={artifact.id}><div><StatusPill status={artifact.type} /><strong>{artifact.path ? <FoldedPath value={artifact.path} /> : artifact.id}</strong></div><dl><Metric label="digest" value={artifact.digest ? <code>{artifact.digest}</code> : "未报告"} /><Metric label="size" value={artifact.sizeBytes === null ? "未报告" : `${formatCount(artifact.sizeBytes)} bytes`} /></dl></li>)}</ul></details>}
          {diff.kind === "empty" && <section className="diff-state empty-diff" data-testid="diff-empty"><h3>Empty diff</h3><p data-testid="diff-content">服务器返回的 patch 为空。不能把“无改动”当作成功结果；请结合 outcome/review 决定 rerun 或 wilt。</p></section>}
          {diff.kind === "binary" && <section className="diff-state binary-diff" data-testid="diff-content"><h3>Binary diff</h3><p>Patch 无法按文本显示。使用 changed paths、artifact manifest 与 digest 审查；客户端不会伪造文本内容。</p></section>}
          {diff.kind === "large" && <section className="diff-state large-diff" data-testid="diff-content"><h3>Large / truncated diff</h3><p>服务器明确标记 patch 过大或截断。请使用 artifact manifest 核查，不要把当前视图视为完整 patch。</p></section>}
          {rendered && <div className="diff-content" data-testid="diff-content" dangerouslySetInnerHTML={{ __html: rendered }} />}
        </>
      )}
      {!loading && !error && !diff && <section className="diff-state"><h3>Diff 尚未加载</h3><button type="button" className="button secondary" onClick={onReload}>加载真实 diff</button></section>}
      {detail.reviews.some((review) => review.stale) && <section className="stale-review-alert" role="alert"><strong>Review stale</strong><p>服务器报告已有 review 对当前 diff 过期。刷新 patch 后必须重新审批，才能 harvest。</p></section>}
    </div>
  );
}

function ControlTab({
  detail,
  allTasks,
  diff,
  acting,
  onRequestAction,
}: {
  detail: TaskDetail;
  allTasks: TaskSummary[];
  diff: DiffArtifact | null;
  acting: ActionName | null;
  onRequestAction: (confirmation: PendingConfirmation) => void;
}) {
  const taskId = detail.task.id;
  const [dependencyId, setDependencyId] = useState("");
  const [claimPath, setClaimPath] = useState("");
  const [claimMode, setClaimMode] = useState("");
  const [reviewSummary, setReviewSummary] = useState("");
  const [wiltReason, setWiltReason] = useState("");
  const latestRun = detail.runs.at(-1) ?? detail.task.run;
  const runActive = latestRun ? activeRunStatus(latestRun.status) : false;
  const runRecoverable = latestRun ? recoverableRunStatus(latestRun.status) : false;
  const availableDependencies = allTasks.filter((task) => task.id !== taskId && !detail.dependencies.some((edge) => edge.taskId === task.id));
  const evidence = harvestEvidence(detail, diff);
  const allEvidenceMet = evidence.every((item) => item.met);
  const latestDecision = latestReview(detail);
  const latestApproval = latestDecision?.decision === "approved" ? latestDecision : null;
  const digestMismatch = Boolean(latestApproval?.diffDigest && diff?.digest && latestApproval.diffDigest !== diff.digest);
  const reviewStale = detail.task.reviewStale === true || latestApproval?.stale === true || digestMismatch;
  const busy = acting !== null;

  const request = (confirmation: PendingConfirmation) => {
    if (!busy) onRequestAction(confirmation);
  };

  return (
    <div className="control-grid">
      <section className="detail-block control-block">
        <header><div><p className="eyebrow">central queue edges</p><h3>Dependencies</h3></div></header>
        <p>增删的是显式有向 lineage；不会建立 agents 间直接连接。</p>
        {detail.dependencies.length > 0 && <ul className="control-list">{detail.dependencies.map((edge) => <li key={edge.edgeId ?? edge.taskId}><span><strong>{edge.title || shortId(edge.taskId)}</strong><code>{edge.taskId}</code></span><button type="button" className="button danger compact" disabled={busy} onClick={() => request({ action: "remove-dependency", title: "确认移除显式 dependency", description: `将移除 ${edge.taskId} → ${taskId}。这会改变 harvest eligibility；服务器仍会检查状态与并发。`, confirmLabel: "移除 dependency", tone: "danger", execute: async () => api.removeDependency(taskId, edge.taskId) })}>移除</button></li>)}</ul>}
        <form className="inline-action-form" onSubmit={(event) => { event.preventDefault(); if (!dependencyId) return; request({ action: "add-dependency", title: "确认增加显式 dependency", description: `${dependencyId} 将成为 ${taskId} 的显式前置任务，并写入中央账本。`, confirmLabel: "增加 dependency", execute: async () => api.addDependency(taskId, dependencyId) }); }}>
          <label className="field"><span>新增 dependency</span><select value={dependencyId} onChange={(event) => setDependencyId(event.target.value)}><option value="">选择任务</option>{availableDependencies.map((task) => <option value={task.id} key={task.id}>{task.title || shortId(task.id)} · {task.status}</option>)}</select></label>
          <button type="submit" className="button secondary compact" disabled={busy || !dependencyId}>增加</button>
        </form>
      </section>

      <section className="detail-block control-block">
        <header><div><p className="eyebrow">path ownership evidence</p><h3>Claims</h3></div></header>
        {detail.claims.length ? <ul className="control-list claim-control-list">{detail.claims.map((claim: Claim) => <li key={claim.id}><span><FoldedPath value={claim.path} /><small>{claim.mode} · {claim.status}</small></span><button type="button" className="button danger compact" disabled={busy || claim.status === "released"} title={claim.status === "released" ? "Claim 已释放" : undefined} onClick={() => request({ action: "release-claim", title: "确认释放 path claim", description: `释放 ${claim.path} (${claim.mode})。Overlap evidence 不会因此自动删除。`, confirmLabel: "释放 claim", tone: "danger", execute: async () => api.releaseClaim(taskId, claim.id) })}>释放</button></li>)}</ul> : <p className="empty-inline">没有 claim。</p>}
        <form className="inline-action-form claim-add-form" onSubmit={(event) => { event.preventDefault(); if (!claimPath.trim() || !claimMode.trim()) return; request({ action: "add-claim", title: "确认增加 path claim", description: `写入 claim ${claimPath.trim()} (${claimMode.trim()})；服务器是冲突判定的最终来源。`, confirmLabel: "增加 claim", execute: async () => api.addClaim(taskId, claimPath.trim(), claimMode.trim()) }); }}>
          <label className="field"><span>Path</span><input value={claimPath} onChange={(event) => setClaimPath(event.target.value)} /></label>
          <label className="field"><span>Mode</span><input value={claimMode} onChange={(event) => setClaimMode(event.target.value)} /></label>
          <button type="submit" className="button secondary compact" disabled={busy || !claimPath.trim() || !claimMode.trim()}>增加</button>
        </form>
      </section>

      <section className="detail-block control-block run-controls">
        <header><div><p className="eyebrow">Agent SDK run</p><h3>Run lifecycle</h3></div>{latestRun && <StatusPill status={latestRun.status} />}</header>
        {latestRun ? <dl className="inline-proof-list"><Metric label="run id" value={<code>{latestRun.id}</code>} /><Metric label="session" value={latestRun.sessionId ? <code>{latestRun.sessionId}</code> : "未报告"} /><Metric label="provider" value={latestRun.provider ?? "未报告"} /><Metric label="updated" value={formatTimestamp(latestRun.updatedAt)} /></dl> : <p>尚无运行。</p>}
        {latestRun?.errorMessage && <p className="run-error" role="alert"><strong>{latestRun.errorCode ?? "run error"}</strong>{redactSensitiveText(latestRun.errorMessage)}</p>}
        {latestRun?.blockingReasons.length ? <ul className="reason-list">{latestRun.blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
        <div className="button-row">
          <button type="button" className="button primary" disabled={busy || runActive} title={runActive ? "已有运行处于活跃状态" : undefined} onClick={() => request({ action: "start-run", title: "确认启动 Agent run", description: "服务器会在 central queue 中启动真实 Agent SDK run；不会由前端模拟状态。", confirmLabel: "启动 run", execute: async () => api.startRun(taskId) })}>启动 run</button>
          <button type="button" className="button secondary" disabled={busy || !latestRun || !runRecoverable} title={!latestRun ? "没有可恢复的 run" : !runRecoverable ? `状态 ${latestRun.status} 不允许恢复` : undefined} onClick={() => request({ action: "recover-run", title: "确认恢复 Agent run", description: `恢复 run ${latestRun?.id}。若 provider auth 仍阻塞，服务器应再次返回真实失败而非成功。`, confirmLabel: "恢复 run", execute: async () => api.recoverRun(taskId, latestRun?.id) })}>恢复 run</button>
          <button type="button" className="button danger" disabled={busy || !latestRun || !runActive} title={!latestRun || !runActive ? "没有可取消的活跃 run" : undefined} onClick={() => request({ action: "cancel-run", title: "确认取消 Agent run", description: `请求取消 run ${latestRun?.id}。终态以服务器 ledger event 为准。`, confirmLabel: "取消 run", tone: "danger", execute: async () => api.cancelRun(taskId, latestRun?.id) })}>取消 run</button>
        </div>
        <ul className="disabled-reasons" aria-label="Run 控件禁用原因">
          {runActive && <li>启动 run 已禁用：当前 run {latestRun?.id} 仍处于 {latestRun?.status}。</li>}
          {!latestRun && <li>恢复 / 取消已禁用：服务器未报告 run。</li>}
          {latestRun && !runRecoverable && <li>恢复已禁用：状态 {latestRun.status} 不在可恢复终态中。</li>}
          {latestRun && !runActive && <li>取消已禁用：没有活跃 run。</li>}
        </ul>
      </section>

      <section className="detail-block control-block review-controls">
        <header><div><p className="eyebrow">digest-bound review</p><h3>Review decision</h3></div>{reviewStale && <StatusPill status="stale" />}</header>
        <p>批准与拒绝都可记录 summary；决策绑定当前真实 diff digest。服务器若报告 stale，必须刷新后重新审批。</p>
        {reviewStale && <p className="stale-review-alert" role="alert">当前 approval 与 diff 不一致或服务器标记 stale。先到“Diff 审查”刷新，再提交新 review。</p>}
        <label className="field"><span>Review summary <span className="optional">可选</span></span><textarea rows={3} value={reviewSummary} onChange={(event) => setReviewSummary(event.target.value)} /></label>
        <p className="digest-line">当前 digest {diff?.digest ? <code>{diff.digest}</code> : <span className="missing-value">尚未加载或服务器未报告</span>}</p>
        <div className="button-row">
          <button type="button" className="button primary" data-testid="review-approve" disabled={busy || !diff?.digest} title={!diff?.digest ? "先加载带 digest 的真实 diff" : reviewStale ? "将为刷新后的当前 digest 创建新审批" : undefined} onClick={() => request({ action: "approve", title: reviewStale ? "重新批准刷新后的当前 diff" : "确认批准当前 diff", description: `批准 digest ${diff?.digest}。任何后续 diff 变化都必须使该 review stale。`, confirmLabel: reviewStale ? "重新批准当前 digest" : "批准当前 digest", execute: async () => api.submitReview(taskId, "approved", reviewSummary, diff?.digest ?? null) })}>{reviewStale ? "重新批准" : "批准"}</button>
          <button type="button" className="button danger" data-testid="review-reject" disabled={busy || !diff?.digest} title={!diff?.digest ? "先加载带 digest 的真实 diff" : undefined} onClick={() => request({ action: "reject", title: "确认拒绝当前 diff", description: `拒绝 digest ${diff?.digest}。随后可恢复 run 或 wilt 任务。`, confirmLabel: "拒绝当前 digest", tone: "danger", execute: async () => api.submitReview(taskId, "rejected", reviewSummary, diff?.digest ?? null) })}>拒绝</button>
        </div>
      </section>

      <section className="detail-block control-block harvest-controls">
        <header><div><p className="eyebrow">harvest gate</p><h3>Harvest evidence checklist</h3></div><StatusPill status={allEvidenceMet ? "approved" : "blocked"} label={allEvidenceMet ? "证据齐全" : "证据未齐"} /></header>
        <ul className="evidence-checklist">{evidence.map((item) => <li className={item.met ? "met" : "unmet"} key={item.label}><span className="check-mark" aria-hidden="true">{item.met ? "✓" : "×"}</span><div><strong>{item.label}</strong><p>{item.note}</p></div></li>)}</ul>
        <button type="button" className="button harvest-button" data-testid="harvest" disabled={busy || !allEvidenceMet} aria-describedby={!allEvidenceMet ? "harvest-disabled-reason" : undefined} onClick={() => request({ action: "harvest", title: "确认 harvest 到目标分支", description: `将以 digest ${diff?.digest} 请求真实 merge/harvest。服务器会再次检查并发 harvest、冲突、dirty/missing worktree 与 stale review。`, confirmLabel: "执行 harvest", execute: async () => api.harvestTask(taskId, diff?.digest ?? null) })}><span data-testid="harvest-btn">Harvest 到目标分支</span></button>
        {!allEvidenceMet && <p id="harvest-disabled-reason" className="disabled-reason">禁用：上方证据 checklist 尚未全部满足。以服务器 eligibility 与 structured error 为准。</p>}
      </section>

      <section className="detail-block control-block wilt-controls">
        <header><div><p className="eyebrow">terminal cleanup</p><h3>Wilt task</h3></div></header>
        <p>Wilt 可能清理 worktree/branch 并写入终态。必须记录确认，真实 cleanup 结果由 timeline 与 residual benchmark 验证。</p>
        <label className="field"><span>Reason <span className="optional">可选</span></span><textarea rows={2} value={wiltReason} onChange={(event) => setWiltReason(event.target.value)} /></label>
        <button type="button" className="button danger" data-testid="wilt" disabled={busy} onClick={() => request({ action: "wilt", title: "确认 wilt 任务", description: "该操作可能删除 worktree 与分支，且不可由前端撤销。完成后请运行 residual reconciliation 验证 cleanup proof。", confirmLabel: "确认 wilt", tone: "danger", execute: async () => api.wiltTask(taskId, wiltReason) })}><span data-testid="wilt-btn">Wilt 并请求清理</span></button>
      </section>
    </div>
  );
}

function ActionConfirmation({
  value,
  acting,
  error,
  onCancel,
  onConfirm,
}: {
  value: PendingConfirmation;
  acting: boolean;
  error: unknown;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
  }, [value.action]);
  return (
    <section className={cx("action-confirmation", value.tone === "danger" && "danger-confirmation")} role="alert" aria-labelledby="action-confirm-title" aria-describedby="action-confirm-description">
      <div className="confirmation-mark" aria-hidden="true">!</div>
      <div>
        <h3 id="action-confirm-title">{value.title}</h3>
        <p id="action-confirm-description">{value.description}</p>
        {error !== null && <ErrorNotice error={error} compact title="操作未完成" />}
        <div className="button-row">
          <button type="button" className="button ghost" onClick={onCancel} disabled={acting}>返回检查</button>
          <button ref={confirmRef} type="button" data-autofocus className={cx("button", value.tone === "danger" ? "danger" : "primary")} onClick={onConfirm} disabled={acting}>{acting ? "服务器处理中…" : value.confirmLabel}</button>
        </div>
      </div>
    </section>
  );
}

export function TaskInspector({ task, allTasks, open, onClose, onMutated }: Props) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailError, setDetailError] = useState<unknown>(null);
  const [tab, setTab] = useState<InspectorTab>("overview");
  const [diff, setDiff] = useState<DiffArtifact | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<unknown>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const confirmationReturnRef = useRef<HTMLElement | null>(null);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const [acting, setActing] = useState<ActionName | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const loadDetail = async (signal?: AbortSignal) => {
    if (!task) return;
    setLoading(true);
    setDetailError(null);
    try {
      setDetail(await api.getTask(task.id, signal));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setDetailError(error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const loadDiff = async () => {
    if (!task) return;
    setDiffLoading(true);
    setDiffError(null);
    try {
      setDiff(await api.getTaskDiff(task.id));
    } catch (error) {
      setDiffError(error);
    } finally {
      setDiffLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !task) return;
    const controller = new AbortController();
    setDetail(null);
    setDiff(null);
    setDiffError(null);
    setConfirmation(null);
    setActionError(null);
    setTab("overview");
    void loadDetail(controller.signal);
    return () => controller.abort();
  }, [open, task?.id]);

  useEffect(() => {
    if (!open || !task || (tab !== "diff" && tab !== "control") || diff || diffLoading || diffError) return;
    void loadDiff();
  }, [diff, diffError, diffLoading, open, tab, task?.id]);

  const requestConfirmation = (value: PendingConfirmation) => {
    confirmationReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmation(value);
    setActionError(null);
  };

  const cancelConfirmation = () => {
    const returnTarget = confirmationReturnRef.current;
    setConfirmation(null);
    setActionError(null);
    window.setTimeout(() => (returnTarget ?? tabsRef.current.find(Boolean))?.focus(), 0);
  };

  const performAction = async () => {
    if (!confirmation || !task) return;
    const completedAction = confirmation.action;
    setActing(completedAction);
    setActionError(null);
    try {
      await confirmation.execute();
    } catch (error) {
      setActionError(error);
      setActing(null);
      return;
    }

    const close = completedAction === "wilt";
    const returnTarget = confirmationReturnRef.current;
    setConfirmation(null);
    try {
      await onMutated(task.id, { close });
    } catch (error) {
      setDetailError(error);
    }
    if (!close) {
      await Promise.allSettled([loadDetail(), loadDiff()]);
      window.setTimeout(() => (returnTarget?.isConnected ? returnTarget : tabsRef.current.find(Boolean))?.focus(), 0);
    }
    setActing(null);
  };

  const tabs: Array<{ id: InspectorTab; label: string; testId?: string }> = [
    { id: "overview", label: "地块证据" },
    { id: "evidence", label: "影响 / overlap" },
    { id: "timeline", label: "Timeline" },
    { id: "diff", label: "Diff 审查" },
    { id: "control", label: "控制台" },
  ];

  return (
    <Dialog
      open={open && task !== null}
      title={task?.title || `Task ${shortId(task?.id)}`}
      description={task ? `${task.repoName ?? task.repoPath ?? "仓库未报告"} · central queue task ${task.id}` : undefined}
      onClose={confirmation ? cancelConfirmation : onClose}
      busy={acting !== null}
      testId="inspector"
      className="task-inspector"

      footer={confirmation ? (
        <span className="footer-sync-note">确认阶段已隔离其他控件；Escape 或关闭按钮会返回检查，不会关闭 inspector。</span>
      ) : (
        <>
          <span className="footer-sync-note">REST 操作成功后立即重拉；不等待 WS。</span>
          <button type="button" className="button ghost" onClick={onClose} disabled={acting !== null}>关闭 inspector</button>
        </>
      )}
    >
      {task && (
        <>
          <div
            aria-hidden={confirmation !== null ? "true" : undefined}
            style={{ display: confirmation !== null ? "none" : "contents" }}
          >
            <div className="inspector-tabs" role="tablist" aria-label="任务 inspector 视图" data-testid="diff-modal">
              {tabs.map((item, index) => (
                <button
                  ref={(element) => { tabsRef.current[index] = element; }}
                  type="button"
                  role="tab"
                  tabIndex={tab === item.id ? 0 : -1}
                  aria-selected={tab === item.id}
                  aria-controls="inspector-active-panel"
                  id={`inspector-tab-${item.id}`}
                  className={tab === item.id ? "active" : undefined}
                  onClick={() => { setTab(item.id); setActionError(null); }}
                  onKeyDown={(event) => {
                    let nextIndex: number | null = null;
                    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
                    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
                    if (event.key === "Home") nextIndex = 0;
                    if (event.key === "End") nextIndex = tabs.length - 1;
                    if (nextIndex !== null) {
                      event.preventDefault();
                      setTab(tabs[nextIndex].id);
                      tabsRef.current[nextIndex]?.focus();
                    }
                  }}
                  key={item.id}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {loading && !detail && <div className="inspector-loading" role="status" aria-busy="true"><span className="loader" aria-hidden="true" /><div><strong>读取 task detail</strong><p>加载 dependencies、claims、runs、artifacts、reviews、outcomes、timeline、eligibility 与 worktree health。</p></div></div>}
            {detailError !== null && !detail && <ErrorNotice error={detailError} onRetry={() => void loadDetail()} title="Task detail 加载失败" />}
            {detail && (
              <div role="tabpanel" id="inspector-active-panel" aria-labelledby={`inspector-tab-${tab}`} tabIndex={0} aria-busy={loading || diffLoading}>
                {loading && <div className="refreshing-detail" role="status"><span className="loader" aria-hidden="true" />正在刷新 detail；下方内容是上一份真实快照，操作暂时禁用。</div>}
                {detailError !== null && <ErrorNotice error={detailError} compact onRetry={() => void loadDetail()} title="刷新失败，保留上一个 detail" />}
                {tab === "overview" && <OverviewTab detail={detail} />}
                {tab === "evidence" && <EvidenceTab detail={detail} acting={loading ? "add-dependency" : acting} onRequestAction={requestConfirmation} />}
                {tab === "timeline" && <TimelineTab detail={detail} />}
                {tab === "diff" && <DiffTab detail={detail} diff={diff} loading={diffLoading} error={diffError} onReload={() => { setDiffError(null); void loadDiff(); }} />}
                {tab === "control" && <ControlTab detail={detail} allTasks={allTasks} diff={diff} acting={loading ? "add-dependency" : acting} onRequestAction={requestConfirmation} />}
              </div>
            )}
          </div>

          {confirmation && <ActionConfirmation value={confirmation} acting={acting !== null} error={actionError} onCancel={cancelConfirmation} onConfirm={() => void performAction()} />}
        </>
      )}
    </Dialog>
  );
}
