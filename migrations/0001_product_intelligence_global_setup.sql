-- ANVERA Product Intelligence: Global Setup draft persistence
-- Applies only to the isolated preview D1 database during preview deployment.
-- Production D1 migration is intentionally excluded from all automated workflows.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anvera_product_setup_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  setup_key TEXT NOT NULL UNIQUE DEFAULT 'global',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'rejected', 'active', 'archived')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  document_json TEXT NOT NULL DEFAULT '{}',
  step_state_json TEXT NOT NULL DEFAULT '{}',
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  submitted_at TEXT,
  approved_at TEXT,
  activated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS anvera_product_setup_versions (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  version_type TEXT NOT NULL CHECK (version_type IN ('submitted', 'approved', 'activated', 'snapshot')),
  document_json TEXT NOT NULL,
  step_state_json TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, revision, version_type),
  FOREIGN KEY (session_id) REFERENCES anvera_product_setup_sessions(id)
);

CREATE TABLE IF NOT EXISTS anvera_product_setup_events (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'draft_saved', 'submitted', 'approved', 'rejected', 'activated', 'restored')),
  actor_user_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES anvera_product_setup_sessions(id)
);

CREATE INDEX IF NOT EXISTS anvera_product_setup_versions_timeline
  ON anvera_product_setup_versions(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS anvera_product_setup_events_timeline
  ON anvera_product_setup_events(session_id, created_at DESC);
