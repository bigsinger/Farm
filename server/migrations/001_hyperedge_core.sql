CREATE TABLE IF NOT EXISTS audit_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  repository_id TEXT,
  task_id TEXT,
  run_id TEXT,
  actor TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  provenance_kind TEXT NOT NULL,
  provenance_source TEXT NOT NULL,
  provenance_digest TEXT,
  occurred_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_task_seq ON audit_events(task_id, seq);
CREATE INDEX IF NOT EXISTS idx_audit_repo_seq ON audit_events(repository_id, seq);
CREATE INDEX IF NOT EXISTS idx_audit_type_seq ON audit_events(event_type, seq);

CREATE TRIGGER IF NOT EXISTS audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL UNIQUE,
  git_dir TEXT,
  is_git INTEGER NOT NULL CHECK (is_git IN (0, 1)),
  default_branch TEXT,
  head_commit TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  row_version INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_event_seq INTEGER REFERENCES audit_events(seq)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id),
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'seeded', 'preparing', 'blocked', 'running', 'review_pending',
    'review_rejected', 'harvesting', 'harvested', 'wilting', 'wilted',
    'failed', 'cancelled', 'recovery_required'
  )),
  base_branch TEXT,
  base_commit TEXT,
  branch_name TEXT UNIQUE,
  worktree_path TEXT UNIQUE,
  magnet_paths_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(magnet_paths_json)),
  blocking_reasons_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(blocking_reasons_json)),
  auto_start INTEGER NOT NULL DEFAULT 1 CHECK (auto_start IN (0, 1)),
  review_status TEXT CHECK (review_status IS NULL OR review_status IN ('pending', 'approved', 'rejected', 'stale')),
  outcome_status TEXT,
  current_run_id TEXT,
  current_diff_digest TEXT,
  approved_diff_digest TEXT,
  pre_harvest_commit TEXT,
  harvest_commit TEXT,
  total_cost_usd REAL,
  num_turns INTEGER,
  duration_ms INTEGER,
  provider_status TEXT CHECK (provider_status IS NULL OR provider_status IN ('verified', 'blocked', 'not_run', 'failed')),
  error_code TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  row_version INTEGER NOT NULL DEFAULT 0,
  created_event_seq INTEGER REFERENCES audit_events(seq)
);

CREATE INDEX IF NOT EXISTS idx_tasks_repository_status
  ON tasks(repository_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_updated
  ON tasks(updated_at DESC, id);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  source_event_seq INTEGER NOT NULL REFERENCES audit_events(seq),
  PRIMARY KEY (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);
CREATE INDEX IF NOT EXISTS idx_dependencies_reverse
  ON task_dependencies(depends_on_task_id, task_id);

CREATE TABLE IF NOT EXISTS path_claims (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id),
  path TEXT NOT NULL,
  normalized_path TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('exclusive', 'shared')),
  status TEXT NOT NULL CHECK (status IN ('active', 'released')),
  claimed_at INTEGER NOT NULL,
  released_at INTEGER,
  source_event_seq INTEGER NOT NULL REFERENCES audit_events(seq),
  release_event_seq INTEGER REFERENCES audit_events(seq)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_unique_active
  ON path_claims(task_id, normalized_path) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_claim_repo_active
  ON path_claims(repository_id, status, normalized_path);

CREATE TABLE IF NOT EXISTS overlap_evidence (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id),
  left_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  right_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('claim', 'magnet', 'diff')),
  blocking INTEGER NOT NULL CHECK (blocking IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'superseded')),
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  detected_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolution TEXT,
  source_event_seq INTEGER NOT NULL REFERENCES audit_events(seq),
  resolution_event_seq INTEGER REFERENCES audit_events(seq),
  CHECK (left_task_id < right_task_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_overlap_identity_open
  ON overlap_evidence(repository_id, left_task_id, right_task_id, path, evidence_type)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_overlap_task_left
  ON overlap_evidence(left_task_id, status, blocking);
CREATE INDEX IF NOT EXISTS idx_overlap_task_right
  ON overlap_evidence(right_task_id, status, blocking);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'timed_out', 'provider_blocked', 'crashed')),
  provider_status TEXT NOT NULL CHECK (provider_status IN ('not_run', 'verified', 'blocked', 'failed')),
  provider TEXT,
  retry_of_run_id TEXT REFERENCES agent_runs(id),
  recovery_of_run_id TEXT REFERENCES agent_runs(id),
  sdk_session_id TEXT,
  sdk_result_subtype TEXT,
  started_at INTEGER,
  heartbeat_at INTEGER,
  ended_at INTEGER,
  cost_usd REAL,
  num_turns INTEGER,
  duration_ms INTEGER,
  usage_json TEXT CHECK (usage_json IS NULL OR json_valid(usage_json)),
  model_usage_json TEXT CHECK (model_usage_json IS NULL OR json_valid(model_usage_json)),
  permission_denials_json TEXT CHECK (permission_denials_json IS NULL OR json_valid(permission_denials_json)),
  error_code TEXT,
  error_message TEXT,
  timeout_ms INTEGER,
  max_budget_usd REAL,
  created_at INTEGER NOT NULL,
  source_event_seq INTEGER NOT NULL REFERENCES audit_events(seq),
  terminal_event_seq INTEGER REFERENCES audit_events(seq),
  UNIQUE (task_id, attempt)
);
CREATE INDEX IF NOT EXISTS idx_runs_task_attempt
  ON agent_runs(task_id, attempt DESC);
CREATE INDEX IF NOT EXISTS idx_runs_active
  ON agent_runs(status, heartbeat_at);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('patch', 'diff_stat', 'manifest', 'agent_result', 'log', 'benchmark')),
  path TEXT NOT NULL,
  media_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at INTEGER NOT NULL,
  source_event_seq INTEGER NOT NULL REFERENCES audit_events(seq)
);
CREATE INDEX IF NOT EXISTS idx_artifacts_task_created
  ON artifacts(task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  diff_digest TEXT NOT NULL,
  summary TEXT,
  reviewer TEXT,
  created_at INTEGER NOT NULL,
  source_event_seq INTEGER NOT NULL REFERENCES audit_events(seq)
);
CREATE INDEX IF NOT EXISTS idx_reviews_task_created
  ON reviews(task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS outcomes (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('harvest', 'wilt', 'cancel', 'failure', 'recovery')),
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'rolled_back', 'confirmed')),
  operation_id TEXT,
  commit_sha TEXT,
  diff_digest TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL,
  source_event_seq INTEGER NOT NULL REFERENCES audit_events(seq)
);
CREATE INDEX IF NOT EXISTS idx_outcomes_task_created
  ON outcomes(task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS operation_locks (
  repository_id TEXT PRIMARY KEY REFERENCES repositories(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  owner TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json))
);

CREATE TABLE IF NOT EXISTS operation_journal (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  operation TEXT NOT NULL CHECK (operation IN ('prepare', 'harvest', 'wilt', 'reconcile')),
  state TEXT NOT NULL CHECK (state IN ('started', 'git_applying', 'git_applied', 'committed', 'rolled_back', 'failed', 'needs_recovery')),
  pre_commit TEXT,
  post_commit TEXT,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  error_message TEXT,
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  source_event_seq INTEGER NOT NULL REFERENCES audit_events(seq)
);
CREATE INDEX IF NOT EXISTS idx_journal_open
  ON operation_journal(state, updated_at);

CREATE TABLE IF NOT EXISTS benchmark_artifacts (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  first_seq INTEGER NOT NULL,
  last_seq INTEGER NOT NULL,
  event_count INTEGER NOT NULL,
  artifact_json TEXT NOT NULL CHECK (json_valid(artifact_json)),
  source_event_seq INTEGER NOT NULL REFERENCES audit_events(seq)
);
CREATE INDEX IF NOT EXISTS idx_benchmarks_generated
  ON benchmark_artifacts(generated_at DESC, id DESC);
