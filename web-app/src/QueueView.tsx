import { useMemo } from "react";
import type { TaskLane, TaskSummary } from "./api";
import { classifyTask } from "./api";
import {
  FoldedPath,
  Metric,
  StatusPill,
  cx,
  formatCount,
  formatDuration,
  formatMoney,
  formatRelativeTime,
  redactSensitiveText,
  formatTimestamp,
  shortId,
  statusLabel,
} from "./components";

export type QueueFilter = "all" | TaskLane;

interface Props {
  tasks: TaskSummary[];
  filter: QueueFilter;
  query: string;
  onFilterChange: (filter: QueueFilter) => void;
  onQueryChange: (query: string) => void;
  onInspect: (id: string) => void;
  onSeed: () => void;
}

interface TaskGroup {
  key: string;
  id: string | null;
  state: string | null;
  explicit: boolean;
  tasks: TaskSummary[];
}

function groupTasks(tasks: TaskSummary[]): TaskGroup[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const parent = new Map(tasks.map((task) => [task.id, task.id]));
  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string) => {
    if (!taskById.has(left) || !taskById.has(right)) return;
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  const firstByServerGroup = new Map<string, string>();
  for (const task of tasks) {
    if (task.groupId) {
      const first = firstByServerGroup.get(task.groupId);
      if (first) union(first, task.id);
      else firstByServerGroup.set(task.groupId, task.id);
    }
    for (const dependencyId of task.dependencyIds) union(dependencyId, task.id);
  }

  const componentTasks = new Map<string, TaskSummary[]>();
  for (const task of tasks) {
    const root = find(task.id);
    componentTasks.set(root, [...(componentTasks.get(root) ?? []), task]);
  }

  const groups = Array.from(componentTasks.values()).map((component): TaskGroup => {
    const serverIds = Array.from(new Set(component.map((task) => task.groupId).filter((id): id is string => Boolean(id))));
    const hasDependencyEdge = component.some((task) => task.dependencyIds.some((id) => taskById.has(id)));
    const explicit = serverIds.length > 0 || hasDependencyEdge;
    const derivedId = explicit ? `deps-${component.map((task) => shortId(task.id)).sort().join("-")}` : null;
    const id = serverIds.length === 1 ? serverIds[0] : derivedId;
    const states = Array.from(new Set(component.map((task) => task.groupState).filter((state): state is string => Boolean(state))));
    return {
      key: id ? `group:${id}` : `standalone:${component[0].id}`,
      id,
      state: states.length === 1 ? states[0] : states.length > 1 ? "mixed" : null,
      explicit,
      tasks: component,
    };
  });

  return groups.sort((a, b) => {
    if (a.explicit !== b.explicit) return a.explicit ? -1 : 1;
    const aTime = Math.max(...a.tasks.map((task) => new Date(task.lastActivityAt ?? task.updatedAt ?? task.createdAt ?? 0).getTime() || 0));
    const bTime = Math.max(...b.tasks.map((task) => new Date(task.lastActivityAt ?? task.updatedAt ?? task.createdAt ?? 0).getTime() || 0));
    return bTime - aTime;
  });
}

function safeTestId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function aggregate(tasks: TaskSummary[], field: "costUsd" | "numTurns" | "durationMs") {
  const reported = tasks.map((task) => task[field]).filter((value): value is number => value !== null && Number.isFinite(value));
  return {
    value: reported.length ? reported.reduce((sum, value) => sum + value, 0) : null,
    reported: reported.length,
    total: tasks.length,
  };
}

function GroupMetric({
  label,
  aggregateValue,
  formatter,
}: {
  label: string;
  aggregateValue: ReturnType<typeof aggregate>;
  formatter: (value: number | null) => string;
}) {
  if (aggregateValue.value === null) return null;
  return (
    <div className="group-metric">
      <span>{label}</span>
      <strong>{formatter(aggregateValue.value)}</strong>
      {aggregateValue.reported < aggregateValue.total && <small>{aggregateValue.reported}/{aggregateValue.total} tasks reported</small>}
    </div>
  );
}

function TaskCard({ task, onInspect }: { task: TaskSummary; onInspect: (id: string) => void }) {
  const lane = classifyTask(task);
  const title = task.title || `Task ${shortId(task.id)}`;
  const dependencyCount = task.dependencyCount;
  const claimCount = task.claimCount;
  return (
    <article
      className={cx("task-card", `task-lane-${lane}`, task.blockingReasons.length > 0 && "task-has-blockers")}
      data-testid={`task-card-${task.id}`}
      data-workspace-id={task.id}
    >
      <div className="plot-soil" aria-hidden="true" />
      <header className="task-card-header">
        <div className="task-number"><span>task</span><code>{shortId(task.id)}</code></div>
        <div className="pill-row"><StatusPill status={task.status} />{task.reviewStale && <StatusPill status="stale" />}</div>
      </header>
      <div className="task-card-title">
        <h3>{title}</h3>
        <p>{task.prompt ? redactSensitiveText(task.prompt) : <span className="missing-value">Prompt 未报告</span>}</p>
      </div>

      <dl className="task-facts">
        <Metric label="repo" value={task.repoName ?? (task.repoPath ? <FoldedPath value={task.repoPath} label="仓库路径" /> : "未报告")} />
        <Metric label="branch" value={task.branchName ? <code>{task.branchName}</code> : "未报告"} />
        <Metric label="worktree" value={<FoldedPath value={task.worktreePath} label="worktree 路径" />} />
        <Metric label="last activity" value={<span title={formatTimestamp(task.lastActivityAt)}>{formatRelativeTime(task.lastActivityAt)}</span>} />
      </dl>

      <div className="task-run-strip">
        {task.run ? (
          <>
            <div><span>agent run</span><strong><code>{shortId(task.run.id)}</code> · {statusLabel(task.run.status)}</strong></div>
            <div><span>session</span><strong>{task.run.sessionId ? <code>{shortId(task.run.sessionId, 12)}</code> : "未报告"}</strong></div>
          </>
        ) : <p className="missing-value">Agent run / session 未报告</p>}
      </div>

      <div className="task-evidence-counts" aria-label="关系与证据摘要">
        <span><strong>{dependencyCount === null ? "—" : dependencyCount}</strong> dependencies</span>
        <span><strong>{claimCount === null ? "—" : claimCount}</strong> claims</span>
        <span><strong>{task.diff?.changedPathCount ?? "—"}</strong> changed paths</span>
        <span><strong>{task.artifacts?.count ?? "—"}</strong> artifacts</span>
      </div>

      {(task.dependencyIds.length > 0 || task.claims.length > 0 || task.diff || task.artifacts) && (
        <section className="task-summary-evidence" aria-label="具体 dependency、claim、diff 与 artifact 摘要">
          {task.dependencyIds.length > 0 && <p><strong>depends on</strong> {task.dependencyIds.slice(0, 3).map((id) => <code key={id}>{shortId(id)}</code>)}{task.dependencyIds.length > 3 && <span> +{task.dependencyIds.length - 3}</span>}</p>}
          {task.claims.length > 0 && <p><strong>claims</strong> {task.claims.slice(0, 2).map((claim) => <span key={claim.id}><FoldedPath value={claim.path} label="claim 路径" /> <small>{claim.mode}</small></span>)}{task.claims.length > 2 && <span> +{task.claims.length - 2}</span>}</p>}
          {task.diff && <p><strong>diff</strong> <span>{task.diff.fileCount !== null ? `${task.diff.fileCount} files` : task.diff.changedPathCount !== null ? `${task.diff.changedPathCount} reported paths` : "path/file count 未报告"}</span>{task.diff.additions !== null && <span> +{task.diff.additions}</span>}{task.diff.deletions !== null && <span> −{task.diff.deletions}</span>}{task.diff.digest && <code>{shortId(task.diff.digest, 12)}</code>}</p>}
          {task.artifacts && <p><strong>artifacts</strong> <span>{task.artifacts.count === null ? "count 未报告" : task.artifacts.count}</span>{task.artifacts.types.slice(0, 3).map((type) => <code key={type}>{type}</code>)}{task.artifacts.latestDigest && <code>{shortId(task.artifacts.latestDigest, 12)}</code>}</p>}
        </section>
      )}

      {task.blockingReasons.length > 0 && (
        <section className="card-blockers" aria-label="Blocking 与 conflict 原因">
          <strong>不能 harvest</strong>
          <ul>{task.blockingReasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul>
          {task.blockingReasons.length > 3 && <p>另有 {task.blockingReasons.length - 3} 项，打开 inspector 查看。</p>}
        </section>
      )}

      <dl className="task-proof-row">
        <Metric label="cost" value={formatMoney(task.costUsd)} />
        <Metric label="turns" value={formatCount(task.numTurns)} />
        <Metric label="duration" value={formatDuration(task.durationMs)} />
      </dl>

      <footer className="task-card-footer">
        <div className="card-review-outcome">
          <span>review {task.reviewStatus ? <StatusPill status={task.reviewStatus} /> : <span className="missing-value">未报告</span>}</span>
          <span>outcome {task.outcomeStatus ? <StatusPill status={task.outcomeStatus} /> : <span className="missing-value">未报告</span>}</span>
        </div>
        <button
          type="button"
          className="button inspect-button"
          onClick={() => onInspect(task.id)}
          aria-label={`打开 ${title} inspector，查看为何能或不能 harvest`}
          data-testid={`plot-${task.status}`}
          data-inspector-testid={`inspect-task-${safeTestId(task.id)}`}
          data-status={task.status}
        >
          检查证据
          <span aria-hidden="true">→</span>
        </button>
      </footer>
    </article>
  );
}

function DependencyGroupCard({ group, onInspect }: { group: TaskGroup; onInspect: (id: string) => void }) {
  const cost = aggregate(group.tasks, "costUsd");
  const turns = aggregate(group.tasks, "numTurns");
  const duration = aggregate(group.tasks, "durationMs");
  const serverGroupReported = group.tasks.some((task) => task.groupId !== null);
  const groupLabel = group.explicit ? `Dependency group ${shortId(group.id, 12)}` : `Standalone task ${shortId(group.tasks[0]?.id)}`;
  const testId = group.id ?? `standalone-${group.tasks[0]?.id}`;
  return (
    <section className={cx("dependency-group", !group.explicit && "standalone-group")} data-testid={`group-${safeTestId(testId)}`}>
      <header className="group-header">
        <div className="channel-title">
          <span className="sluice-gate" aria-hidden="true" />
          <div>
            <p className="eyebrow">{group.explicit ? "explicit dependency group" : "no dependency group reported"}</p>
            <h2>{groupLabel}</h2>
            <p>{group.explicit ? (serverGroupReported ? "任务由服务器显式 group 投影连接；渠线不表示 agents 直接协作。" : "服务器未报告 group_id；这里只按显式 dependency edge 求连通组，不按时间或共同上游推断。") : "该任务没有 group_id 或显式 dependency edge；界面不会把它与其他任务推断成组。"}</p>
          </div>
        </div>
        <div className="group-status">
          {group.state ? <StatusPill status={group.state} /> : <span className="missing-value">组状态未报告</span>}
          <span>{group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"}</span>
        </div>
      </header>
      <div className="group-aggregate" aria-label="组真实汇总">
        <GroupMetric label="cost" aggregateValue={cost} formatter={formatMoney} />
        <GroupMetric label="turns" aggregateValue={turns} formatter={formatCount} />
        <GroupMetric label="duration" aggregateValue={duration} formatter={formatDuration} />
        {cost.value === null && turns.value === null && duration.value === null && <p className="missing-value">该组未报告 cost、turns 或 duration，不显示伪统计。</p>}
      </div>
      <div className="irrigation-channel" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${group.tasks.length}, minmax(0, 1fr))` }}>
        <span className="channel-main" />
        {group.tasks.map((task) => <span className="channel-branch" key={task.id} />)}
      </div>
      <div className="task-grid">
        {group.tasks.map((task) => <TaskCard task={task} onInspect={onInspect} key={task.id} />)}
      </div>
    </section>
  );
}

export function QueueView({ tasks, filter, query, onFilterChange, onQueryChange, onInspect, onSeed }: Props) {
  const laneCounts = useMemo(() => ({
    active: tasks.filter((task) => classifyTask(task) === "active").length,
    blocked: tasks.filter((task) => classifyTask(task) === "blocked").length,
    review: tasks.filter((task) => classifyTask(task) === "review").length,
    terminal: tasks.filter((task) => classifyTask(task) === "terminal").length,
  }), [tasks]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (filter !== "all" && classifyTask(task) !== filter) return false;
      if (!needle) return true;
      return [task.id, task.title, task.prompt, task.repoName, task.repoPath, task.branchName, task.worktreePath, task.status, ...task.blockingReasons]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [filter, query, tasks]);
  const groups = useMemo(() => groupTasks(filtered), [filtered]);
  const filters: Array<{ id: QueueFilter; label: string; count: number }> = [
    { id: "all", label: "全部", count: tasks.length },
    { id: "active", label: "Active", count: laneCounts.active },
    { id: "blocked", label: "Blocked", count: laneCounts.blocked },
    { id: "review", label: "Review", count: laneCounts.review },
    { id: "terminal", label: "Terminal", count: laneCounts.terminal },
  ];

  if (tasks.length === 0) {
    return (
      <section className="farm-empty" data-testid="plot-grid">
        <div className="empty-field" aria-hidden="true"><span className="empty-furrow" /><span className="empty-furrow" /><span className="empty-furrow" /></div>
        <div className="empty-copy">
          <p className="eyebrow">central queue is empty</p>
          <h2>没有任务地块，也没有伪统计</h2>
          <p>播种第一项真实任务。Repository 可以是 gitless；若运行前置不满足，服务器会把任务创建为 blocked 并给出原因。</p>
          <button type="button" className="button primary seed-large" onClick={onSeed} data-testid="plot-empty">播种第一项任务</button>
        </div>
      </section>
    );
  }

  return (
    <section className="queue-view" aria-labelledby="queue-title">
      <header className="view-heading queue-heading">
        <div>
          <p className="eyebrow">all tasks · no fixed plot limit</p>
          <h2 id="queue-title">Central queue 地块账</h2>
          <p>全部任务按服务器显式 dependency group 展示；未分组任务保持独立，不按时间或共同上游推断关系。</p>
        </div>
        <button type="button" className="button primary" onClick={onSeed}>播种任务</button>
      </header>

      <div className="queue-controls">
        <div className="filter-tabs" role="group" aria-label="任务状态筛选">
          {filters.map((item) => <button type="button" className={filter === item.id ? "active" : undefined} aria-pressed={filter === item.id} onClick={() => onFilterChange(item.id)} key={item.id}><span>{item.label}</span><strong>{item.count}</strong></button>)}
        </div>
        <label className="queue-search"><span className="sr-only">搜索任务、仓库、路径或阻塞原因</span><input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索 task / repo / path / blocker" /></label>
      </div>

      <p className="result-count" role="status">显示 {filtered.length} / {tasks.length} 项真实任务</p>
      {groups.length ? (
        <div className="group-list" data-testid="plot-grid">
          {groups.map((group) => <DependencyGroupCard group={group} onInspect={onInspect} key={group.key} />)}
        </div>
      ) : (
        <section className="filtered-empty">
          <h3>没有符合当前筛选的任务</h3>
          <p>任务没有被隐藏或删除；清除状态筛选或搜索词即可浏览全部 {tasks.length} 项。</p>
          <button type="button" className="button secondary" onClick={() => { onFilterChange("all"); onQueryChange(""); }}>清除筛选</button>
        </section>
      )}
    </section>
  );
}
