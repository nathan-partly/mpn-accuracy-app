-- Quality metrics: classification & annotation coverage snapshots

CREATE TABLE IF NOT EXISTS quality_snapshots (
  id            SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  notes         TEXT,
  uploaded_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_snapshots_date
  ON quality_snapshots(snapshot_date DESC);

CREATE TABLE IF NOT EXISTS quality_brand_data (
  id                  SERIAL PRIMARY KEY,
  snapshot_id         INTEGER NOT NULL REFERENCES quality_snapshots(id) ON DELETE CASCADE,
  brand               TEXT NOT NULL,
  classification_pct  NUMERIC(5,2),   -- % of parts classified as HCAs for avg VIN
  annotation_pct      NUMERIC(5,2),   -- % of diagrams annotated for avg VIN
  total_diagrams      INTEGER,         -- total diagram count for that brand
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_id, brand)
);

CREATE INDEX IF NOT EXISTS idx_quality_brand_data_snapshot
  ON quality_brand_data(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_quality_brand_data_brand
  ON quality_brand_data(brand);
