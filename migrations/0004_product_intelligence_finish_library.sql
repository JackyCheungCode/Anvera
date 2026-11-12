-- ANVERA Product Intelligence: controlled finish profiles.
-- Preview-only in this implementation phase. Production migration requires separate approval.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anvera_pi_finish_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  finish_type TEXT NOT NULL,
  process_description TEXT,
  appearance_reference TEXT,
  supported_constructions_json TEXT NOT NULL DEFAULT '[]',
  restrictions TEXT,
  evidence_ref TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'restricted', 'archived')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS anvera_pi_finish_profiles_status
  ON anvera_pi_finish_profiles(status, code);

CREATE TABLE IF NOT EXISTS anvera_pi_product_finish_mappings (
  id TEXT PRIMARY KEY NOT NULL,
  setup_session_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  finish_profile_id TEXT NOT NULL REFERENCES anvera_pi_finish_profiles(id) ON DELETE RESTRICT,
  mapping_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (mapping_status IN ('pending_review', 'approved', 'restricted')),
  restrictions TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(setup_session_id, product_code, finish_profile_id)
);

CREATE INDEX IF NOT EXISTS anvera_pi_product_finish_mappings_product
  ON anvera_pi_product_finish_mappings(setup_session_id, product_code, mapping_status);

CREATE TABLE IF NOT EXISTS anvera_pi_finish_events (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('finish_profile', 'product_finish_mapping')),
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'submitted_for_review', 'mapping_created', 'mapping_updated', 'mapping_removed')),
  actor_user_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS anvera_pi_finish_events_timeline
  ON anvera_pi_finish_events(entity_type, entity_id, created_at DESC);
