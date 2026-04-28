import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface AccuracyTrendPoint {
  date: string;            // ISO date string (snapshot_date)
  overall_accuracy_pct: number;
  brands_total: number;
  brands_high: number;     // ≥ 99%
  brands_high_sig: number; // ≥ 99% AND ≥50 VINs AND ≥500 parts
  total_vins: number;
  total_parts: number;
  valid_count: number;
  invalid_count: number;
}

export async function GET(): Promise<NextResponse> {
  // For each distinct snapshot_date, compute the global headline metrics
  // using the LATEST snapshot per brand as of that date.
  const rows = await sql`
    WITH upload_dates AS (
      SELECT DISTINCT snapshot_date AS d
      FROM benchmark_snapshots
      ORDER BY d
    ),
    latest_per_brand_per_date AS (
      SELECT DISTINCT ON (ud.d, s.brand_id)
        ud.d                AS snapshot_date,
        s.brand_id,
        s.active_vins,
        s.total_parts,
        s.valid_count,
        s.invalid_count,
        s.accuracy_pct
      FROM upload_dates ud
      JOIN benchmark_snapshots s
        ON s.snapshot_date <= ud.d
      ORDER BY ud.d, s.brand_id, s.snapshot_date DESC, s.created_at DESC
    )
    SELECT
      snapshot_date::text                                                    AS date,
      COUNT(*)                                                               AS brands_total,
      COALESCE(SUM(active_vins), 0)::bigint                                 AS total_vins,
      COALESCE(SUM(total_parts), 0)::bigint                                 AS total_parts,
      COALESCE(SUM(valid_count), 0)::bigint                                 AS valid_count,
      COALESCE(SUM(invalid_count), 0)::bigint                              AS invalid_count,
      CASE
        WHEN COALESCE(SUM(total_parts), 0) = 0 THEN 0
        ELSE ROUND(SUM(valid_count)::numeric / SUM(total_parts) * 100, 2)
      END                                                                   AS overall_accuracy_pct,
      COUNT(*) FILTER (
        WHERE accuracy_pct >= 99
      )                                                                     AS brands_high,
      COUNT(*) FILTER (
        WHERE accuracy_pct >= 99
          AND active_vins  >= 50
          AND total_parts  >= 500
      )                                                                     AS brands_high_sig
    FROM latest_per_brand_per_date
    GROUP BY snapshot_date
    ORDER BY snapshot_date
  `;

  const data: AccuracyTrendPoint[] = (rows as Record<string, unknown>[]).map((r) => ({
    date:                 String(r.date),
    overall_accuracy_pct: Number(r.overall_accuracy_pct),
    brands_total:         Number(r.brands_total),
    brands_high:          Number(r.brands_high),
    brands_high_sig:      Number(r.brands_high_sig),
    total_vins:           Number(r.total_vins),
    total_parts:          Number(r.total_parts),
    valid_count:          Number(r.valid_count),
    invalid_count:        Number(r.invalid_count),
  }));

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
