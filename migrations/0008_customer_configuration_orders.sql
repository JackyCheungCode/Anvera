-- ANVERA Customer Configuration Orders
-- Customer-facing wheel configuration drafts, submissions and access-token protected tracking.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anvera_configuration_orders (
  id TEXT PRIMARY KEY NOT NULL,
  reference_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'custom_review', 'needs_information', 'quoted', 'confirmed', 'in_production', 'completed', 'cancelled')),
  customer_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  selected_model TEXT,
  specification_path TEXT CHECK (specification_path IS NULL OR specification_path IN ('oem', 'upgrade', 'custom')),
  delivery_term TEXT,
  shipping_method TEXT,
  configuration_json TEXT NOT NULL DEFAULT '{}',
  access_token_hash TEXT NOT NULL,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS anvera_configuration_orders_status
  ON anvera_configuration_orders(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS anvera_configuration_orders_email
  ON anvera_configuration_orders(email, created_at DESC);
CREATE INDEX IF NOT EXISTS anvera_configuration_orders_created
  ON anvera_configuration_orders(created_at DESC);

CREATE TABLE IF NOT EXISTS anvera_configuration_order_events (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'draft_saved', 'submitted', 'custom_review_requested', 'status_changed')),
  actor TEXT NOT NULL DEFAULT 'customer',
  event_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES anvera_configuration_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS anvera_configuration_order_events_timeline
  ON anvera_configuration_order_events(order_id, created_at DESC);
