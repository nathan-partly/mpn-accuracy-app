import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { lookupWmi } from "@/lib/wmi-lookup";

export const dynamic = "force-dynamic";

export interface BrandInsight {
  year_min: string | null;        // earliest year with covered VINs
  year_max: string | null;        // latest year with covered VINs
  gap_years: string[];            // years where 0 covered but >0 not-found
  year_coverage: Array<{          // per-year breakdown for sparkline
    year: string;
    covered: number;
    not_found: number;
    total: number;
  }>;
  model_coverage: Array<{         // all models ≥3 VINs, sorted by pct ASC
    model: string;
    covered: number;
    total: number;
    pct: number;                  // 0–100 coverage %
  }>;
  wmi_coverage: Array<{           // all WMIs ≥3 VINs, sorted by pct ASC
    wmi: string;
    manufacturer: string;         // human-readable name from WMI lookup
    covered: number;
    total: number;
    pct: number;                  // 0–100 coverage %
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

    // ── 2. Model coverage per brand (all models ≥3 VINs, sorted pct ASC) ─────
    const modelRows = await sql`
      SELECT
        UPPER(input_make) AS brand,
        model,
        COUNT(*) FILTER (WHERE gcs_found = true  AND rule_id IS NULL)::int   AS covered,
        COUNT(*)::int                                                         AS total,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE gcs_found = true AND rule_id IS NULL)
          / NULLIF(COUNT(*), 0)
        , 1)::float                                                           AS pct
      FROM coverage_vin_data
      WHERE snapshot_id = ${snapshotId}
        AND input_make <> ''
        AND model      <> ''
        AND model IS NOT NULL
      GROUP BY UPPER(input_make), model
      HAVING COUNT(*) >= 3
      ORDER BY UPPER(input_make), pct ASC, total DESC
    ` as Array<{ brand: string; model: string; covered: number; total: number; pct: number }>;

    // ── 3. WMI coverage per brand (all WMIs ≥3 VINs, sorted pct ASC) ─────────
    const wmiRows = await sql`
      SELECT
        UPPER(input_make) AS brand,
        wmi,
        COUNT(*) FILTER (WHERE gcs_found = true  AND rule_id IS NULL)::int   AS covered,
        COUNT(*)::int                                                         AS total,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE gcs_found = true AND rule_id IS NULL)
          / NULLIF(COUNT(*), 0)
        , 1)::float                                                           AS pct
      FROM coverage_vin_data
      WHERE snapshot_id = ${snapshotId}
        AND input_make <> ''
        AND wmi        <> ''
        AND wmi IS NOT NULL
      GROUP BY UPPER(input_make), wmi
      HAVING COUNT(*) >= 3
      ORDER BY UPPER(input_make), pct ASC, total DESC
    ` as Array<{ brand: string; wmi: string; covered: number; total: number; pct: number }>;

    // ── Build per-brand map ───────────────────────────────────────────────────
    const brandMap: Record<string, BrandInsight> = {};

    const ensureBrand = (b: string) => {
      if (!brandMap[b]) {
        brandMap[b] = {
          year_min: null, year_max: null,
          gap_years: [], year_coverage: [],
          model_coverage: [], wmi_coverage: [],
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

    // Models — up to 20 per brand (sorted pct ASC, so worst-first for client to slice)
    const modelSeen: Record<string, number> = {};
    for (const r of modelRows) {
      modelSeen[r.brand] = (modelSeen[r.brand] ?? 0);
      if (modelSeen[r.brand] < 20) {
        ensureBrand(r.brand).model_coverage.push({
          model: r.model,
          covered: r.covered,
          total: r.total,
          pct: typeof r.pct === "string" ? parseFloat(r.pct) : (r.pct ?? 0),
        });
        modelSeen[r.brand]++;
      }
    }

    // WMIs — up to 15 per brand, with manufacturer name lookup
    const wmiSeen: Record<string, number> = {};
    for (const r of wmiRows) {
      wmiSeen[r.brand] = (wmiSeen[r.brand] ?? 0);
      if (wmiSeen[r.brand] < 15) {
        ensureBrand(r.brand).wmi_coverage.push({
          wmi: r.wmi,
          manufacturer: lookupWmi(r.wmi),
          covered: r.covered,
          total: r.total,
          pct: typeof r.pct === "string" ? parseFloat(r.pct) : (r.pct ?? 0),
        });
        wmiSeen[r.brand]++;
      }
    }

    return NextResponse.json(brandMap, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("VIN insights error:", err);
    return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
  }
}
