import type { ResidualCategory, ResidualHealth } from "./api";
import {
  ErrorNotice,
  FoldedPath,
  Metric,
  Provenance,
  SafeJson,
  StatusPill,
  formatCount,
  formatMoney,
  formatTimestamp,
  redactSensitiveText,
  shortId,
  statusTone,
} from "./components";

const CATEGORY_LABELS: Record<ResidualCategory, { label: string; explanation: string }> = {
  orphan_worktree: { label: "Orphan worktree", explanation: "磁盘 worktree 没有对应的活跃投影。" },
  orphan_run: { label: "Orphan run", explanation: "Agent run 没有可解析的 task 归属。" },
  dangling_task: { label: "Dangling task", explanation: "任务引用的运行、仓库或 worktree 已断开。" },
  double_terminal: { label: "Double terminal", explanation: "同一任务存在互相冲突的终态证据。" },
  review_merge_mismatch: { label: "Review / merge mismatch", explanation: "审批 digest 与实际 merge 证据不一致。" },
  stale_run: { label: "Stale run", explanation: "运行超过后端基准时间仍未产生终态。" },
  cost_event_mismatch: { label: "Cost / event mismatch", explanation: "成本投影与 ledger event 汇总不一致。" },
};

interface Props {
  artifact: ResidualHealth | null;
  loading: boolean;
  running: boolean;
  error: unknown;
  onRetry: () => void;
  onRun: () => void;
}

export function ResidualHealthPanel({ artifact, loading, running, error, onRetry, onRun }: Props) {
  if (loading && !artifact) {
    return (
      <section className="surface loading-panel" aria-busy="true" data-testid="residual-health">
        <span className="loader" aria-hidden="true" />
        <div><strong>读取最新 reconciliation artifact</strong><p>数字只会来自版本化 benchmark 扫描。</p></div>
      </section>
    );
  }

  if (error && !artifact) {
    return <ErrorNotice error={error} onRetry={onRetry} title="无法读取 residual health" />;
  }

  if (!artifact) {
    return (
      <section className="surface residual-empty" data-testid="residual-health">
        <div className="empty-mark" aria-hidden="true">∅</div>
        <div>
          <p className="eyebrow">residual reconciliation</p>
          <h2>还没有真实 benchmark artifact</h2>
          <p>GET 返回 404 表示尚未扫描，不等于 0 项。运行 reconciliation 后，才会显示真实 residual 数量和 provider proof。</p>
          <button type="button" className="button primary" onClick={onRun} disabled={running}>
            {running ? "正在扫描 SQLite、git 与 Agent SDK 投影…" : "运行真实 reconciliation"}
          </button>
        </div>
      </section>
    );
  }

  const providerStatus = artifact.providerProof?.status ?? "not_reported";
  const providerBlocked = providerStatus === "blocked";
  const providerVerified = providerStatus === "verified";
  const isRealZero = artifact.summary.total === 0;
  const blockingCount = artifact.summary.bySeverity.blocking;

  return (
    <section className="residual-panel" data-testid="residual-health" aria-labelledby="residual-title">
      <header className="view-heading residual-heading">
        <div>
          <p className="eyebrow">versioned benchmark artifact</p>
          <h2 id="residual-title">Residual health / 农场残留账</h2>
          <p>由服务器 reconciliation 扫描生成；不是前端推断，也不是固定统计。</p>
        </div>
        <button type="button" className="button secondary" onClick={onRun} disabled={running}>
          {running ? "重新扫描中…" : "重新运行 reconciliation"}
        </button>
      </header>

      {error !== null && <ErrorNotice error={error} onRetry={onRetry} compact title="最近一次刷新失败，保留上一个真实 artifact" />}

      <section className="surface artifact-ledger">
        <div className="artifact-stamp" aria-label={`schema ${artifact.schemaVersion}`}>
          <span>artifact</span>
          <strong>{shortId(artifact.artifactId, 12)}</strong>
        </div>
        <dl className="artifact-metrics">
          <Metric label="schema version" value={<code>{artifact.schemaVersion}</code>} />
          <Metric label="generated" value={formatTimestamp(artifact.generatedAt)} />
          <Metric label="SHA-256" value={artifact.artifactDigest ? <code>{artifact.artifactDigest}</code> : <span className="missing-value">未报告</span>} />
          <Metric label="ledger range" value={artifact.ledger.firstSeq !== null && artifact.ledger.lastSeq !== null ? `${artifact.ledger.firstSeq} → ${artifact.ledger.lastSeq}` : "未报告"} />
          <Metric label="ledger events" value={formatCount(artifact.ledger.eventCount)} />
          <Metric label="scope" value={`${formatCount(artifact.scope.repositoryIds.length)} repos · ${formatCount(artifact.scope.taskIds.length)} tasks`} />
        </dl>
        <Provenance value={artifact.provenance} />
      </section>

      <section className={`provider-proof provider-${statusTone(providerStatus)}`} role={providerBlocked ? "alert" : undefined}>
        <div className="provider-proof-title">
          <span className="proof-seal" aria-hidden="true">{providerVerified ? "✓" : "!"}</span>
          <div>
            <p className="eyebrow">provider proof / real E2E</p>
            <h3>{providerVerified ? "Provider 已真实验证" : providerBlocked ? "Provider auth blocked：真实 E2E 被阻塞" : "Provider E2E 未运行或未报告"}</h3>
          </div>
          <StatusPill status={providerStatus} />
        </div>
        {artifact.providerProof ? (
          <dl className="inline-proof-list">
            <Metric label="reason" value={artifact.providerProof.reason ?? "未报告"} />
            <Metric label="run ids" value={artifact.providerProof.runIds.length ? artifact.providerProof.runIds.map((id) => <code key={id}>{id} </code>) : "未报告"} />
            <Metric label="cost" value={formatMoney(artifact.providerProof.costUsd)} />
          </dl>
        ) : (
          <p>Artifact 未包含 provider_proof。界面不会把此状态标为成功。</p>
        )}
      </section>

      {isRealZero ? (
        <section className="surface real-zero" role="status">
          <span className="real-zero-value">0</span>
          <div>
            <h3>真实扫描未发现 residual</h3>
            <p>该 0 来自 artifact <code>{shortId(artifact.artifactId, 12)}</code> 的 <code>summary.total</code>，生成于 {formatTimestamp(artifact.generatedAt)}。</p>
          </div>
        </section>
      ) : (
        <section className="residual-summary" aria-label="Residual 汇总">
          <div className="summary-total">
            <span>total</span>
            <strong>{formatCount(artifact.summary.total)}</strong>
          </div>
          <div className="summary-severity">
            {Object.keys(artifact.summary.bySeverity).length ? Object.entries(artifact.summary.bySeverity).map(([severity, count]) => (
              <div key={severity}><StatusPill status={severity} /><strong>{formatCount(count)}</strong></div>
            )) : <span className="missing-value">by_severity 未报告</span>}
          </div>
          {blockingCount !== undefined && blockingCount > 0 && <p className="blocking-callout">存在 {blockingCount} 项 blocking residual；相关 task 不应 harvest。</p>}
        </section>
      )}

      <div className="residual-category-grid">
        {artifact.categories.map((category) => {
          const meta = CATEGORY_LABELS[category.category];
          return (
            <section className="surface residual-category" key={category.category}>
              <header>
                <div><h3>{meta.label}</h3><p>{meta.explanation}</p></div>
                <span className="category-count" aria-label={`${meta.label} 数量`}>
                  {category.reportedCount === null ? "未报告" : formatCount(category.reportedCount)}
                </span>
              </header>
              {category.issues.length > 0 ? (
                <ul className="residual-issues">
                  {category.issues.map((issue, index) => (
                    <li key={issue.id ?? `${category.category}-${index}`}>
                      <div className="issue-heading">
                        <StatusPill status={issue.severity} />
                        <strong>{redactSensitiveText(issue.message)}</strong>
                      </div>
                      <dl className="issue-fields">
                        {issue.taskId && <Metric label="task" value={<code>{issue.taskId}</code>} />}
                        {issue.runId && <Metric label="run" value={<code>{issue.runId}</code>} />}
                        {issue.repositoryId && <Metric label="repository" value={<code>{issue.repositoryId}</code>} />}
                        {issue.sourceEventSeq !== null && <Metric label="source seq" value={<code>{issue.sourceEventSeq}</code>} />}
                        <Metric label="detected" value={formatTimestamp(issue.detectedAt)} />
                        {issue.worktreePath && <Metric label="worktree" value={<FoldedPath value={issue.worktreePath} label="worktree 路径" />} />}
                      </dl>
                      {issue.remediation && <p className="remediation"><strong>可操作修复：</strong>{redactSensitiveText(issue.remediation)}</p>}
                      <Provenance value={issue.provenance} />
                      {issue.details && <details><summary>evidence（secret 字段已剔除）</summary><SafeJson value={issue.details} /></details>}
                    </li>
                  ))}
                </ul>
              ) : category.reportedCount === 0 ? (
                <p className="category-zero">扫描报告 0 项 · {formatTimestamp(artifact.generatedAt)}</p>
              ) : (
                <p className="missing-value">Artifact 没有该类别明细；不能推断为 0。</p>
              )}
            </section>
          );
        })}
      </div>

      <section className="surface cleanup-proof">
        <header><div><p className="eyebrow">cleanup proof</p><h3>Worktree 路径核对</h3></div></header>
        {artifact.cleanupProof ? (
          <div className="cleanup-columns">
            <div><h4>Checked paths · {artifact.cleanupProof.checkedPaths.length}</h4>{artifact.cleanupProof.checkedPaths.length ? <ul>{artifact.cleanupProof.checkedPaths.map((path) => <li key={path}><FoldedPath value={path} /></li>)}</ul> : <p className="empty-inline">Artifact 报告已核对 0 条路径。</p>}</div>
            <div><h4>Remaining paths · {artifact.cleanupProof.remainingPaths.length}</h4>{artifact.cleanupProof.remainingPaths.length ? <ul>{artifact.cleanupProof.remainingPaths.map((path) => <li key={path}><FoldedPath value={path} /></li>)}</ul> : <p className="empty-inline">Artifact 报告剩余 0 条路径。</p>}</div>
          </div>
        ) : <p className="missing-value">Artifact 未包含 cleanup_proof，不能声称清理已验证。</p>}
      </section>
    </section>
  );
}
