-- Coverage snapshots table
-- Stores uploaded coverage-dashboard.html files so they can be served
-- dynamically without requiring a Vercel redeploy.

CREATE TABLE IF NOT EXISTS coverage_snapshots (
  id          SERIAL PRIMARY KEY,
  html_content TEXT NOT NULL,
  uploaded_by TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast "latest" lookups
CREATE INDEX IF NOT EXISTS coverage_snapshots_created_at_idx
  ON coverage_snapshots (created_at DESC);
