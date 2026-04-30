import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { lookupWmi } from "@/lib/wmi-lookup";

export const dynamic = "force-dynamic";

export interface BrandInsight {
  year_coverage: Array<{
    year: string;
    covered: number;
    not_found: number;
    total: number;
    pct: number;
  }>;
  model_coverage: Array<{
    model: string;
    covered: number;
    total: number;
    pct: number;
  }>;
  wmi_coverage: Array<{
    wmi: string;
    manufacturer: string;
    covered: number;
    total: number;
    pct: number;
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

    // ── 1. Year coverage — decoded from VIN position 10 ───────────────────────
    // Position 10 (1-indexed) encodes model year. Letters A-Y = 2010-2030 (modern
    // cycle); digits 1-9 = 2001-2009. CTE avoids repeating the CASE expression.
    const yearRows = await sql`
      WITH decoded AS (
        SELECT
          UPPER(input_make)  AS brand,
          CASE UPPER(SUBSTRING(vin, 10, 1))
            WHEN 'A' THEN '2010' WHEN 'B' THEN '2011' WHEN 'C' THEN '2012'
            WHEN 'D' THEN '2013' WHEN 'E' THEN '2014' WHEN 'F' THEN '2015'
            WHEN 'G' THEN '2016' WHEN 'H' THEN '2017' WHEN 'J' THEN '2018'
            WHEN 'K' THEN '2019' WHEN 'L' THEN '2020' WHEN 'M' THEN '2021'
            WHEN 'N' THEN '2022' WHEN 'P' THEN '2023' WHEN 'R' THEN '2024'
            WHEN 'S' THEN '2025' WHEN 'T' THEN '2026' WHEN 'V' THEN '2027'
            WHEN 'W' THEN '2028' WHEN 'X' THEN '2029' WHEN 'Y' THEN '2030'
            WHEN '1' THEN '2001' WHEN '2' THEN '2002' WHEN '3' THEN '2003'
            WHEN '4' THEN '2004' WHEN '5' THEN '2005' WHEN '6' THEN '2006'
            WHEN '7' THEN '2007' WHEN '8' THEN '2008' WHEN '9' THEN '2009'
            ELSE NULL
          END                AS vin_year,
          gcs_found,
          rule_id
        FROM coverage_vin_data
        WHERE snapshot_id = ${snapshotId}
          AND input_make <> ''
          AND LENGTH(TRIM(vin)) = 17
          AND UPPER(SUBSTRING(TRIM(vin), 1, 3)) <> '7AT'
      )
      SELECT
        brand,
        vin_year,
        COUNT(*) FILTER (WHERE gcs_found = true  AND rule_id IS NULL)::int   AS covered,
        COUNT(*) FILTER (WHERE gcs_found = false AND rule_id IS NULL)::int   AS not_found,
        COUNT(*)::int                                                         AS total,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE gcs_found = true AND rule_id IS NULL)
          / NULLIF(COUNT(*), 0)
        , 1)::float                                                           AS pct
      FROM decoded
      WHERE vin_year IS NOT NULL
      GROUP BY brand, vin_year
      ORDER BY brand, vin_year
    ` as Array<{ brand: string; vin_year: string; covered: number; not_found: number; total: number; pct: number }>;

    // ── 2. Model coverage (all models ≥3 VINs, sorted pct ASC) ───────────────
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

    // ── 3. WMI coverage (all WMIs ≥3 VINs, sorted pct ASC) ──────────────────
    // Non-17-char VINs are Japanese Domestic Market chassis codes — group them
    // all under the synthetic WMI "JDM" rather than showing raw chassis prefixes.
    const wmiRows = await sql`
      SELECT
        UPPER(input_make)                                                     AS brand,
        CASE
          WHEN LENGTH(TRIM(vin)) != 17                           THEN 'JDM'
          WHEN UPPER(SUBSTRING(TRIM(vin), 1, 3)) = '7AT'        THEN 'JDM'
          ELSE wmi
        END                                                                   AS wmi,
        COUNT(*) FILTER (WHERE gcs_found = true  AND rule_id IS NULL)::int   AS covered,
        COUNT(*)::int                                                         AS total,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE gcs_found = true AND rule_id IS NULL)
          / NULLIF(COUNT(*), 0)
        , 1)::float                                                           AS pct
      FROM coverage_vin_data
      WHERE snapshot_id = ${snapshotId}
        AND input_make <> ''
      GROUP BY UPPER(input_make),
        CASE
          WHEN LENGTH(TRIM(vin)) != 17                           THEN 'JDM'
          WHEN UPPER(SUBSTRING(TRIM(vin), 1, 3)) = '7AT'        THEN 'JDM'
          ELSE wmi
        END
      HAVING COUNT(*) >= 3
      ORDER BY UPPER(input_make), pct ASC, total DESC
    ` as Array<{ brand: string; wmi: string; covered: number; total: number; pct: number }>;

    // ── Build per-brand map ───────────────────────────────────────────────────
    const brandMap: Record<string, BrandInsight> = {};

    const ensureBrand = (b: string) => {
      if (!brandMap[b]) {
        brandMap[b] = { year_coverage: [], model_coverage: [], wmi_coverage: [] };
      }
      return brandMap[b];
    };

    for (const r of yearRows) {
      ensureBrand(r.brand).year_coverage.push({
        year: r.vin_year,
        covered: r.covered,
        not_found: r.not_found,
        total: r.total,
        pct: typeof r.pct === "string" ? parseFloat(r.pct) : (r.pct ?? 0),
      });
    }

    for (const r of modelRows) {
      ensureBrand(r.brand).model_coverage.push({
        model: r.model,
        covered: r.covered,
        total: r.total,
        pct: typeof r.pct === "string" ? parseFloat(r.pct) : (r.pct ?? 0),
      });
    }

    for (const r of wmiRows) {
      ensureBrand(r.brand).wmi_coverage.push({
        wmi: r.wmi,
        manufacturer: r.wmi === "JDM" ? "Japanese Domestic Market" : lookupWmi(r.wmi),
        covered: r.covered,
        total: r.total,
        pct: typeof r.pct === "string" ? parseFloat(r.pct) : (r.pct ?? 0),
      });
    }

    return NextResponse.json(brandMap, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("VIN insights error:", err);
    return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
  }
}
