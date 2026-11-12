-- ANVERA Product Intelligence: upgrade review and finish mapping constraints.
-- Rebuilds are intentionally repeatable because Preview deployments re-apply SQL files.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anvera_pi_library_review_decisions_next (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('material', 'forging_process', 'finish_profile', 'product_finish_mapping', 'construction_capability')),
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

CREATE TABLE IF NOT EXISTS anvera_pi_product_finish_mappings_next (
  id TEXT PRIMARY KEY NOT NULL,
  setup_session_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  finish_profile_id TEXT NOT NULL REFERENCES anvera_pi_finish_profiles(id) ON DELETE RESTRICT,
  mapping_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (mapping_status IN ('pending_review', 'approved', 'needs_revision', 'restricted', 'superseded')),
  restrictions TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(setup_session_id, product_code, finish_profile_id)
);

INSERT OR IGNORE INTO anvera_pi_product_finish_mappings_next
  (id, setup_session_id, product_code, finish_profile_id, mapping_status, restrictions, revision, created_by_user_id, updated_by_user_id, created_at, updated_at)
SELECT id, setup_session_id, product_code, finish_profile_id, mapping_status, restrictions, revision, created_by_user_id, updated_by_user_id, created_at, updated_at
FROM anvera_pi_product_finish_mappings;

DROP TABLE anvera_pi_product_finish_mappings;
ALTER TABLE anvera_pi_product_finish_mappings_next RENAME TO anvera_pi_product_finish_mappings;

CREATE INDEX IF NOT EXISTS anvera_pi_product_finish_mappings_product
  ON anvera_pi_product_finish_mappings(setup_session_id, product_code, mapping_status);
