import { useMemo, useRef, useState } from "react";
import * as api from "./api";
import type { TaskSummary } from "./api";
import { Dialog, ErrorNotice, FoldedPath, StatusPill, cx, safeStorageGet, safeStorageSet, shortId } from "./components";

interface ClaimDraft {
  key: number;
  path: string;
  mode: string;
}

interface SeedDialogProps {
  open: boolean;
  tasks: TaskSummary[];
  onClose: () => void;
  onCreated: (created: api.TaskDetail | TaskSummary) => Promise<void> | void;
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return Array.from(repeated);
}

export function SeedDialog({ open, tasks, onClose, onCreated }: SeedDialogProps) {
  const [repoPath, setRepoPath] = useState(() => safeStorageGet("agent-farm.last-repo") ?? "");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [dependencyIds, setDependencyIds] = useState<string[]>([]);
  const [dependencySearch, setDependencySearch] = useState("");
  const [claimRows, setClaimRows] = useState<ClaimDraft[]>([{ key: 1, path: "", mode: "" }]);
  const [nextClaimKey, setNextClaimKey] = useState(2);
  const [magnetText, setMagnetText] = useState("");
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const validationRef = useRef<HTMLElement>(null);

  const repoInvalid = clientErrors.some((error) => error.includes("repository path") || error.includes("NUL"));
  const promptInvalid = clientErrors.some((error) => error.includes("任务 prompt") || error.includes("NUL"));
  const claimsInvalid = clientErrors.some((error) => error.includes("claim"));
  const magnetsInvalid = clientErrors.some((error) => error.includes("magnet"));

  const visibleTasks = useMemo(() => {
    const needle = dependencySearch.trim().toLowerCase();
    if (!needle) return tasks;
    return tasks.filter((task) =>
      [task.id, task.title, task.prompt, task.repoName, task.repoPath]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [dependencySearch, tasks]);

  const reset = () => {
    setTitle("");
    setPrompt("");
    setDependencyIds([]);
    setDependencySearch("");
    setClaimRows([{ key: 1, path: "", mode: "" }]);
    setNextClaimKey(2);
    setMagnetText("");
    setClientErrors([]);
    setServerError(null);
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const validate = () => {
    const errors: string[] = [];
    const trimmedRepo = repoPath.trim();
    const trimmedPrompt = prompt.trim();
    const activeClaims = claimRows.filter((row) => row.path.trim() || row.mode.trim());
    const claimPaths = activeClaims.map((row) => row.path.trim());
    const magnets = lines(magnetText);

    if (!trimmedRepo) errors.push("repository path 必填；可以是 gitless 路径，服务器会把真实原因投影为 blocked。");
    if (!trimmedPrompt) errors.push("任务 prompt 必填。");
    if (trimmedRepo.includes("\0") || trimmedPrompt.includes("\0")) errors.push("输入不能包含 NUL 字符。");
    activeClaims.forEach((row, index) => {
      if (!row.path.trim()) errors.push(`第 ${index + 1} 条 claim 缺少 path。`);
      if (!row.mode.trim()) errors.push(`第 ${index + 1} 条 claim 缺少 mode；请输入服务端支持的原文。`);
      if (row.path.includes("\0") || row.mode.includes("\0")) errors.push(`第 ${index + 1} 条 claim 包含无效 NUL 字符。`);
    });
    const duplicateClaims = duplicates(claimPaths);
    if (duplicateClaims.length > 0) errors.push(`claim path 重复：${duplicateClaims.join("、")}`);
    const duplicateMagnets = duplicates(magnets);
    if (duplicateMagnets.length > 0) errors.push(`magnet path 重复：${duplicateMagnets.join("、")}`);
    if (dependencyIds.length !== new Set(dependencyIds).size) errors.push("dependency 选择存在重复项。");

    return {
      errors,
      input: {
        repoPath: trimmedRepo,
        prompt: trimmedPrompt,
        title: title.trim() || undefined,
        dependencies: dependencyIds,
        claims: activeClaims.map((row) => ({ path: row.path.trim(), mode: row.mode.trim() })),
        magnetPaths: magnets,
      } satisfies api.CreateTaskInput,
    };
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = validate();
    setClientErrors(result.errors);
    setServerError(null);
    if (result.errors.length > 0) {
      window.setTimeout(() => validationRef.current?.focus(), 0);
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createTask(result.input);
      safeStorageSet("agent-farm.last-repo", result.input.repoPath);
      await onCreated(created);
      reset();
      onClose();
    } catch (error) {
      setServerError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="向 central queue 播种任务"
      description="创建记录会进入服务器中央队列；依赖、claim 与 magnet 是显式调度输入，不表示 agents 之间直接协作。"
      onClose={close}
      busy={submitting}
      testId="seed-dialog"
      className="seed-dialog"
      footer={
        <>
          <button type="button" className="button ghost" onClick={close} disabled={submitting}>取消</button>
          <button type="submit" form="seed-task-form" className="button primary" disabled={submitting} data-testid="plant-btn">
            {submitting ? "正在写入 central queue…" : "创建并进入队列"}
          </button>
        </>
      }
    >
      <form id="seed-task-form" className="form-stack" onSubmit={submit} noValidate>
        {clientErrors.length > 0 && (
          <section ref={validationRef} className="validation-errors" role="alert" aria-labelledby="seed-validation-title" id="seed-validation-errors" tabIndex={-1}>
            <h3 id="seed-validation-title">请先修正这些输入</h3>
            <ul>{clientErrors.map((error) => <li key={error}>{error}</li>)}</ul>
          </section>
        )}
        {serverError !== null && <ErrorNotice error={serverError} title="服务器拒绝创建任务" />}

        <fieldset className="form-section">
          <legend>任务与仓库</legend>
          <p className="field-help">gitless 路径仍会提交；若不能运行，服务器必须返回并投影真实 blocking reason。</p>
          <label className="field">
            <span>Repository path <span aria-hidden="true">*</span></span>
            <input
              data-autofocus
              data-testid="repo-path"
              value={repoPath}
              onChange={(event) => setRepoPath(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-required="true"
              aria-invalid={repoInvalid}
              aria-errormessage={repoInvalid ? "seed-validation-errors" : undefined}
            />
          </label>
          <label className="field">
            <span>标题 <span className="optional">可选</span></span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} autoComplete="off" />
          </label>
          <label className="field">
            <span>Prompt <span aria-hidden="true">*</span></span>
            <textarea
              data-testid="prompt"
              rows={5}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              aria-required="true"
              aria-invalid={promptInvalid}
              aria-errormessage={promptInvalid ? "seed-validation-errors" : undefined}
            />
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend>显式 dependencies</legend>
          <p className="field-help">只选择真实前置任务。共同上游或时间共现不会自动成为 dependency。</p>
          {tasks.length === 0 ? (
            <p className="empty-inline">当前没有可选前置任务。</p>
          ) : (
            <>
              <label className="field compact-field">
                <span>筛选任务</span>
                <input
                  type="search"
                  value={dependencySearch}
                  onChange={(event) => setDependencySearch(event.target.value)}
                />
              </label>
              <div className="dependency-picker" role="group" aria-label="选择显式 dependencies">
                {visibleTasks.map((task) => {
                  const checked = dependencyIds.includes(task.id);
                  return (
                    <label className={cx("dependency-option", checked && "selected")} key={task.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setDependencyIds((current) =>
                            event.target.checked
                              ? [...current, task.id]
                              : current.filter((id) => id !== task.id),
                          );
                        }}
                      />
                      <span className="dependency-option-main">
                        <strong>{task.title || `Task ${shortId(task.id)}`}</strong>
                        <span><code>{shortId(task.id)}</code> · <StatusPill status={task.status} /></span>
                        <FoldedPath value={task.repoPath} label="仓库路径" />
                      </span>
                    </label>
                  );
                })}
                {visibleTasks.length === 0 && <p className="empty-inline">没有匹配的任务。</p>}
              </div>
            </>
          )}
        </fieldset>

        <fieldset className="form-section">
          <legend>Path claims</legend>
          <p className="field-help">每条 claim 同时提交 path 与服务器支持的 mode；客户端不猜测 mode 枚举。</p>
          <div className="claim-editor">
            {claimRows.map((row, index) => (
              <div className="claim-row" key={row.key}>
                <label className="field">
                  <span>Path {index + 1}</span>
                  <input
                    value={row.path}
                    onChange={(event) => setClaimRows((current) => current.map((item) => item.key === row.key ? { ...item, path: event.target.value } : item))}
                    spellCheck={false}
                    aria-invalid={claimsInvalid}
                    aria-errormessage={claimsInvalid ? "seed-validation-errors" : undefined}
                  />
                </label>
                <label className="field claim-mode-field">
                  <span>Mode</span>
                  <input
                    value={row.mode}
                    onChange={(event) => setClaimRows((current) => current.map((item) => item.key === row.key ? { ...item, mode: event.target.value } : item))}
                    spellCheck={false}
                    aria-invalid={claimsInvalid}
                    aria-errormessage={claimsInvalid ? "seed-validation-errors" : undefined}
                  />
                </label>
                <button
                  type="button"
                  className="icon-button claim-remove"
                  aria-label={`移除第 ${index + 1} 条 claim`}
                  onClick={() => setClaimRows((current) => current.length === 1 ? [{ ...current[0], path: "", mode: "" }] : current.filter((item) => item.key !== row.key))}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="button secondary compact"
            onClick={() => {
              setClaimRows((current) => [...current, { key: nextClaimKey, path: "", mode: "" }]);
              setNextClaimKey((current) => current + 1);
            }}
          >
            增加 claim
          </button>
        </fieldset>

        <fieldset className="form-section">
          <legend>Magnet files</legend>
          <label className="field">
            <span>路径，每行一个</span>
            <textarea
              rows={4}
              value={magnetText}
              onChange={(event) => setMagnetText(event.target.value)}
              spellCheck={false}
              aria-invalid={magnetsInvalid}
              aria-errormessage={magnetsInvalid ? "seed-validation-errors" : undefined}
            />
          </label>
          <p className="field-help">Magnet 只提供 overlap 检测证据，不建立 dependency，也不表示协作。</p>
        </fieldset>
      </form>
    </Dialog>
  );
}
