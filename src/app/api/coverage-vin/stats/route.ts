import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface BlockRuleDetail {
  region: string;
  rule_id: string;
  rule_name: string | null;
  rule_provider: string | null;
  blocked_count: number;
  region_total: number;
  impact_pct: number; // blocked_count / region_total * 100
}

export interface BrandVinStat {
  brand: string;
  total: number;
  covered: number;
  blocked: number;
  not_found: number;
  coverage_pct: number;
  blocked_pct: number;
  providers: Record<string, number>;
  block_rules: BlockRuleDetail[];
}

export interface VinStatsResponse {
  snapshot_id: number | null;
  uploaded_at: string | null;
  total_vins: number;
  brands: BrandVinStat[];
}

export async function GET(): Promise<NextResponse> {
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
    return NextResponse.json({ snapshot_id: null, uploaded_at: null, total_vins: 0, brands: [] });
  }

  if (!snapshotId) {
    return NextResponse.json({ snapshot_id: null, uploaded_at: null, total_vins: 0, brands: [] });
  }

  // ── 1. Per-brand aggregate stats ───────────────────────────────────────────
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

  // ── 2. Per-brand per-provider counts ───────────────────────────────────────
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

  const provMap: Record<string, Record<string, number>> = {};
  for (const r of provRows) {
    if (!provMap[r.brand]) provMap[r.brand] = {};
    provMap[r.brand][r.provider] = r.cnt;
  }

  // ── 3. Block rule breakdown: per (brand × region × rule) ──────────────────
  // Join with per-(brand × region) totals so we can compute impact_pct.
  const ruleRows = await sql`
    WITH region_totals AS (
      SELECT input_make, input_region, COUNT(*)::int AS region_total
      FROM coverage_vin_data
      WHERE snapshot_id = ${snapshotId}
      GROUP BY input_make, input_region
    )
    SELECT
      d.input_make                AS brand,
      d.input_region              AS region,
      d.rule_id,
      d.rule_name,
      d.rule_provider,
      COUNT(*)::int               AS blocked_count,
      rt.region_total,
      ROUND(COUNT(*)::numeric / NULLIF(rt.region_total, 0) * 100, 1)::float AS impact_pct
    FROM coverage_vin_data d
    JOIN region_totals rt
      ON rt.input_make = d.input_make AND rt.input_region = d.input_region
    WHERE d.snapshot_id = ${snapshotId}
      AND d.rule_id IS NOT NULL
    GROUP BY d.input_make, d.input_region, d.rule_id, d.rule_name, d.rule_provider, rt.region_total
    ORDER BY d.input_make, d.input_region, blocked_count DESC
  ` as Array<{
    brand: string; region: string; rule_id: string; rule_name: string | null;
    rule_provider: string | null; blocked_count: number; region_total: number; impact_pct: number;
  }>;

  // Build rule map: brand → BlockRuleDetail[]
  const ruleMap: Record<string, BlockRuleDetail[]> = {};
  for (const r of ruleRows) {
    if (!ruleMap[r.brand]) ruleMap[r.brand] = [];
    ruleMap[r.brand].push({
      region:        r.region,
      rule_id:       r.rule_id,
      rule_name:     r.rule_name,
      rule_provider: r.rule_provider,
      blocked_count: r.blocked_count,
      region_total:  r.region_total,
      impact_pct:    r.impact_pct ?? 0,
    });
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
    block_rules:  ruleMap[r.brand] ?? [],
  }));

  return NextResponse.json(
    { snapshot_id: snapshotId, uploaded_at: uploadedAt, total_vins: totalVins, brands } satisfies VinStatsResponse,
    { headers: { "Cache-Control": "no-store" } }
  );
}
