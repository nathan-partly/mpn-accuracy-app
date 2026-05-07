import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export type Market = "all" | "nz" | "uk" | "au" | "us";

function quarterLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

function quarterSortKey(label: string): number {
  const parts = label.split(" ");
  const q = parseInt(parts[0].replace("Q", ""), 10);
  const yr = parseInt(parts[1], 10);
  return yr * 10 + q;
}

/** Per-quarter integration sources shown in the tooltip */
export type RoadmapBrandMeta = Record<string, string[]>; // quarter → integration names

export interface RoadmapBrand {
  brand: string;
  today: number;
  totalVins: number;
  /** Integration names that contribute a gain in each quarter (for tooltip display) */
  _meta: RoadmapBrandMeta;
  [quarter: string]: number | string | RoadmapBrandMeta;
}

export interface RoadmapResponse {
  data: RoadmapBrand[];
  quarters: string[];
  market: Market;
  /** Present when at least one undated integration contributes gains; always "TBD" if set */
  undatedKey: string | null;
}

type BrandIncrementalMap = Record<string, { nz: number | null; uk: number | null; au: number | null; us: number | null }>;

interface Integration {
  id: number;
  name: string;
  brands: string[];
  integration_date: string | null;
  incremental_vio_pct: number | null;
  incremental_nz_pct: number | null;
  incremental_uk_pct: number | null;
  incremental_au_pct: number | null;
  incremental_us_pct: number | null;
  brand_incremental: BrandIncrementalMap | null;
}

/** Pick the right incremental field for a market, falling back to global/4 as rough estimate */
function marketIncremental(integ: Integration, market: Market): number {
  switch (market) {
    case "nz": return integ.incremental_nz_pct ?? 0;
    case "uk": return integ.incremental_uk_pct ?? 0;
    case "au": return integ.incremental_au_pct ?? 0;
    case "us": return integ.incremental_us_pct ?? 0;
    default:   return integ.incremental_vio_pct ?? 0;
  }
}

/** The region key inside the coverage snapshot JSON */
function regionKey(market: Market): string {
  switch (market) {
    case "nz": return "NZ";
    case "uk": return "UK";
    case "au": return "AU";
    case "us": return "US";
    default:   return "ALL"; // combined across all regions
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const market = (searchParams.get("market") ?? "all") as Market;
  const debugMode = searchParams.get("debug") === "1";
  const todayISO = new Date().toISOString().split("T")[0];

  // ── 1. Per-brand coverage from VIN sample data (block-rule-adjusted) ──────────
  // Query coverage_vin_data directly so we can apply `rule_id IS NULL` — this
  // excludes VINs whose "coverage" came from a block rule match rather than genuine
  // GCS lookup, matching the adjusted figures shown on the main VIN Coverage Dashboard.
  // marketCount: how many of the four markets a brand actually has VINs in.
  // Used as the divisor when averaging per-market incremental gains for the "all" view —
  // e.g. Vauxhall (UK only) → ÷1; Holden (NZ+AU) → ÷2; Toyota (all four) → ÷4.
  const brandCoverage: Record<string, { today: number; totalVins: number; marketCount: number }> = {};
  try {
    // Get latest VIN snapshot id
    const snapRows = await sql`
      SELECT id FROM coverage_vin_snapshots
      ORDER BY uploaded_at DESC LIMIT 1
    `;
    if (snapRows.length > 0) {
      const snapId = (snapRows[0] as { id: number }).id;

      // For a specific market, filter by that region; for "all", aggregate across all regions.
      // totalVins    = total VINs regardless of rule_id (the full VIO universe for this brand/market)
      // covered      = VINs where gcs_found = true AND no block rule applied
      // market_count = number of distinct markets (NZ/UK/AU/US) the brand has VINs in
      if (market === "all") {
        const brandRows = (await sql`
          SELECT
            UPPER(input_make)                                                         AS brand,
            COUNT(*) FILTER (WHERE gcs_found = true AND rule_id IS NULL)::text        AS covered,
            COUNT(*)::text                                                             AS total,
            COUNT(DISTINCT UPPER(input_region))
              FILTER (WHERE UPPER(input_region) IN ('NZ','UK','AU','US'))::text        AS market_count
          FROM coverage_vin_data
          WHERE snapshot_id = ${snapId}
          GROUP BY UPPER(input_make)
        `) as Array<{ brand: string; covered: string; total: string; market_count: string }>;

        for (const row of brandRows) {
          const total       = parseInt(row.total,        10) || 0;
          const covered     = parseInt(row.covered,      10) || 0;
          const marketCount = parseInt(row.market_count, 10) || 1;
          const pct         = total > 0 ? (covered / total) * 100 : 0;
          brandCoverage[row.brand] = { today: pct, totalVins: total, marketCount };
        }
      } else {
        const regionFilter = regionKey(market); // "NZ" | "UK" | "AU" | "US"
        const brandRows = (await sql`
          SELECT
            UPPER(input_make)                                                   AS brand,
            COUNT(*) FILTER (WHERE gcs_found = true AND rule_id IS NULL)::text AS covered,
            COUNT(*)::text                                                      AS total
          FROM coverage_vin_data
          WHERE snapshot_id = ${snapId}
            AND UPPER(input_region) = UPPER(${regionFilter})
          GROUP BY UPPER(input_make)
        `) as Array<{ brand: string; covered: string; total: string }>;

        for (const row of brandRows) {
          const total   = parseInt(row.total,   10) || 0;
          const covered = parseInt(row.covered, 10) || 0;
          const pct     = total > 0 ? (covered / total) * 100 : 0;
          brandCoverage[row.brand] = { today: pct, totalVins: total, marketCount: 1 };
        }
      }
    }
  } catch {
    // No VIN snapshot — all brands show 0% today
  }

  // ── 2. Integrations — ensure market columns exist before selecting them ────────
  try {
    await sql`
      ALTER TABLE data_integrations
        ADD COLUMN IF NOT EXISTS incremental_nz_pct float,
        ADD COLUMN IF NOT EXISTS incremental_uk_pct float,
        ADD COLUMN IF NOT EXISTS incremental_au_pct float,
        ADD COLUMN IF NOT EXISTS incremental_us_pct float,
        ADD COLUMN IF NOT EXISTS brand_incremental jsonb
    `;
  } catch { /* already applied */ }

  let integrations: Integration[] = [];
  try {
    // NOTE: alias brand_incremental_json (not brand_incremental) avoids a Neon HTTP driver
    // issue where aliasing a cast column with the original column name causes it to return
    // the raw JSONB type instead of the cast text type in production environments.
    const rows = await sql`
      SELECT
        id,
        name,
        brands,
        integration_date::text     AS integration_date,
        incremental_vio_pct::float AS incremental_vio_pct,
        incremental_nz_pct::float  AS incremental_nz_pct,
        incremental_uk_pct::float  AS incremental_uk_pct,
        incremental_au_pct::float  AS incremental_au_pct,
        incremental_us_pct::float  AS incremental_us_pct,
        brand_incremental::text AS brand_incremental_json
      FROM data_integrations
      ORDER BY integration_date ASC
    `;
    integrations = (rows as Array<Omit<Integration, "brand_incremental"> & { brand_incremental_json: string | BrandIncrementalMap | null }>).map((r) => {
      const raw = (r as Record<string, unknown>).brand_incremental_json;
      let parsed: BrandIncrementalMap | null = null;
      if (raw) {
        try {
          parsed = typeof raw === "string" ? JSON.parse(raw) : (raw as BrandIncrementalMap);
        } catch { parsed = null; }
      }
      const { brand_incremental_json: _drop, ...rest } = r as Record<string, unknown> & { brand_incremental_json: unknown };
      return { ...rest, brand_incremental: parsed } as unknown as Integration;
    });
  } catch {
    integrations = [];
  }

  // ── 2b. Fresh brand_incremental lookup for future integrations ───────────────
  // Neon's sequential scan can return stale JSONB page data after writes. Re-fetch
  // brand_incremental for all future integrations using a date-filtered query,
  // which forces a fresh read and always returns committed data.
  try {
    const freshRows = await sql`
      SELECT id, brand_incremental::text AS bi_fresh
      FROM data_integrations
      WHERE integration_date > ${todayISO} OR integration_date IS NULL
    `;
    const freshMap: Record<number, BrandIncrementalMap | null> = {};
    for (const row of freshRows as Array<{ id: number; bi_fresh: string | null }>) {
      let parsed: BrandIncrementalMap | null = null;
      if (row.bi_fresh) {
        try { parsed = JSON.parse(row.bi_fresh); } catch { parsed = null; }
      }
      freshMap[row.id] = parsed;
    }
    // Override sequential-scan values with fresh reads
    for (const integ of integrations) {
      if (integ.id in freshMap) {
        integ.brand_incremental = freshMap[integ.id] ?? null;
      }
    }
  } catch {
    // Non-fatal: fall back to sequential scan values already loaded above
  }

  // ── 3. Collect all brands that appear in any integration ─────────────────────
  // Only show brands that are part of at least one integration (live or upcoming)
  const integrationBrands: Record<string, true> = {};
  for (const integ of integrations) {
    for (const b of (integ.brands ?? [])) integrationBrands[b.toUpperCase()] = true;
  }

  // ── 4. Per-brand, per-quarter gains ──────────────────────────────────────────
  // Accumulate gains across ALL upcoming integrations, keyed by brand → quarter.
  // Priority: brand_incremental[brand][market] > integration market total / brandCount > 0
  // We skip zero-gain entries so that a brand with no NZ data in an earlier integration
  // doesn't block a positive gain in a later one.
  const brandQuarterGains: Record<string, Record<string, number>> = {};
  // Track which integration names contribute a gain per brand per quarter (for tooltip)
  const brandQuarterIntegrations: Record<string, Record<string, string[]>> = {};

  for (const integ of integrations) {
    // Skip live integrations (past date) — they're already in "today"
    if (integ.integration_date && integ.integration_date < todayISO) continue;
    // Undated = "TBD" bucket (shown with hatching); dated future = its calendar quarter
    const q = integ.integration_date ? quarterLabel(integ.integration_date) : "TBD";
    const totalIncremental = marketIncremental(integ, market);
    const brandCount = (integ.brands ?? []).length || 1;

    for (const brand of (integ.brands ?? [])) {
      const key = brand.toUpperCase();

      // Resolve per-brand coverage gain (as % of that brand's own VIN universe).
      //
      // Priority order:
      //   1. brand_incremental[brand][market]  — explicit per-brand per-market value
      //   2. For market="all": average of all non-null market values in brand_incremental[brand]
      //      (e.g. FIAT: NZ=65, UK=70 → avg 67.5% of Fiat VINs gained)
      //   3. totalIncremental / brandCount     — last-resort fallback using global VIO %
      //      (NOTE: this is a different unit — % of global VIO — so it will understate
      //       the brand-level gain for small brands. Always prefer per-brand values.)
      let perBrand: number;
      if (integ.brand_incremental) {
        const brandData = integ.brand_incremental[key] ?? integ.brand_incremental[brand];
        if (brandData) {
          if (market !== "all") {
            // Specific market: use that market's value, fall back to global estimate
            const mVal = brandData[market as "nz" | "uk" | "au" | "us"];
            perBrand = mVal != null ? mVal : totalIncremental / brandCount;
          } else {
            // "All" market: global VIO averages across only the markets the brand
            // exists in (derived from the VIN sample data). e.g.:
            //   Vauxhall (UK only)  → divisor = 1
            //   Holden (NZ + AU)    → divisor = 2
            //   Toyota (all four)   → divisor = 4
            // Markets with no per-brand gain entered contribute 0, not nothing.
            const hasAny = (["nz", "uk", "au", "us"] as const).some((m) => brandData[m] != null);
            if (hasAny) {
              const sum = (["nz", "uk", "au", "us"] as const)
                .reduce((s, m) => s + (brandData[m] ?? 0), 0);
              const divisor = (brandCoverage[key] ?? brandCoverage[brand])?.marketCount ?? 4;
              perBrand = sum / Math.max(1, divisor);
            } else {
              perBrand = totalIncremental / brandCount;
            }
          }
        } else {
          perBrand = totalIncremental / brandCount;
        }
      } else {
        perBrand = totalIncremental / brandCount;
      }

      // Only record positive gains — zero means "no data for this brand/market"
      if (perBrand > 0) {
        if (!brandQuarterGains[key]) brandQuarterGains[key] = {};
        brandQuarterGains[key][q] = (brandQuarterGains[key][q] ?? 0) + perBrand;

        // Track integration name for tooltip
        if (!brandQuarterIntegrations[key]) brandQuarterIntegrations[key] = {};
        if (!brandQuarterIntegrations[key][q]) brandQuarterIntegrations[key][q] = [];
        if (integ.name && !brandQuarterIntegrations[key][q].includes(integ.name)) {
          brandQuarterIntegrations[key][q].push(integ.name);
        }
      }
    }
  }

  // ── 5. Build result rows ──────────────────────────────────────────────────────
  const quartersFound: Record<string, true> = {};
  const rows: RoadmapBrand[] = [];

  for (const brand of Object.keys(integrationBrands)) {
    const cov = brandCoverage[brand] ?? { today: 0, totalVins: 0 };
    const gains = brandQuarterGains[brand] ?? {};

    const row: RoadmapBrand = {
      brand,
      today: parseFloat(cov.today.toFixed(2)),
      totalVins: cov.totalVins,
      _meta: brandQuarterIntegrations[brand] ?? {},
    };

    for (const [q, increment] of Object.entries(gains)) {
      row[q] = parseFloat(increment.toFixed(2));
      quartersFound[q] = true;
    }

    rows.push(row);
  }

  // Sort by totalVins desc (market importance), then alphabetical
  rows.sort((a, b) => (b.totalVins - a.totalVins) || a.brand.localeCompare(b.brand));

  // Always include every brand that has a positive upcoming gain (they're the whole point of the chart).
  // Fill remaining slots up to 35 with brands that have no gains, sorted by totalVins.
  const hasGain = (r: RoadmapBrand) =>
    Object.keys(brandQuarterGains[r.brand] ?? {}).some((q) => (brandQuarterGains[r.brand]![q] ?? 0) > 0);
  const withGains    = rows.filter(hasGain);
  const withoutGains = rows.filter((r) => !hasGain(r));
  const topRows = [
    ...withGains,
    ...withoutGains.slice(0, Math.max(0, 35 - withGains.length)),
  ];

  const quarters = Object.keys(quartersFound)
    .filter((q) => q !== "TBD")
    .sort((a, b) => quarterSortKey(a) - quarterSortKey(b));
  if (quartersFound["TBD"]) quarters.push("TBD");

  // Zero-fill quarter keys
  for (const row of topRows) {
    for (const q of quarters) {
      if (!(q in row)) row[q] = 0;
    }
  }

  // Cap stacked totals to 100% — today + cumulative gains cannot exceed 100.
  // Quarters are already sorted chronologically, so we consume headroom in order.
  // e.g. today=35%, Q2 gain=80% → Q2 capped at 65% (no headroom left for Q3+).
  for (const row of topRows) {
    let headroom = Math.max(0, 100 - (row.today as number));
    for (const q of quarters) {
      const gain = row[q] as number;
      const capped = Math.min(gain, headroom);
      row[q] = parseFloat(capped.toFixed(2));
      headroom = Math.max(0, headroom - capped);
    }
  }

  if (debugMode) {
    // Also fetch raw DB values so we can compare pre/post parse
    let rawDbRows: unknown[] = [];
    try {
      rawDbRows = (await sql`
        SELECT id, brands, integration_date::text,
               brand_incremental::text AS bi_text,
               brand_incremental       AS bi_raw
        FROM data_integrations
        WHERE id IN (16, 19, 9, 10, 13)
        ORDER BY id
      `).map((r: Record<string, unknown>) => ({
        id: r.id,
        bi_text_typeof: typeof r.bi_text,
        bi_text_value:  r.bi_text,
        bi_raw_typeof:  typeof r.bi_raw,
        bi_raw_isNull:  r.bi_raw == null,
        parse_result: (() => {
          try {
            if (!r.bi_text) return null;
            return JSON.parse(r.bi_text as string);
          } catch (e) { return `PARSE_ERROR: ${e}`; }
        })(),
      }));
    } catch (e) {
      rawDbRows = [{ error: String(e) }];
    }

    // Return raw intermediate state so we can see exactly what the deployed code computed
    return NextResponse.json({
      todayISO,
      market,
      integrationsCount: integrations.length,
      rawDbRows,
      futureIntegrations: integrations
        .filter((i) => !i.integration_date || i.integration_date > todayISO)
        .map((i) => ({
          integration_date: i.integration_date,
          brands: i.brands,
          totalIncremental: marketIncremental(i, market),
          brand_incremental_typeof: typeof i.brand_incremental,
          brand_incremental_isNull: i.brand_incremental == null,
          brand_incremental_value: i.brand_incremental,
        })),
      brandQuarterGains,
      quartersFound: Object.keys(quartersFound),
      integrationBrandsCount: Object.keys(integrationBrands).length,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { data: topRows, quarters, market, undatedKey: quartersFound["TBD"] ? "TBD" : null } satisfies RoadmapResponse,
    { headers: { "Cache-Control": "no-store" } }
  );
}
