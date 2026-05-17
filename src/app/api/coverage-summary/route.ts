import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface CoverageSummaryRegion {
  region: string;
  snapshot_date: string;
  rate: number;
  total_y: number;
  total_vins: number;
  brand_count: number;
}

export interface CoverageSummaryResponse {
  /** Overall rate across all regions (weighted by VIN count) */
  overall_rate: number;
  total_y: number;
  total_vins: number;
  /** Per-region breakdown from the latest non-baseline snapshot for each region */
  by_region: CoverageSummaryRegion[];
  /** ISO date of the oldest snapshot included */
  earliest_date: string | null;
  /** ISO date of the most recent snapshot included */
  latest_date: string | null;
}

export async function GET(): Promise<NextResponse> {
  try {
    // Latest non-baseline snapshot per region
    const byRegion = await sql`
      WITH latest_per_region AS (
        SELECT DISTINCT ON (region)
          id,
          region,
          snapshot_date::text AS snapshot_date
        FROM coverage_sample_snapshots
        WHERE is_baseline = false
        ORDER BY region, snapshot_date DESC, created_at DESC
      )
      SELECT
        lpr.region,
        lpr.snapshot_date,
        COUNT(DISTINCT r.make)::int                                              AS brand_count,
        COALESCE(SUM(r.y), 0)::int                                              AS total_y,
        COALESCE(SUM(r.total), 0)::int                                          AS total_vins,
        ROUND(
          100.0 * COALESCE(SUM(r.y), 0)::numeric
          / NULLIF(COALESCE(SUM(r.total), 0)::numeric, 0)
        , 1)::float                                                              AS rate
      FROM latest_per_region lpr
      LEFT JOIN coverage_sample_rows r ON r.snapshot_id = lpr.id
      GROUP BY lpr.region, lpr.snapshot_date
      ORDER BY lpr.region
    ` as Array<{
      region: string;
      snapshot_date: string;
      brand_count: number;
      total_y: number;
      total_vins: number;
      rate: number;
    }>;

    const totalY    = byRegion.reduce((s, r) => s + r.total_y, 0);
    const totalVins = byRegion.reduce((s, r) => s + r.total_vins, 0);
    const overallRate = totalVins > 0
      ? parseFloat((100 * totalY / totalVins).toFixed(1))
      : 0;

    const dates = byRegion.map((r) => r.snapshot_date).filter(Boolean).sort();

    const result: CoverageSummaryResponse = {
      overall_rate: overallRate,
      total_y: totalY,
      total_vins: totalVins,
      by_region: byRegion.map((r) => ({
        region: r.region,
        snapshot_date: r.snapshot_date,
        rate: typeof r.rate === "string" ? parseFloat(r.rate) : (r.rate ?? 0),
        total_y: r.total_y,
        total_vins: r.total_vins,
        brand_count: r.brand_count,
      })),
      earliest_date: dates[0] ?? null,
      latest_date: dates[dates.length - 1] ?? null,
    };

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("coverage-summary error:", err);
    return NextResponse.json(
      { overall_rate: 0, total_y: 0, total_vins: 0, by_region: [], earliest_date: null, latest_date: null },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
