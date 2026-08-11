-- agent-farm migration 000: preserve the original workspace/event schema.
-- New code treats these tables as a compatibility projection only.
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  repo_path TEXT NOT NULL,
  base_branch TEXT NOT NULL,
  worktree_path TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planted',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_legacy_events_workspace
  ON events(workspace_id, ts, id);
