-- MPN Accuracy Benchmarking — Initial Schema
-- Run this once against your Neon / Vercel Postgres / Cloud SQL database.

-- Brands / makes being benchmarked
CREATE TABLE IF NOT EXISTS brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,          -- e.g. "Peugeot"
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'pending')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each upload creates one immutable snapshot for a brand
CREATE TABLE IF NOT EXISTS benchmark_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,
  notes           TEXT,
  uploaded_by     TEXT,
  -- Computed summary stats (stored for fast dashboard queries)
  total_vins      INTEGER NOT NULL DEFAULT 0,
  total_parts     INTEGER NOT NULL DEFAULT 0,  -- records where is_valid IS NOT NULL
  valid_count     INTEGER NOT NULL DEFAULT 0,
  invalid_count   INTEGER NOT NULL DEFAULT 0,
  skipped_count   INTEGER NOT NULL DEFAULT 0,  -- is_valid IS NULL (missing diagram etc.)
  accuracy_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_brand_date
  ON benchmark_snapshots(brand_id, snapshot_date DESC);

-- Individual VIN × part-type benchmark records
CREATE TABLE IF NOT EXISTS benchmark_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id         UUID NOT NULL REFERENCES benchmark_snapshots(id) ON DELETE CASCADE,
  brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  region              TEXT,
  vin                 TEXT NOT NULL,
  make                TEXT,
  model               TEXT,
  year                INTEGER,
  upstream_provider   TEXT,
  part_type           TEXT NOT NULL,
  interpreter_output  TEXT,
  epc_output          TEXT,
  -- NULL = skipped (missing diagram / hotspot — not counted in accuracy)
  -- TRUE = valid (at least one returned variant is a correct fitting part)
  -- FALSE = invalid (no correct fitting part in returned variants)
  is_valid            BOOLEAN,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_records_snapshot  ON benchmark_records(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_records_brand      ON benchmark_records(brand_id);
CREATE INDEX IF NOT EXISTS idx_records_vin        ON benchmark_records(snapshot_id, vin);
CREATE INDEX IF NOT EXISTS idx_records_part_type  ON benchmark_records(snapshot_id, part_type);

-- Seed initial brands from the existing Google Sheet tabs
-- (you can add more or edit names after the fact)
INSERT INTO brands (name, status) VALUES
  ('Land Rover',   'active'),
  ('Suzuki',       'active'),
  ('Toyota',       'active'),
  ('Volkswagen',   'active'),
  ('Ford',         'active'),
  ('Hyundai',      'active'),
  ('BMW',          'active'),
  ('Peugeot',      'active'),
  ('Audi',         'active'),
  ('Subaru',       'active'),
  ('Lexus',        'active'),
  ('Honda',        'active'),
  ('Kia',          'active'),
  ('Mitsubishi',   'active'),
  ('Nissan',       'active'),
  ('Mazda',        'active'),
  ('Mercedes-Benz','pending'),
  ('Chevrolet',    'pending'),
  ('Skoda',        'pending'),
  ('Holden',       'pending'),
  ('Mini',         'pending'),
  ('Vauxhall',     'pending'),
  ('Jeep',         'pending'),
  ('Dodge',        'pending')
ON CONFLICT (name) DO NOTHING;
