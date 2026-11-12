-- ANVERA Product Intelligence: append-only engineering review decisions
-- Preview-only in this implementation phase.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anvera_pi_library_review_decisions (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('material', 'forging_process', 'finish_profile')),
  entity_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'needs_revision', 'restricted')),
  reviewer_user_id TEXT NOT NULL,
  review_note TEXT,
  previous_revision INTEGER NOT NULL,
  resulting_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS anvera_pi_library_review_timeline
  ON anvera_pi_library_review_decisions(entity_type, entity_id, created_at DESC);
