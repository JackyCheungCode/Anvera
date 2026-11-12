-- ANVERA Product Intelligence: normalized material and forging process libraries
-- Preview-only in this implementation phase. Production migration requires separate approval.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anvera_pi_material_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  grade TEXT NOT NULL,
  standard TEXT,
  supplier TEXT,
  certificate_ref TEXT,
  evidence_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'restricted', 'archived')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS anvera_pi_material_profiles_status
  ON anvera_pi_material_profiles(status, code);

CREATE TABLE IF NOT EXISTS anvera_pi_forging_processes (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  process_type TEXT NOT NULL,
  equipment TEXT,
  capacity_notes TEXT,
  heat_treatment TEXT,
  cnc_capability TEXT,
  evidence_ref TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'restricted', 'archived')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS anvera_pi_forging_processes_status
  ON anvera_pi_forging_processes(status, code);

CREATE TABLE IF NOT EXISTS anvera_pi_library_events (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('material', 'forging_process')),
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'submitted_for_review')),
  actor_user_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS anvera_pi_library_events_timeline
  ON anvera_pi_library_events(entity_type, entity_id, created_at DESC);
