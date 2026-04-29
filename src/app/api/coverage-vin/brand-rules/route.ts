import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface BrandRuleEntry {
  brand: string;        // normalised UPPERCASE
  region: string;       // UK | NZ | US | AU
  rule_id: string;
  rule_name: string | null;
  rule_provider: string | null;
  blocked_count: number;
  region_total: number;
  impact_pct: number;   // blocked_count / region_total * 100
}

export async function GET(): Promise<NextResponse> {
  try {
    // Get latest snapshot
    const snap = await sql`
      SELECT id FROM coverage_vin_snapshots ORDER BY uploaded_at DESC LIMIT 1
    ` as Array<{ id: number }>;

    if (snap.length === 0) {
      return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
    }
    const snapshotId = snap[0].id;

    const rows = await sql`
      WITH region_totals AS (
        SELECT
          UPPER(input_make)   AS brand,
          UPPER(input_region) AS region,
          COUNT(*)::int        AS region_total
        FROM coverage_vin_data
        WHERE snapshot_id = ${snapshotId}
          AND input_make   <> ''
          AND input_region <> ''
        GROUP BY UPPER(input_make), UPPER(input_region)
      )
      SELECT
        UPPER(d.input_make)   AS brand,
        UPPER(d.input_region) AS region,
        d.rule_id,
        d.rule_name,
        d.rule_provider,
        COUNT(*)::int         AS blocked_count,
        rt.region_total,
        ROUND(COUNT(*)::numeric / NULLIF(rt.region_total, 0) * 100, 2)::float AS impact_pct
      FROM coverage_vin_data d
      JOIN region_totals rt
        ON rt.brand  = UPPER(d.input_make)
       AND rt.region = UPPER(d.input_region)
      WHERE d.snapshot_id  = ${snapshotId}
        AND d.rule_id      IS NOT NULL
        AND d.rule_id      <> ''
        AND d.input_make   <> ''
        AND d.input_region <> ''
      GROUP BY
        UPPER(d.input_make), UPPER(d.input_region),
        d.rule_id, d.rule_name, d.rule_provider,
        rt.region_total
      ORDER BY
        UPPER(d.input_make), UPPER(d.input_region), blocked_count DESC
    ` as BrandRuleEntry[];

    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Tables don't exist yet — return empty
    return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
  }
}
