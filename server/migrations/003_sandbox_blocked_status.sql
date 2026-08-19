-- Forward migration: allow agent_runs.status = sandbox_blocked.
-- SQLite cannot alter CHECK constraints in place, so rebuild agent_runs.
-- applyMigrations toggles foreign_keys OFF around this file.

CREATE TABLE agent_runs_new (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'queued',
    'running',
    'succeeded',
    'failed',
    'cancelled',
    'timed_out',
    'provider_blocked',
    'sandbox_blocked',
    'crashed'
  )),
  provider_status TEXT NOT NULL CHECK (provider_status IN ('not_run', 'verified', 'blocked', 'failed')),
  provider TEXT,
  retry_of_run_id TEXT REFERENCES agent_runs_new(id),
  recovery_of_run_id TEXT REFERENCES agent_runs_new(id),
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

INSERT INTO agent_runs_new (
  id, task_id, attempt, status, provider_status, provider, retry_of_run_id, recovery_of_run_id,
  sdk_session_id, sdk_result_subtype, started_at, heartbeat_at, ended_at, cost_usd, num_turns,
  duration_ms, usage_json, model_usage_json, permission_denials_json, error_code, error_message,
  timeout_ms, max_budget_usd, created_at, source_event_seq, terminal_event_seq
)
SELECT
  id, task_id, attempt, status, provider_status, provider, retry_of_run_id, recovery_of_run_id,
  sdk_session_id, sdk_result_subtype, started_at, heartbeat_at, ended_at, cost_usd, num_turns,
  duration_ms, usage_json, model_usage_json, permission_denials_json, error_code, error_message,
  timeout_ms, max_budget_usd, created_at, source_event_seq, terminal_event_seq
FROM agent_runs;

DROP TABLE agent_runs;
ALTER TABLE agent_runs_new RENAME TO agent_runs;

CREATE INDEX IF NOT EXISTS idx_runs_task_attempt
  ON agent_runs(task_id, attempt DESC);
CREATE INDEX IF NOT EXISTS idx_runs_active
  ON agent_runs(status, heartbeat_at);
