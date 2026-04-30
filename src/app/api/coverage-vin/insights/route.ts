import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface BrandInsight {
  year_min: string | null;       // earliest year with covered VINs
  year_max: string | null;       // latest year with covered VINs
  gap_years: string[];           // years where 0 covered but >0 not-found
  year_coverage: Array<{        // per-year breakdown for sparkline
    year: string;
    covered: number;
    not_found: number;
    total: number;
  }>;
  gap_models: Array<{            // models with most uncovered VINs
    model: string;
    not_found: number;
    total: number;
  }>;
  gap_wmis: Array<{              // WMIs (mfr+region) with most uncovered VINs
    wmi: string;
    not_found: number;
    total: number;
  }>;
  gap_markets: Array<{           // manufacturing markets with most uncovered VINs
    market: string;
    not_found: number;
    total: number;
  }>;
}

export type InsightsResponse = Record<string, BrandInsight>;

export async function GET(): Promise<NextResponse> {
  try {
    const snap = await sql`
      SELECT id FROM coverage_vin_snapshots ORDER BY uploaded_at DESC LIMIT 1
    ` as Array<{ id: number }>;

    if (snap.length === 0) {
      return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
    }
    const snapshotId = snap[0].id;

    // ── 1. Year coverage per brand ────────────────────────────────────────────
    const yearRows = await sql`
      SELECT
        UPPER(input_make)                                                     AS brand,
        year,
        COUNT(*) FILTER (WHERE gcs_found = true  AND rule_id IS NULL)::int   AS covered,
        COUNT(*) FILTER (WHERE gcs_found = false AND rule_id IS NULL)::int   AS not_found,
        COUNT(*)::int                                                         AS total
      FROM coverage_vin_data
      WHERE snapshot_id = ${snapshotId}
        AND input_make <> ''
        AND year       <> ''
        AND year IS NOT NULL
        AND year ~ '^\d{4}$'
      GROUP BY UPPER(input_make), year
      ORDER BY UPPER(input_make), year
    ` as Array<{ brand: string; year: string; covered: number; not_found: number; total: number }>;

    // ── 2. Gap models per brand (top 6 with most not-found VINs) ─────────────
    const modelRows = await sql`
      SELECT
        UPPER(input_make) AS brand,
        model,
        COUNT(*) FILTER (WHERE gcs_found = false AND rule_id IS NULL)::int   AS not_found,
        COUNT(*)::int                                                         AS total
      FROM coverage_vin_data
      WHERE snapshot_id = ${snapshotId}
        AND input_make <> ''
        AND model      <> ''
        AND model IS NOT NULL
        AND gcs_found = false
        AND rule_id IS NULL
      GROUP BY UPPER(input_make), model
      ORDER BY UPPER(input_make), not_found DESC
    ` as Array<{ brand: string; model: string; not_found: number; total: number }>;

    // ── 3. Gap WMIs per brand (top 6) ─────────────────────────────────────────
    const wmiRows = await sql`
      SELECT
        UPPER(input_make) AS brand,
        wmi,
        COUNT(*) FILTER (WHERE gcs_found = false AND rule_id IS NULL)::int   AS not_found,
        COUNT(*)::int                                                         AS total
      FROM coverage_vin_data
      WHERE snapshot_id = ${snapshotId}
        AND input_make <> ''
        AND wmi        <> ''
        AND wmi IS NOT NULL
        AND gcs_found = false
        AND rule_id IS NULL
      GROUP BY UPPER(input_make), wmi
      ORDER BY UPPER(input_make), not_found DESC
    ` as Array<{ brand: string; wmi: string; not_found: number; total: number }>;

    // ── 4. Gap markets per brand ───────────────────────────────────────────────
    const marketRows = await sql`
      SELECT
        UPPER(input_make) AS brand,
        market,
        COUNT(*) FILTER (WHERE gcs_found = false AND rule_id IS NULL)::int   AS not_found,
        COUNT(*)::int                                                         AS total
      FROM coverage_vin_data
      WHERE snapshot_id = ${snapshotId}
        AND input_make <> ''
        AND market     <> ''
        AND market IS NOT NULL
        AND gcs_found = false
        AND rule_id IS NULL
      GROUP BY UPPER(input_make), market
      ORDER BY UPPER(input_make), not_found DESC
    ` as Array<{ brand: string; market: string; not_found: number; total: number }>;

    // ── Build per-brand map ───────────────────────────────────────────────────
    const brandMap: Record<string, BrandInsight> = {};

    const ensureBrand = (b: string) => {
      if (!brandMap[b]) {
        brandMap[b] = {
          year_min: null, year_max: null,
          gap_years: [], year_coverage: [],
          gap_models: [], gap_wmis: [], gap_markets: [],
        };
      }
      return brandMap[b];
    };

    // Year data
    for (const r of yearRows) {
      const entry = ensureBrand(r.brand);
      entry.year_coverage.push({ year: r.year, covered: r.covered, not_found: r.not_found, total: r.total });
      if (r.covered > 0) {
        if (!entry.year_min || r.year < entry.year_min) entry.year_min = r.year;
        if (!entry.year_max || r.year > entry.year_max) entry.year_max = r.year;
      }
      if (r.covered === 0 && r.not_found > 0) {
        entry.gap_years.push(r.year);
      }
    }

    // Models — top 6 per brand
    const modelSeen: Record<string, number> = {};
    for (const r of modelRows) {
      modelSeen[r.brand] = (modelSeen[r.brand] ?? 0);
      if (modelSeen[r.brand] < 6) {
        ensureBrand(r.brand).gap_models.push({ model: r.model, not_found: r.not_found, total: r.total });
        modelSeen[r.brand]++;
      }
    }

    // WMIs — top 6 per brand
    const wmiSeen: Record<string, number> = {};
    for (const r of wmiRows) {
      wmiSeen[r.brand] = (wmiSeen[r.brand] ?? 0);
      if (wmiSeen[r.brand] < 6) {
        ensureBrand(r.brand).gap_wmis.push({ wmi: r.wmi, not_found: r.not_found, total: r.total });
        wmiSeen[r.brand]++;
      }
    }

    // Markets — top 5 per brand
    const mktSeen: Record<string, number> = {};
    for (const r of marketRows) {
      mktSeen[r.brand] = (mktSeen[r.brand] ?? 0);
      if (mktSeen[r.brand] < 5) {
        ensureBrand(r.brand).gap_markets.push({ market: r.market, not_found: r.not_found, total: r.total });
        mktSeen[r.brand]++;
      }
    }

    return NextResponse.json(brandMap, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
  }
}
