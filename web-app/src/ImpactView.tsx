import { useMemo } from "react";
import type {
  AuditProvenance,
  OverlapEvidence,
  TaskDetail,
  TaskLink,
  TaskSummary,
} from "./api";
import {
  ErrorNotice,
  FoldedPath,
  Provenance,
  StatusPill,
  cx,
  formatTimestamp,
  shortId,
} from "./components";

interface Props {
  tasks: TaskSummary[];
  details: Map<string, TaskDetail>;
  errors: Map<string, unknown>;
  loading: boolean;
  onReload: () => void;
  onInspect: (taskId: string) => void;
}

interface DependencyEdge {
  key: string;
  sourceId: string;
  targetId: string;
  edgeId: string | null;
  provenance: AuditProvenance;
}

const EMPTY_PROVENANCE: AuditProvenance = {
  eventId: null,
  seq: null,
  kind: null,
  source: null,
  recordedAt: null,
  digest: null,
};

function buildEdges(tasks: TaskSummary[], details: Map<string, TaskDetail>): DependencyEdge[] {
  const edges = new Map<string, DependencyEdge>();
  for (const target of tasks) {
    const detail = details.get(target.id);
    const dependencies: TaskLink[] = detail?.dependencies ?? target.dependencyIds.map((taskId) => ({
      edgeId: null,
      taskId,
      title: null,
      status: null,
      provenance: EMPTY_PROVENANCE,
    }));
    for (const dependency of dependencies) {
      const key = `${dependency.taskId}->${target.id}`;
      const candidate: DependencyEdge = {
        key,
        sourceId: dependency.taskId,
        targetId: target.id,
        edgeId: dependency.edgeId,
        provenance: dependency.provenance,
      };
      const existing = edges.get(key);
      const candidateHasAudit = candidate.provenance.eventId || candidate.provenance.seq !== null;
      const existingHasAudit = existing?.provenance.eventId || existing?.provenance.seq !== null;
      if (!existing || (candidateHasAudit && !existingHasAudit)) edges.set(key, candidate);
    }
  }
  return Array.from(edges.values());
}

function buildOverlaps(details: Map<string, TaskDetail>, currentTaskIds: Set<string>): OverlapEvidence[] {
  const overlaps = new Map<string, OverlapEvidence>();
  for (const [detailTaskId, detail] of details) {
    if (!currentTaskIds.has(detailTaskId)) continue;
    for (const evidence of detail.overlaps) {
      if (!currentTaskIds.has(evidence.leftTaskId) || !currentTaskIds.has(evidence.rightTaskId)) continue;
      const existing = overlaps.get(evidence.id);
      const currentHasAudit = evidence.provenance.eventId || evidence.provenance.seq !== null;
      const existingHasAudit = existing?.provenance.eventId || existing?.provenance.seq !== null;
      if (!existing || (currentHasAudit && !existingHasAudit)) overlaps.set(evidence.id, evidence);
    }
  }
  return Array.from(overlaps.values()).sort((a, b) => (b.detectedAt ?? "").localeCompare(a.detectedAt ?? ""));
}

function taskDepths(tasks: TaskSummary[], edges: DependencyEdge[]): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const task of tasks) incoming.set(task.id, []);
  for (const edge of edges) incoming.set(edge.targetId, [...(incoming.get(edge.targetId) ?? []), edge.sourceId]);
  const memo = new Map<string, number>();
  const visit = (id: string, trail: Set<string>): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (trail.has(id)) return 0;
    const nextTrail = new Set(trail).add(id);
    const parents = incoming.get(id) ?? [];
    const depth = parents.length ? Math.max(...parents.map((parent) => visit(parent, nextTrail))) + 1 : 0;
    memo.set(id, depth);
    return depth;
  };
  tasks.forEach((task) => visit(task.id, new Set()));
  return memo;
}

function NetworkFigure({
  tasks,
  edges,
  overlaps,
  onInspect,
}: {
  tasks: TaskSummary[];
  edges: DependencyEdge[];
  overlaps: OverlapEvidence[];
  onInspect: (id: string) => void;
}) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const depths = taskDepths(tasks, edges);
  const levels = new Map<number, TaskSummary[]>();
  for (const task of tasks) {
    const depth = depths.get(task.id) ?? 0;
    levels.set(depth, [...(levels.get(depth) ?? []), task]);
  }
  levels.forEach((levelTasks) => levelTasks.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "")));
  const maxDepth = Math.max(0, ...Array.from(levels.keys()));
  const maxRows = Math.max(1, ...Array.from(levels.values()).map((level) => level.length));
  const width = Math.max(800, (maxDepth + 1) * 250 + 100);
  const height = Math.max(360, maxRows * 116 + 100);
  const positions = new Map<string, { x: number; y: number }>();
  for (const [depth, levelTasks] of levels) {
    const columnX = 80 + depth * ((width - 160) / Math.max(1, maxDepth));
    const step = (height - 100) / Math.max(1, levelTasks.length);
    levelTasks.forEach((task, index) => positions.set(task.id, { x: columnX, y: 60 + step * (index + 0.5) }));
  }

  return (
    <figure className="network-figure" aria-labelledby="network-title network-desc">
      <figcaption>
        <div><h3 id="network-title">灌溉渠 / 根系证据图</h3><p id="network-desc">箭头实线从 dependency 指向依赖它的任务；虚线只标出 overlap evidence。图下方表格提供完整等价信息。</p></div>
        <div className="network-legend" aria-label="图例">
          <span><i className="legend-line dependency-line" aria-hidden="true" />显式 dependency</span>
          <span><i className="legend-line evidence-line" aria-hidden="true" />overlap evidence</span>
        </div>
      </figcaption>
      <div className="network-scroll" tabIndex={0} aria-label="可横向滚动的影响图">
        <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
          <defs>
            <marker id="dependency-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="dependency-arrow" />
            </marker>
            <pattern id="overlap-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" className="overlap-hatch-line" />
            </pattern>
          </defs>
          <g className="dependency-edges" aria-label="显式 dependencies">
            {edges.map((edge) => {
              const source = positions.get(edge.sourceId);
              const target = positions.get(edge.targetId);
              if (!source || !target) return null;
              const startX = source.x + 82;
              const endX = target.x - 82;
              const control = Math.max(40, Math.abs(endX - startX) * 0.45);
              return (
                <path
                  key={edge.key}
                  d={`M ${startX} ${source.y} C ${startX + control} ${source.y}, ${endX - control} ${target.y}, ${endX} ${target.y}`}
                  className="network-edge dependency-edge"
                  markerEnd="url(#dependency-arrow)"
                >
                  <title>{`${taskMap.get(edge.sourceId)?.title || shortId(edge.sourceId)} 是 ${taskMap.get(edge.targetId)?.title || shortId(edge.targetId)} 的显式 dependency；source audit ${edge.provenance.eventId ?? (edge.provenance.seq !== null ? `seq ${edge.provenance.seq}` : "未报告")}`}</title>
                </path>
              );
            })}
          </g>
          <g className="overlap-edges" aria-label="Overlap evidence">
            {overlaps.map((evidence) => {
              const left = positions.get(evidence.leftTaskId);
              const right = positions.get(evidence.rightTaskId);
              if (!left || !right) return null;
              return (
                <path
                  key={evidence.id}
                  d={`M ${left.x} ${left.y + 28} Q ${(left.x + right.x) / 2} ${(left.y + right.y) / 2 + 58}, ${right.x} ${right.y + 28}`}
                  className={cx("network-edge overlap-edge", `severity-${evidence.severity}`)}
                >
                  <title>{`${evidence.type} overlap：${evidence.path ?? "路径未报告"}。这不是 dependency 或协作。`}</title>
                </path>
              );
            })}
          </g>
          <g className="network-nodes">
            {tasks.map((task) => {
              const position = positions.get(task.id);
              if (!position) return null;
              const title = task.title || `Task ${shortId(task.id)}`;
              return (
                <g
                  className="network-node"
                  key={task.id}
                  transform={`translate(${position.x - 82}, ${position.y - 34})`}
                >
                  <rect width="164" height="68" rx="7" className={`node-${task.status}`} />
                  <text x="12" y="25" className="node-title">{title.length > 20 ? `${title.slice(0, 19)}…` : title}</text>
                  <text x="12" y="48" className="node-meta">{shortId(task.id)} · {task.status}</text>
                  <title>{`${title} · ${task.status} · 点击打开 inspector`}</title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="network-node-controls" aria-label="影响图任务节点操作">
        {tasks.map((task) => (
          <button type="button" className="button ghost compact" onClick={() => onInspect(task.id)} key={task.id}>
            <span>{task.title || `Task ${shortId(task.id)}`}</span>
            <StatusPill status={task.status} />
          </button>
        ))}
      </div>
    </figure>
  );
}

export function ImpactView({ tasks, details, errors, loading, onReload, onInspect }: Props) {
  const edges = useMemo(() => buildEdges(tasks, details), [details, tasks]);
  const currentTaskIds = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks]);
  const overlaps = useMemo(() => buildOverlaps(details, currentTaskIds), [currentTaskIds, details]);
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  return (
    <section className="impact-view" aria-labelledby="impact-title">
      <header className="view-heading">
        <div>
          <p className="eyebrow">audit-grade lineage & evidence</p>
          <h2 id="impact-title">影响图 / 证据渠</h2>
          <p>调度始终经过 central queue。这里不宣称 P2P、swarm 或 agents 直接协作。</p>
        </div>
        <button type="button" className="button secondary" onClick={onReload} disabled={loading}>
          {loading ? "正在读取 task details…" : "刷新全部证据"}
        </button>
      </header>

      <section className="semantic-contract" aria-label="关系语义规则">
        <div className="contract-item dependency-contract">
          <span className="contract-mark" aria-hidden="true" />
          <div><strong>实线 = 显式 dependency</strong><p>必须来自任务关系及其 source audit event/provenance。</p></div>
        </div>
        <div className="contract-item evidence-contract">
          <span className="contract-mark" aria-hidden="true" />
          <div><strong>虚线 / 警示纹 = overlap evidence</strong><p>claim、magnet 或 diff 路径证据；不是 dependency，也不等于协作。</p></div>
        </div>
        <div className="contract-item negative-contract">
          <span className="contract-mark" aria-hidden="true">≠</span>
          <div><strong>共同上游 / 时间共现 ≠ 协作</strong><p>没有显式依赖事件，就不绘制 dependency 实线。</p></div>
        </div>
      </section>

      {loading && <div className="inline-loading" role="status"><span className="loader" aria-hidden="true" />读取每个任务的真实 detail 与 provenance…</div>}
      {errors.size > 0 && (
        <section className="partial-errors" aria-labelledby="detail-errors-title">
          <h3 id="detail-errors-title">部分 task detail 未加载</h3>
          <p>对应边只会显示列表端已知的显式 ID；provenance 会标为 API 未报告，不会推断。</p>
          {Array.from(errors.entries()).map(([taskId, error]) => <ErrorNotice key={taskId} error={error} compact title={`Task ${shortId(taskId)} detail 加载失败`} />)}
        </section>
      )}

      {tasks.length > 0 ? (
        <NetworkFigure tasks={tasks} edges={edges} overlaps={overlaps} onInspect={onInspect} />
      ) : (
        <section className="surface empty-inline"><p>没有任务，因此没有可审计关系。</p></section>
      )}

      <section className="evidence-register" aria-labelledby="dependency-register-title">
        <header><div><p className="eyebrow">solid channels</p><h3 id="dependency-register-title">显式 dependency lineage</h3></div><span className="register-count">{edges.length}</span></header>
        {edges.length ? (
          <div className="edge-table-wrap">
            <table className="edge-table">
              <thead><tr><th scope="col">Dependency</th><th scope="col">影响任务</th><th scope="col">Edge</th><th scope="col">Source audit event / provenance</th><th scope="col">操作</th></tr></thead>
              <tbody>
                {edges.map((edge) => (
                  <tr key={edge.key}>
                    <td><strong>{taskMap.get(edge.sourceId)?.title || `Task ${shortId(edge.sourceId)}`}</strong><code>{edge.sourceId}</code></td>
                    <td><strong>{taskMap.get(edge.targetId)?.title || `Task ${shortId(edge.targetId)}`}</strong><code>{edge.targetId}</code></td>
                    <td>{edge.edgeId ? <code>{edge.edgeId}</code> : <span className="missing-value">edge id 未报告</span>}</td>
                    <td><Provenance value={edge.provenance} compact /></td>
                    <td><button type="button" className="button ghost compact" onClick={() => onInspect(edge.targetId)}>Inspector</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="registry-empty">当前没有显式 dependency；不会根据时间或共同上游自动连线。</p>}
      </section>

      <section className="evidence-register overlap-register" aria-labelledby="overlap-register-title" data-testid="overlap-evidence">
        <header><div><p className="eyebrow">dashed evidence paths</p><h3 id="overlap-register-title">Overlap evidence register</h3></div><span className="register-count">{overlaps.length}</span></header>
        {overlaps.length ? (
          <ul className="overlap-list">
            {overlaps.map((evidence) => (
              <li className={`overlap-record severity-${evidence.severity}`} key={evidence.id} data-testid={`overlap-evidence-${evidence.id}`}>
                <div className="overlap-spine" aria-hidden="true" />
                <div className="overlap-main">
                  <header>
                    <div><p className="eyebrow">{evidence.type}</p><h4>{evidence.path ? <FoldedPath value={evidence.path} /> : "路径未报告"}</h4></div>
                    <div className="pill-row"><StatusPill status={evidence.severity} /><StatusPill status={evidence.status} /></div>
                  </header>
                  <dl className="overlap-fields">
                    <div><dt>双方任务</dt><dd><button type="button" className="text-button" onClick={() => onInspect(evidence.leftTaskId)}>{taskMap.get(evidence.leftTaskId)?.title || shortId(evidence.leftTaskId)}</button><span aria-hidden="true"> ↔ </span><button type="button" className="text-button" onClick={() => onInspect(evidence.rightTaskId)}>{taskMap.get(evidence.rightTaskId)?.title || shortId(evidence.rightTaskId)}</button></dd></div>
                    <div><dt>detected</dt><dd>{formatTimestamp(evidence.detectedAt)}</dd></div>
                    <div><dt>resolution</dt><dd>{evidence.resolution ?? (evidence.status === "resolved" ? "已解决，说明未报告" : "尚未解决")}</dd></div>
                    <div><dt>resolved at</dt><dd>{formatTimestamp(evidence.resolvedAt)}</dd></div>
                  </dl>
                  <Provenance value={evidence.provenance} />
                  <div className="record-actions"><p>该证据不表示 dependency 或协作。</p><button type="button" className="button secondary compact" onClick={() => onInspect(evidence.leftTaskId)}>打开 inspector 处理</button></div>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="registry-empty">已加载的 task details 没有 overlap evidence；这不自动证明任务无冲突，仍以服务器检测与 residual artifact 为准。</p>}
      </section>
    </section>
  );
}
