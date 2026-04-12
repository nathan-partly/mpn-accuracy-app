-- Data Integrations
-- Tracks each OEM or third-party data source feeding the interpreter pipeline.
-- Drives the Coverage Rate Trend chart and the Integrations column in the
-- VIN Coverage brand table.
--
-- Run after 003_coverage_snapshots.sql

CREATE TABLE IF NOT EXISTS data_integrations (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('online', 'offline')),
  relationship        TEXT NOT NULL DEFAULT 'third-party'
                        CHECK (relationship IN ('direct', 'third-party')),
  brands              TEXT[] NOT NULL DEFAULT '{}',
  -- total_vio_pct: total global VIO % this integration covers (may overlap with others)
  total_vio_pct       DECIMAL(6,2),
  -- incremental_vio_pct: net new VIO % added on top of existing integrations
  incremental_vio_pct DECIMAL(6,2),
  -- Past date = live integration (solid line); future date = target projection (dashed)
  integration_date    DATE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_integrations_date
  ON data_integrations(integration_date ASC);

-- If upgrading an existing database that already has the table without the
-- relationship column, run this instead:
--
--   ALTER TABLE data_integrations
--     ADD COLUMN IF NOT EXISTS relationship TEXT NOT NULL DEFAULT 'third-party'
--       CHECK (relationship IN ('direct', 'third-party'));
