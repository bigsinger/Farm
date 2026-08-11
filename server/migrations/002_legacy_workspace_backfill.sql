-- agent-farm migration 002: durable ledger identity and auditable legacy backfill.
--
-- Legacy workspace status mapping is deliberately conservative:
--   planted   -> seeded
--   growing   -> recovery_required (a pre-upgrade process may have been interrupted)
--   ripe      -> review_pending (legacy completion did not include a current diff approval)
--   wilted    -> wilted
--   harvested -> review_pending (legacy status alone is not proof of a current audited harvest)
--   anything else -> recovery_required
-- In particular, this migration never synthesizes current `harvested`: only the current state
-- machine may do so after review/digest/Git evidence, which prevents a pseudo-harvest.
--
-- db.ts adds the three legacy metric columns inside this checksum migration transaction when an
-- older Phase 1 workspace table lacks them. SQLite cannot express ADD COLUMN IF NOT EXISTS.

CREATE TABLE ledger_metadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ledger_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

ALTER TABLE repositories ADD COLUMN last_event_seq INTEGER REFERENCES audit_events(seq);
CREATE INDEX idx_repositories_last_event_seq ON repositories(last_event_seq);
UPDATE repositories SET last_event_seq = created_event_seq WHERE last_event_seq IS NULL;

-- One deterministic repository-registration audit row per legacy repository path. Deterministic
-- event IDs plus INSERT OR IGNORE make the data transformation safe to retry if the SQL is replayed
-- manually inside a rollback/recovery exercise; the migration runner itself also records 002 once.
INSERT OR IGNORE INTO audit_events (
  event_id, event_type, entity_type, entity_id, repository_id, task_id, run_id,
  actor, payload_json, provenance_kind, provenance_source, provenance_digest, occurred_at
)
SELECT
  'legacy-repository:' || sha256(repo_path),
  'legacy.repository.backfilled',
  'repository',
  'legacy-repository:' || sha256(repo_path),
  'legacy-repository:' || sha256(repo_path),
  NULL,
  NULL,
  'migration:002',
  json_object(
    'legacy_schema', 'workspaces',
    'repo_path', repo_path,
    'workspace_ids', json('[' || group_concat(json_quote(id)) || ']'),
    'lossless_fields', json_array('repo_path'),
    'unavailable_fields', json_array('git_dir', 'head_commit')
  ),
  'legacy_sqlite_backfill',
  'workspaces.repo_path',
  sha256(repo_path),
  MIN(created_at)
FROM workspaces
GROUP BY repo_path;

INSERT OR IGNORE INTO repositories (
  id, root_path, git_dir, is_git, default_branch, head_commit,
  created_at, updated_at, row_version, last_error, created_event_seq, last_event_seq
)
SELECT
  'legacy-repository:' || sha256(workspace.repo_path),
  workspace.repo_path,
  NULL,
  1,
  workspace.base_branch,
  NULL,
  workspace.created_at,
  workspace.updated_at,
  0,
  'Backfilled from the legacy workspaces table; Git identity was not persisted by the legacy schema.',
  event.seq,
  event.seq
FROM (
  SELECT repo_path, MIN(base_branch) AS base_branch, MIN(created_at) AS created_at, MAX(updated_at) AS updated_at
  FROM workspaces
  GROUP BY repo_path
) AS workspace
JOIN audit_events AS event
  ON event.event_id = 'legacy-repository:' || sha256(workspace.repo_path);

-- Preserve every legacy workspace row verbatim in payload_json while also mapping all fields that
-- have first-class current columns. Metrics are retained even when zero. auto_start=0 prevents a
-- migrated task from silently launching, and uncertain/active states carry an explicit blocker.
INSERT OR IGNORE INTO audit_events (
  event_id, event_type, entity_type, entity_id, repository_id, task_id, run_id,
  actor, payload_json, provenance_kind, provenance_source, provenance_digest, occurred_at
)
SELECT
  'legacy-workspace:' || sha256(workspace.id),
  'legacy.workspace.backfilled',
  'task',
  workspace.id,
  'legacy-repository:' || sha256(workspace.repo_path),
  workspace.id,
  NULL,
  'migration:002',
  json_object(
    'legacy_schema', 'workspaces',
    'legacy_workspace', json_object(
      'id', workspace.id,
      'repo_path', workspace.repo_path,
      'base_branch', workspace.base_branch,
      'worktree_path', workspace.worktree_path,
      'branch_name', workspace.branch_name,
      'prompt', workspace.prompt,
      'status', workspace.status,
      'created_at', workspace.created_at,
      'updated_at', workspace.updated_at,
      'cost_usd', workspace.cost_usd,
      'num_turns', workspace.num_turns,
      'duration_ms', workspace.duration_ms
    ),
    'mapped_status', CASE lower(workspace.status)
      WHEN 'planted' THEN 'seeded'
      WHEN 'growing' THEN 'recovery_required'
      WHEN 'ripe' THEN 'review_pending'
      WHEN 'wilted' THEN 'wilted'
      WHEN 'harvested' THEN 'review_pending'
      ELSE 'recovery_required'
    END,
    'status_mapping_reason', CASE lower(workspace.status)
      WHEN 'planted' THEN 'Legacy task was created but no durable run completion was recorded.'
      WHEN 'growing' THEN 'Legacy active execution cannot be proven resumable after upgrade.'
      WHEN 'ripe' THEN 'Legacy execution completed, but current review and diff-digest approval are absent.'
      WHEN 'wilted' THEN 'Legacy terminal cleanup/failure state is retained.'
      WHEN 'harvested' THEN 'Legacy harvested is downgraded because no current audited Git/review evidence exists.'
      ELSE 'Unknown legacy state requires operator recovery.'
    END
  ),
  'legacy_sqlite_backfill',
  'workspaces.id',
  sha256(
    workspace.id || char(0) || workspace.repo_path || char(0) || workspace.base_branch || char(0) ||
    workspace.worktree_path || char(0) || workspace.branch_name || char(0) || workspace.prompt || char(0) ||
    workspace.status || char(0) || workspace.created_at || char(0) || workspace.updated_at || char(0) ||
    workspace.cost_usd || char(0) || workspace.num_turns || char(0) || workspace.duration_ms
  ),
  workspace.created_at
FROM workspaces AS workspace;

INSERT OR IGNORE INTO tasks (
  id, repository_id, title, prompt, status, base_branch, base_commit, branch_name, worktree_path,
  magnet_paths_json, blocking_reasons_json, auto_start, review_status, outcome_status,
  current_run_id, current_diff_digest, approved_diff_digest, pre_harvest_commit, harvest_commit,
  total_cost_usd, num_turns, duration_ms, provider_status, error_code, error_message,
  created_at, updated_at, row_version, created_event_seq
)
SELECT
  workspace.id,
  'legacy-repository:' || sha256(workspace.repo_path),
  CASE
    WHEN instr(workspace.prompt, char(10)) > 0 THEN substr(workspace.prompt, 1, instr(workspace.prompt, char(10)) - 1)
    ELSE workspace.prompt
  END,
  workspace.prompt,
  CASE lower(workspace.status)
    WHEN 'planted' THEN 'seeded'
    WHEN 'growing' THEN 'recovery_required'
    WHEN 'ripe' THEN 'review_pending'
    WHEN 'wilted' THEN 'wilted'
    WHEN 'harvested' THEN 'review_pending'
    ELSE 'recovery_required'
  END,
  workspace.base_branch,
  NULL,
  workspace.branch_name,
  workspace.worktree_path,
  '[]',
  CASE lower(workspace.status)
    WHEN 'planted' THEN json_array('legacy_backfill_manual_start_required')
    WHEN 'wilted' THEN '[]'
    ELSE json_array('legacy_backfill_requires_verification')
  END,
  0,
  CASE lower(workspace.status)
    WHEN 'ripe' THEN 'pending'
    WHEN 'harvested' THEN 'stale'
    ELSE NULL
  END,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  workspace.cost_usd,
  workspace.num_turns,
  workspace.duration_ms,
  CASE lower(workspace.status)
    WHEN 'ripe' THEN 'verified'
    WHEN 'harvested' THEN 'verified'
    WHEN 'growing' THEN 'failed'
    ELSE 'not_run'
  END,
  CASE lower(workspace.status)
    WHEN 'growing' THEN 'legacy_run_interrupted'
    WHEN 'harvested' THEN 'legacy_harvest_unverified'
    ELSE NULL
  END,
  CASE lower(workspace.status)
    WHEN 'growing' THEN 'Legacy run was active during upgrade and has no resumable durable run record.'
    WHEN 'harvested' THEN 'Legacy harvested status lacks current review, diff digest, and Git outcome provenance.'
    ELSE NULL
  END,
  workspace.created_at,
  workspace.updated_at,
  0,
  event.seq
FROM workspaces AS workspace
JOIN audit_events AS event
  ON event.event_id = 'legacy-workspace:' || sha256(workspace.id);

-- Preserve each legacy event as one append-only audit row. Its original payload may be invalid JSON,
-- so payload_text always keeps exact bytes while payload_json is populated only when json_valid.
-- Original numeric id, type, timestamp, and workspace relationship remain explicitly queryable.
INSERT OR IGNORE INTO audit_events (
  event_id, event_type, entity_type, entity_id, repository_id, task_id, run_id,
  actor, payload_json, provenance_kind, provenance_source, provenance_digest, occurred_at
)
SELECT
  'legacy-event:' || legacy.id,
  'legacy.event.' || legacy.type,
  'task',
  legacy.workspace_id,
  task.repository_id,
  legacy.workspace_id,
  NULL,
  'legacy-server',
  json_object(
    'legacy_schema', 'events',
    'legacy_event_id', legacy.id,
    'legacy_type', legacy.type,
    'legacy_timestamp', legacy.ts,
    'payload_text', legacy.payload,
    'payload_json', CASE WHEN json_valid(legacy.payload) THEN json(legacy.payload) ELSE NULL END,
    'payload_was_valid_json', json_valid(legacy.payload)
  ),
  'legacy_sqlite_backfill',
  'events.id',
  sha256(legacy.id || char(0) || legacy.workspace_id || char(0) || legacy.type || char(0) || coalesce(legacy.payload, '') || char(0) || legacy.ts),
  legacy.ts
FROM events AS legacy
JOIN tasks AS task ON task.id = legacy.workspace_id;

-- Repository observation provenance must track the latest backfilled event touching any task in the
-- repository; repositories with no legacy events retain their creation seq.
UPDATE repositories
SET last_event_seq = COALESCE(
  (
    SELECT MAX(event.seq)
    FROM audit_events AS event
    WHERE event.repository_id = repositories.id
  ),
  created_event_seq
)
WHERE id LIKE 'legacy-repository:%';
