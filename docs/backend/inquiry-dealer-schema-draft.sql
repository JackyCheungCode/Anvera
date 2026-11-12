-- ANVERA business data schema draft
-- REVIEW ONLY. NOT APPLIED TO ANY D1 DATABASE.
-- Custom tables are namespaced to avoid changing EmDash-owned tables.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anvera_inquiries (
  id TEXT PRIMARY KEY NOT NULL,
  reference_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_review', 'quoted', 'won', 'closed', 'spam')),
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  vehicle_make TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_year INTEGER,
  vehicle_trim TEXT,
  selected_model TEXT,
  construction_type TEXT
    CHECK (construction_type IS NULL OR construction_type IN ('monoblock', 'two_piece', 'three_piece', 'undecided')),
  wheel_diameter TEXT,
  wheel_width TEXT,
  pcd TEXT,
  offset TEXT,
  centre_bore TEXT,
  finish_code TEXT,
  quantity TEXT,
  project_notes TEXT,
  source_path TEXT,
  consent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS anvera_inquiries_status_created
  ON anvera_inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS anvera_inquiries_email_created
  ON anvera_inquiries(email, created_at DESC);
CREATE INDEX IF NOT EXISTS anvera_inquiries_reference
  ON anvera_inquiries(reference_code);

CREATE TABLE IF NOT EXISTS anvera_inquiry_events (
  id TEXT PRIMARY KEY NOT NULL,
  inquiry_id TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('created', 'status_changed', 'note_added', 'assigned', 'quote_sent', 'attachment_added')),
  actor_user_id TEXT,
  previous_value TEXT,
  new_value TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inquiry_id) REFERENCES anvera_inquiries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS anvera_inquiry_events_timeline
  ON anvera_inquiry_events(inquiry_id, created_at ASC);

CREATE TABLE IF NOT EXISTS anvera_inquiry_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  inquiry_id TEXT NOT NULL,
  r2_object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inquiry_id) REFERENCES anvera_inquiries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS anvera_inquiry_attachments_inquiry
  ON anvera_inquiry_attachments(inquiry_id);

CREATE TABLE IF NOT EXISTS anvera_dealer_applications (
  id TEXT PRIMARY KEY NOT NULL,
  reference_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'withdrawn')),
  legal_company_name TEXT NOT NULL,
  trading_name TEXT,
  website TEXT,
  business_type TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT,
  years_in_business INTEGER,
  represented_brands TEXT,
  contact_name TEXT NOT NULL,
  contact_role TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS anvera_dealer_applications_status_created
  ON anvera_dealer_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS anvera_dealer_applications_email_created
  ON anvera_dealer_applications(email, created_at DESC);

CREATE TABLE IF NOT EXISTS anvera_dealer_application_events (
  id TEXT PRIMARY KEY NOT NULL,
  application_id TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('status_changed', 'note_added')),
  actor_user_id TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES anvera_dealer_applications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS anvera_dealer_application_events_timeline
  ON anvera_dealer_application_events(application_id, created_at ASC);

CREATE TABLE IF NOT EXISTS anvera_dealers (
  id TEXT PRIMARY KEY NOT NULL,
  emdash_user_id TEXT NOT NULL UNIQUE,
  application_id TEXT NOT NULL UNIQUE,
  legal_company_name TEXT NOT NULL,
  country TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'closed')),
  activated_by_user_id TEXT NOT NULL,
  activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES anvera_dealer_applications(id)
);

CREATE INDEX IF NOT EXISTS anvera_dealers_status
  ON anvera_dealers(status);

CREATE TABLE IF NOT EXISTS anvera_dealer_events (
  id TEXT PRIMARY KEY NOT NULL,
  dealer_id TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('activated', 'suspended', 'reactivated', 'closed')),
  actor_user_id TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dealer_id) REFERENCES anvera_dealers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS anvera_dealer_events_timeline
  ON anvera_dealer_events(dealer_id, created_at ASC);
