import { sql } from "./db";
import type {
  Brand,
  BenchmarkSnapshot,
  BenchmarkRecord,
  AccuracyPoint,
  ModelBreakdown,
  PartTypeBreakdown,
  ProviderBreakdown,
  RegionBreakdown,
  EpcSourceBreakdown,
  GlobalProviderStat,
} from "@/types";

// ─── Brands ───────────────────────────────────────────────────────────────────

export async function getAllBrands(): Promise<Brand[]> {
  const rows = await sql`
    SELECT
      b.id,
      b.name,
      b.status,
      b.created_at,
      s.snapshot_date      AS latest_snapshot_date,
      s.accuracy_pct       AS latest_accuracy_pct,
      s.active_vins        AS latest_total_vins,
      s.total_parts        AS latest_total_parts,
      s.valid_count        AS latest_valid_count,
      s.invalid_count      AS latest_invalid_count,
      COUNT(s2.id)         AS snapshot_count
    FROM brands b
    LEFT JOIN LATERAL (
      SELECT *
      FROM benchmark_snapshots
      WHERE brand_id = b.id
      ORDER BY snapshot_date DESC
      LIMIT 1
    ) s ON true
    LEFT JOIN benchmark_snapshots s2 ON s2.brand_id = b.id
    GROUP BY b.id, b.name, b.status, b.created_at,
             s.snapshot_date, s.accuracy_pct, s.active_vins,
             s.total_parts, s.valid_count, s.invalid_count
    ORDER BY b.name ASC
  `;
  return rows as Brand[];
}

export async function getBrandById(id: string): Promise<Brand | null> {
  const rows = await sql`
    SELECT
      b.id, b.name, b.status, b.created_at,
      s.snapshot_date AS latest_snapshot_date,
      s.accuracy_pct  AS latest_accuracy_pct,
      s.total_vins    AS latest_total_vins,
      s.total_parts   AS latest_total_parts,
      s.valid_count   AS latest_valid_count,
      s.invalid_count AS latest_invalid_count
    FROM brands b
    LEFT JOIN LATERAL (
      SELECT * FROM benchmark_snapshots
      WHERE brand_id = b.id
      ORDER BY snapshot_date DESC LIMIT 1
    ) s ON true
    WHERE b.id = ${id}
  `;
  return (rows[0] as Brand) ?? null;
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

export async function getSnapshotsForBrand(
  brandId: string
): Promise<BenchmarkSnapshot[]> {
  const rows = await sql`
    SELECT s.*, b.name AS brand_name
    FROM benchmark_snapshots s
    JOIN brands b ON b.id = s.brand_id
    WHERE s.brand_id = ${brandId}
    ORDER BY s.snapshot_date DESC
  `;
  return rows as BenchmarkSnapshot[];
}

export async function getSnapshotById(
  id: string
): Promise<BenchmarkSnapshot | null> {
  const rows = await sql`
    SELECT s.*, b.name AS brand_name
    FROM benchmark_snapshots s
    JOIN brands b ON b.id = s.brand_id
    WHERE s.id = ${id}
  `;
  return (rows[0] as BenchmarkSnapshot) ?? null;
}

export async function createSnapshot(data: {
  brand_id: string;
  snapshot_date: string;
  notes?: string;
  uploaded_by?: string;
}): Promise<BenchmarkSnapshot> {
  const rows = await sql`
    INSERT INTO benchmark_snapshots
      (brand_id, snapshot_date, notes, uploaded_by)
    VALUES
      (${data.brand_id}, ${data.snapshot_date}, ${data.notes ?? null}, ${data.uploaded_by ?? null})
    RETURNING *
  `;
  return rows[0] as BenchmarkSnapshot;
}

export async function updateSnapshotStats(snapshotId: string): Promise<void> {
  await sql`
    UPDATE benchmark_snapshots s
    SET
      total_vins    = sub.total_vins,
      active_vins   = sub.active_vins,
      total_parts   = sub.total_parts,
      valid_count   = sub.valid_count,
      invalid_count = sub.invalid_count,
      skipped_count = sub.skipped_count,
      accuracy_pct  = CASE
        WHEN sub.total_parts = 0 THEN 0
        ELSE ROUND((sub.valid_count::numeric / sub.total_parts) * 100, 2)
      END
    FROM (
      SELECT
        snapshot_id,
        COUNT(DISTINCT vin)                                                       AS total_vins,
        COUNT(DISTINCT vin) FILTER (WHERE is_valid IS NOT NULL)                   AS active_vins,
        COUNT(*) FILTER (WHERE is_valid IS NOT NULL)                              AS total_parts,
        COUNT(*) FILTER (WHERE is_valid = true)                                   AS valid_count,
        COUNT(*) FILTER (WHERE is_valid = false)                                  AS invalid_count,
        COUNT(*) FILTER (WHERE is_valid IS NULL)                                  AS skipped_count
      FROM benchmark_records
      WHERE snapshot_id = ${snapshotId}
      GROUP BY snapshot_id
    ) sub
    WHERE s.id = sub.snapshot_id
  `;
}

// ─── Records ──────────────────────────────────────────────────────────────────

export async function insertRecords(
  records: Omit<BenchmarkRecord, "id" | "created_at">[]
): Promise<void> {
  if (records.length === 0) return;

  // Insert in batches of 500
  const batchSize = 500;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const values = batch.map((r) => ({
      snapshot_id:        r.snapshot_id,
      brand_id:           r.brand_id,
      region:             r.region ?? null,
      vin:                r.vin,
      make:               r.make ?? null,
      model:              r.model ?? null,
      year:               r.year ?? null,
      upstream_provider:  r.upstream_provider ?? null,
      part_type:          r.part_type,
      interpreter_output: r.interpreter_output ?? null,
      epc_output:         r.epc_output ?? null,
      pl24_output:        r.pl24_output ?? null,
      epc_source:         r.epc_source ?? null,
      is_valid:           r.is_valid,
      notes:              r.notes ?? null,
    }));

    for (const v of values) {
      await sql`
        INSERT INTO benchmark_records
          (snapshot_id, brand_id, region, vin, make, model, year,
           upstream_provider, part_type, interpreter_output, epc_output, pl24_output, epc_source, is_valid, notes)
        VALUES
          (${v.snapshot_id}, ${v.brand_id}, ${v.region}, ${v.vin},
           ${v.make}, ${v.model}, ${v.year}, ${v.upstream_provider},
           ${v.part_type}, ${v.interpreter_output}, ${v.epc_output},
           ${v.pl24_output}, ${v.epc_source}, ${v.is_valid}, ${v.notes})
      `;
    }
  }
}

export async function getRecordsForSnapshot(
  snapshotId: string
): Promise<BenchmarkRecord[]> {
  const rows = await sql`
    SELECT * FROM benchmark_records
    WHERE snapshot_id = ${snapshotId}
    ORDER BY model, year, vin, part_type
    LIMIT 2000
  `;
  return rows as BenchmarkRecord[];
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getAccuracyHistory(
  brandId: string
): Promise<AccuracyPoint[]> {
  const rows = await sql`
    SELECT
      snapshot_date::text,
      accuracy_pct,
      total_parts,
      valid_count,
      invalid_count
    FROM benchmark_snapshots
    WHERE brand_id = ${brandId}
    ORDER BY snapshot_date ASC
  `;
  return rows as AccuracyPoint[];
}

export async function getModelBreakdown(
  snapshotId: string
): Promise<ModelBreakdown[]> {
  const rows = await sql`
    SELECT
      COALESCE(model, 'Unknown')  AS model,
      year,
      region,
      COUNT(*) FILTER (WHERE is_valid IS NOT NULL)  AS total_parts,
      COUNT(*) FILTER (WHERE is_valid = true)        AS valid_count,
      COUNT(*) FILTER (WHERE is_valid = false)       AS invalid_count,
      CASE
        WHEN COUNT(*) FILTER (WHERE is_valid IS NOT NULL) = 0 THEN 0
        ELSE ROUND(
          COUNT(*) FILTER (WHERE is_valid = true)::numeric
          / COUNT(*) FILTER (WHERE is_valid IS NOT NULL) * 100, 2
        )
      END AS accuracy_pct
    FROM benchmark_records
    WHERE snapshot_id = ${snapshotId}
    GROUP BY model, year, region
    ORDER BY model, year, region
  `;
  return rows as ModelBreakdown[];
}

export async function getPartTypeBreakdown(
  snapshotId: string
): Promise<PartTypeBreakdown[]> {
  const rows = await sql`
    SELECT
      part_type,
      COUNT(*) FILTER (WHERE is_valid IS NOT NULL)  AS total_parts,
      COUNT(*) FILTER (WHERE is_valid = true)        AS valid_count,
      COUNT(*) FILTER (WHERE is_valid = false)       AS invalid_count,
      CASE
        WHEN COUNT(*) FILTER (WHERE is_valid IS NOT NULL) = 0 THEN 0
        ELSE ROUND(
          COUNT(*) FILTER (WHERE is_valid = true)::numeric
          / COUNT(*) FILTER (WHERE is_valid IS NOT NULL) * 100, 2
        )
      END AS accuracy_pct
    FROM benchmark_records
    WHERE snapshot_id = ${snapshotId}
    GROUP BY part_type
    ORDER BY total_parts DESC
  `;
  return rows as PartTypeBreakdown[];
}

export async function getProviderBreakdown(
  snapshotId: string
): Promise<ProviderBreakdown[]> {
  const rows = await sql`
    SELECT
      CASE
        WHEN LOWER(TRIM(upstream_provider)) IN ('yqservice', 'yqservices')
          OR upstream_provider ILIKE 'yq%service%'             THEN 'YQService'
        WHEN LOWER(TRIM(upstream_provider)) = 'adp'            THEN 'ADP'
        WHEN upstream_provider ILIKE '%parts%bond%'
          OR LOWER(TRIM(upstream_provider)) = 'partsbond'      THEN 'Parts Bond'
        WHEN upstream_provider ILIKE '%mazda%'
          AND upstream_provider ILIKE '%offline%'              THEN 'Mazda EU Offline'
        WHEN upstream_provider ILIKE '%holden%'
          AND upstream_provider ILIKE '%offline%'              THEN 'Holden Offline'
        WHEN upstream_provider ILIKE '%honda%'
          AND upstream_provider ILIKE '%offline%'              THEN 'Honda Offline'
        WHEN upstream_provider ILIKE '%tradesoft%'
          OR upstream_provider ILIKE '%trade%soft%'            THEN 'TradeSoft'
        ELSE 'No upstream provider'
      END                         AS upstream_provider,
      COUNT(DISTINCT vin)         AS vin_count,
      ROUND(
        COUNT(DISTINCT vin)::numeric
        / NULLIF(SUM(COUNT(DISTINCT vin)) OVER (), 0) * 100, 1
      )                           AS pct
    FROM benchmark_records
    WHERE snapshot_id = ${snapshotId}
    GROUP BY 1
    ORDER BY vin_count DESC
  `;
  return rows as ProviderBreakdown[];
}

export async function getRegionBreakdown(
  snapshotId: string
): Promise<RegionBreakdown[]> {
  const rows = await sql`
    SELECT
      COALESCE(region, 'Unknown') AS region,
      COUNT(DISTINCT vin)         AS vin_count,
      ROUND(
        COUNT(DISTINCT vin)::numeric
        / NULLIF(SUM(COUNT(DISTINCT vin)) OVER (), 0) * 100, 1
      )                           AS pct
    FROM benchmark_records
    WHERE snapshot_id = ${snapshotId}
    GROUP BY region
    ORDER BY vin_count DESC
  `;
  return rows as RegionBreakdown[];
}

export async function getEpcSourceBreakdown(
  snapshotId: string
): Promise<EpcSourceBreakdown[]> {
  const rows = await sql`
    SELECT
      COALESCE(epc_source, 'Unknown') AS epc_source,
      COUNT(*)                        AS part_count,
      ROUND(
        COUNT(*)::numeric
        / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1
      )                               AS pct
    FROM benchmark_records
    WHERE snapshot_id = ${snapshotId}
      AND is_valid IS NOT NULL
    GROUP BY epc_source
    ORDER BY part_count DESC
  `;
  return rows as EpcSourceBreakdown[];
}

export async function getGlobalProviderStats(): Promise<GlobalProviderStat[]> {
  const rows = await sql`
    SELECT
      CASE
        WHEN LOWER(TRIM(r.upstream_provider)) IN ('yqservice', 'yqservices')
          OR r.upstream_provider ILIKE 'yq%service%'              THEN 'YQService'
        WHEN LOWER(TRIM(r.upstream_provider)) = 'adp'             THEN 'ADP'
        WHEN r.upstream_provider ILIKE '%parts%bond%'
          OR LOWER(TRIM(r.upstream_provider)) = 'partsbond'       THEN 'Parts Bond'
        WHEN r.upstream_provider ILIKE '%mazda%'
          AND r.upstream_provider ILIKE '%offline%'               THEN 'Mazda EU Offline'
        WHEN r.upstream_provider ILIKE '%holden%'
          AND r.upstream_provider ILIKE '%offline%'               THEN 'Holden Offline'
        WHEN r.upstream_provider ILIKE '%honda%'
          AND r.upstream_provider ILIKE '%offline%'               THEN 'Honda Offline'
        WHEN r.upstream_provider ILIKE '%tradesoft%'
          OR r.upstream_provider ILIKE '%trade%soft%'             THEN 'TradeSoft'
        ELSE 'No upstream provider'
      END                                                             AS provider,
      COUNT(*) FILTER (WHERE r.is_valid IS NOT NULL)                  AS total_parts,
      COUNT(*) FILTER (WHERE r.is_valid = true)                       AS valid_count,
      COUNT(*) FILTER (WHERE r.is_valid = false)                      AS invalid_count,
      CASE
        WHEN COUNT(*) FILTER (WHERE r.is_valid IS NOT NULL) = 0 THEN 0
        ELSE ROUND(
          COUNT(*) FILTER (WHERE r.is_valid = true)::numeric
          / COUNT(*) FILTER (WHERE r.is_valid IS NOT NULL) * 100, 2
        )
      END                                                             AS accuracy_pct
    FROM brands b
    JOIN LATERAL (
      SELECT id FROM benchmark_snapshots
      WHERE brand_id = b.id
      ORDER BY snapshot_date DESC LIMIT 1
    ) latest ON true
    JOIN benchmark_records r ON r.snapshot_id = latest.id
    GROUP BY 1
    ORDER BY total_parts DESC
  `;
  return rows as GlobalProviderStat[];
}

export async function getGlobalStats() {
  const rows = await sql`
    SELECT
      COUNT(DISTINCT b.id)                                        AS total_brands,
      COALESCE(SUM(s.active_vins), 0)                            AS total_vins,
      COALESCE(SUM(s.total_parts), 0)                            AS total_parts,
      COALESCE(SUM(s.valid_count), 0)                            AS valid_count,
      COALESCE(SUM(s.invalid_count), 0)                          AS invalid_count,
      CASE
        WHEN COALESCE(SUM(s.total_parts), 0) = 0 THEN 0
        ELSE ROUND(SUM(s.valid_count)::numeric / SUM(s.total_parts) * 100, 2)
      END AS overall_accuracy_pct
    FROM brands b
    LEFT JOIN LATERAL (
      SELECT * FROM benchmark_snapshots
      WHERE brand_id = b.id
      ORDER BY snapshot_date DESC LIMIT 1
    ) s ON true
    WHERE s.id IS NOT NULL
  `;
  return rows[0];
}
