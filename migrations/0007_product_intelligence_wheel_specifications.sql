-- ANVERA Product Intelligence: normalized wheel specification records.
-- Includes the engineering review entity; safe to re-apply in Preview and Production.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anvera_pi_wheel_specifications (
  id TEXT PRIMARY KEY NOT NULL,
  setup_session_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  specification_id TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('Front', 'Rear', 'Front & Rear')),
  diameter REAL NOT NULL CHECK (diameter > 0),
  width REAL NOT NULL CHECK (width > 0),
  bolt_count INTEGER NOT NULL CHECK (bolt_count > 0),
  pcd REAL NOT NULL CHECK (pcd > 0),
  offset REAL NOT NULL,
  center_bore REAL NOT NULL CHECK (center_bore > 0),
  load_rating REAL CHECK (load_rating IS NULL OR load_rating > 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'factory_supported', 'pending_review', 'approved', 'restricted', 'superseded')),
  evidence_ref TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(setup_session_id, product_code, specification_id)
);

CREATE INDEX IF NOT EXISTS anvera_pi_wheel_specifications_review
  ON anvera_pi_wheel_specifications(status, updated_at);

CREATE INDEX IF NOT EXISTS anvera_pi_wheel_specifications_product
  ON anvera_pi_wheel_specifications(setup_session_id, product_code, status);

-- Rebuild the append-only review decision table to include wheel specifications.
CREATE TABLE IF NOT EXISTS anvera_pi_library_review_decisions_next (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('material', 'forging_process', 'finish_profile', 'product_finish_mapping', 'construction_capability', 'wheel_specification')),
  entity_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'needs_revision', 'restricted')),
  reviewer_user_id TEXT NOT NULL,
  review_note TEXT,
  previous_revision INTEGER NOT NULL,
  resulting_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO anvera_pi_library_review_decisions_next
  (id, entity_type, entity_id, decision, reviewer_user_id, review_note, previous_revision, resulting_revision, created_at)
SELECT id, entity_type, entity_id, decision, reviewer_user_id, review_note, previous_revision, resulting_revision, created_at
FROM anvera_pi_library_review_decisions;

DROP TABLE anvera_pi_library_review_decisions;
ALTER TABLE anvera_pi_library_review_decisions_next RENAME TO anvera_pi_library_review_decisions;

CREATE INDEX IF NOT EXISTS anvera_pi_library_review_timeline
  ON anvera_pi_library_review_decisions(entity_type, entity_id, created_at DESC);
