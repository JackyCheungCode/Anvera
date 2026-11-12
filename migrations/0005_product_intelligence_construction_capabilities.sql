-- ANVERA Product Intelligence: construction capability matrix.
-- Preview-only in this implementation phase. Production migration requires separate approval.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anvera_pi_construction_capabilities (
  id TEXT PRIMARY KEY NOT NULL,
  construction_type TEXT NOT NULL UNIQUE COLLATE NOCASE
    CHECK (construction_type IN ('Monoblock', 'Two-piece', 'Three-piece')),
  capability_scope TEXT,
  assembly_method TEXT,
  fastener_requirements TEXT,
  quality_processes TEXT,
  structural_limitations TEXT,
  evidence_ref TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'restricted', 'archived')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS anvera_pi_construction_capabilities_status
  ON anvera_pi_construction_capabilities(status, construction_type);
