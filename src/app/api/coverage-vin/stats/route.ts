import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface BrandVinStat {
  brand: string;
  total: number;
  covered: number;
  blocked: number;
  not_found: number;
  coverage_pct: number;
  blocked_pct: number;
  providers: Record<string, number>; // provider → VIN count
}

export interface VinStatsResponse {
  snapshot_id: number | null;
  uploaded_at: string | null;
  total_vins: number;
  brands: BrandVinStat[];
}

export async function GET(): Promise<NextResponse> {
  // Get latest snapshot
  let snapshotId: number | null = null;
  let uploadedAt: string | null = null;
  try {
    const snap = await sql`
      SELECT id, uploaded_at::text FROM coverage_vin_snapshots ORDER BY uploaded_at DESC LIMIT 1
    ` as Array<{ id: number; uploaded_at: string }>;
    if (snap.length > 0) {
      snapshotId = snap[0].id;
      uploadedAt = snap[0].uploaded_at;
    }
  } catch {
    // tables don't exist yet
    return NextResponse.json({ snapshot_id: null, uploaded_at: null, total_vins: 0, brands: [] });
  }

  if (!snapshotId) {
    return NextResponse.json({ snapshot_id: null, uploaded_at: null, total_vins: 0, brands: [] });
  }

  // Per-brand aggregate stats
  const brandRows = await sql`
    SELECT
      input_make                                                                     AS brand,
      COUNT(*)::int                                                                  AS total,
      COUNT(*) FILTER (WHERE gcs_found = true  AND rule_id IS NULL)::int            AS covered,
      COUNT(*) FILTER (WHERE rule_id IS NOT NULL)::int                              AS blocked,
      COUNT(*) FILTER (WHERE gcs_found = false AND rule_id IS NULL)::int            AS not_found,
      ROUND(
        COUNT(*) FILTER (WHERE gcs_found = true AND rule_id IS NULL)::numeric
        / NULLIF(COUNT(*), 0) * 100, 1
      )::float                                                                       AS coverage_pct,
      ROUND(
        COUNT(*) FILTER (WHERE rule_id IS NOT NULL)::numeric
        / NULLIF(COUNT(*), 0) * 100, 1
      )::float                                                                       AS blocked_pct
    FROM coverage_vin_data
    WHERE snapshot_id = ${snapshotId}
    GROUP BY input_make
    ORDER BY COUNT(*) DESC
  ` as Array<{
    brand: string; total: number; covered: number; blocked: number;
    not_found: number; coverage_pct: number; blocked_pct: number;
  }>;

  // Per-brand per-provider counts (unnest providers_found array)
  const provRows = await sql`
    SELECT
      input_make  AS brand,
      prov        AS provider,
      COUNT(*)::int AS cnt
    FROM coverage_vin_data,
         LATERAL unnest(providers_found) AS prov
    WHERE snapshot_id = ${snapshotId}
    GROUP BY input_make, prov
    ORDER BY input_make, cnt DESC
  ` as Array<{ brand: string; provider: string; cnt: number }>;

  // Build provider map: brand → { provider → count }
  const provMap: Record<string, Record<string, number>> = {};
  for (const r of provRows) {
    if (!provMap[r.brand]) provMap[r.brand] = {};
    provMap[r.brand][r.provider] = r.cnt;
  }

  const totalVins = brandRows.reduce((s, r) => s + r.total, 0);

  const brands: BrandVinStat[] = brandRows.map((r) => ({
    brand:        r.brand,
    total:        r.total,
    covered:      r.covered,
    blocked:      r.blocked,
    not_found:    r.not_found,
    coverage_pct: r.coverage_pct ?? 0,
    blocked_pct:  r.blocked_pct ?? 0,
    providers:    provMap[r.brand] ?? {},
  }));

  return NextResponse.json(
    { snapshot_id: snapshotId, uploaded_at: uploadedAt, total_vins: totalVins, brands } satisfies VinStatsResponse,
    { headers: { "Cache-Control": "no-store" } }
  );
}
