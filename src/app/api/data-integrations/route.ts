import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type MarketDBValue = { type: "fixed" | "target"; value: number } | number | null;
export type BrandIncrementalMap = Record<string, { nz: MarketDBValue; uk: MarketDBValue; au: MarketDBValue; us: MarketDBValue }>;

/** Resolve the numeric gain value from a market cell.
 *  - Fixed / legacy number → returns value directly.
 *  - Target → gain = max(0, target − currentCovPct). Requires current coverage to be passed in.
 *  Returns null when the value is missing. */
function resolveMarketGain(mv: MarketDBValue, currentCovPct: number): number | null {
  if (mv == null) return null;
  if (typeof mv === "number") return mv; // legacy plain-number format (fixed)
  if (mv.type === "fixed") return mv.value;
  if (mv.type === "target") return Math.max(0, mv.value - currentCovPct);
  return null;
}

/** Normalise a brand name for fuzzy matching across sources.
 *  Converts to uppercase, replaces punctuation/hyphens with spaces, collapses whitespace. */
function normBrand(s: string): string {
  return s.toUpperCase().replace(/[-_/\\]+/g, " ").replace(/\s+/g, " ").trim();
}

export type DataAvailability = "integrated" | "available" | "high_confidence" | "low_confidence" | null;

export interface DataIntegration {
  id: number;
  name: string;
  type: "online" | "offline";
  relationship: "direct" | "third-party";
  brands: string[];
  total_vio_pct: number | null;
  incremental_vio_pct: number | null;
  incremental_nz_pct: number | null;
  incremental_uk_pct: number | null;
  incremental_au_pct: number | null;
  incremental_us_pct: number | null;
  brand_incremental: BrandIncrementalMap | null;
  data_availability: DataAvailability;
  annual_cost: number | null;
  cost_per_vin: number | null;
  integration_date: string | null;
  created_at: string;
  updated_at: string;
  /** Auto-computed from sample snapshot brand shares when total_vio_pct is null */
  computed_total_vio_pct: number | null;
  /** Auto-computed from brand_incremental × brand share when incremental_vio_pct is null */
  computed_incremental_vio_pct: number | null;
  /** Auto-computed per-market incremental from brand_incremental data */
  computed_incremental_nz_pct: number | null;
  computed_incremental_uk_pct: number | null;
  computed_incremental_au_pct: number | null;
  computed_incremental_us_pct: number | null;
}

function n(v: unknown): number | null {
  return v != null && v !== "" ? Number(v) : null;
}

export async function GET() {
  try {
    // Idempotent migration — adds columns if they don't exist yet
    await sql`
      ALTER TABLE data_integrations
        ADD COLUMN IF NOT EXISTS incremental_nz_pct float,
        ADD COLUMN IF NOT EXISTS incremental_uk_pct float,
        ADD COLUMN IF NOT EXISTS incremental_au_pct float,
        ADD COLUMN IF NOT EXISTS incremental_us_pct float,
        ADD COLUMN IF NOT EXISTS brand_incremental jsonb,
        ADD COLUMN IF NOT EXISTS data_availability text,
        ADD COLUMN IF NOT EXISTS annual_cost float,
        ADD COLUMN IF NOT EXISTS cost_per_vin float
    `;
  } catch {
    // Migration failed (e.g. already applied) — continue anyway
  }
  try {
    // Allow integration_date to be NULL (undated future targets)
    await sql`ALTER TABLE data_integrations ALTER COLUMN integration_date DROP NOT NULL`;
  } catch {
    // Already nullable — ignore
  }

  try {
    // ── 1. Fetch integrations ──────────────────────────────────────────────────
    const rows = await sql`
      SELECT
        id, name, type, relationship, brands,
        total_vio_pct::float          AS total_vio_pct,
        incremental_vio_pct::float    AS incremental_vio_pct,
        incremental_nz_pct::float     AS incremental_nz_pct,
        incremental_uk_pct::float     AS incremental_uk_pct,
        incremental_au_pct::float     AS incremental_au_pct,
        incremental_us_pct::float     AS incremental_us_pct,
        brand_incremental::text       AS brand_incremental_json,
        data_availability,
        annual_cost::float            AS annual_cost,
        cost_per_vin::float           AS cost_per_vin,
        integration_date::text        AS integration_date,
        created_at, updated_at
      FROM data_integrations
      ORDER BY integration_date ASC NULLS LAST, id ASC
    `;

    // Parse brand_incremental JSONB text (Neon HTTP driver workaround)
    type RawRow = Record<string, unknown> & { brand_incremental_json: string | null };
    const integrations = (rows as RawRow[]).map((r) => {
      let brand_incremental: BrandIncrementalMap | null = null;
      if (r.brand_incremental_json) {
        try { brand_incremental = JSON.parse(r.brand_incremental_json); } catch { /* ignore */ }
      }
      const { brand_incremental_json: _drop, ...rest } = r;
      void _drop;
      return { ...rest, brand_incremental } as unknown as DataIntegration;
    });

    // ── 2. Fetch brand totals — global (for total_vio_pct) AND per-market (for per-market incremental) ──
    // Per-market shares are essential for accurate market incrementals: a brand like Vauxhall is 3% of the
    // UK sample but only ~1% of the combined global sample, so using global shares understates UK impact.

    type BrandMap = Map<string, number>;
    // Global maps (all regions combined) — used for total_vio_pct and global incremental
    const brandShareMap    = new Map<string, number>();
    const brandCoverageMap = new Map<string, number>();
    // Per-market maps — used for per-market incremental calculations
    const mktShareMap:    Record<"nz"|"uk"|"au"|"us", BrandMap> = { nz: new Map(), uk: new Map(), au: new Map(), us: new Map() };
    const mktCoverageMap: Record<"nz"|"uk"|"au"|"us", BrandMap> = { nz: new Map(), uk: new Map(), au: new Map(), us: new Map() };

    const regionToMarket: Record<string, "nz"|"uk"|"au"|"us"> = { NZ: "nz", UK: "uk", AU: "au", US: "us" };

    try {
      // Step A: get the latest non-baseline snapshot id AND region per region
      const latestSnaps = await sql`
        SELECT DISTINCT ON (region) id, region
        FROM coverage_sample_snapshots
        WHERE is_baseline = false
        ORDER BY region, snapshot_date DESC, created_at DESC
      ` as Array<{ id: number; region: string }>;

      if (latestSnaps.length > 0) {
        const snapIds = latestSnaps.map((s) => s.id);

        // Step B: per-region brand rows (to build per-market share maps)
        const perRegionRows = await sql`
          SELECT
            csr.snapshot_id,
            css.region,
            UPPER(csr.make) AS make,
            csr.total::int  AS total,
            csr.y::int      AS covered
          FROM coverage_sample_rows csr
          JOIN coverage_sample_snapshots css ON css.id = csr.snapshot_id
          WHERE csr.snapshot_id = ANY(${snapIds})
        ` as Array<{ snapshot_id: number; region: string; make: string; total: number; covered: number }>;

        // Build per-market maps
        const mktRawTotals: Record<string, Record<string, { t: number; c: number }>> = {};
        for (const row of perRegionRows) {
          const mkt = regionToMarket[row.region.toUpperCase()];
          if (!mkt) continue;
          const t = typeof row.total   === "string" ? parseInt(row.total,   10) : (row.total   ?? 0);
          const c = typeof row.covered === "string" ? parseInt(row.covered, 10) : (row.covered ?? 0);
          if (!mktRawTotals[mkt]) mktRawTotals[mkt] = {};
          const prev = mktRawTotals[mkt][row.make] ?? { t: 0, c: 0 };
          mktRawTotals[mkt][row.make] = { t: prev.t + t, c: prev.c + c };
        }
        for (const [mkt, brands] of Object.entries(mktRawTotals)) {
          const m = mkt as "nz"|"uk"|"au"|"us";
          const mktTotal = Object.values(brands).reduce((s, v) => s + v.t, 0);
          if (mktTotal <= 0) continue;
          for (const [brand, { t, c }] of Object.entries(brands)) {
            const share   = parseFloat(((t / mktTotal) * 100).toFixed(2));
            const covRate = t > 0 ? parseFloat(((c / t) * 100).toFixed(2)) : 0;
            mktShareMap[m].set(brand, share);
            mktShareMap[m].set(normBrand(brand), share);
            mktCoverageMap[m].set(brand, covRate);
            mktCoverageMap[m].set(normBrand(brand), covRate);
          }
        }

        // Build global maps (sum across all regions)
        const globalRaw: Record<string, { t: number; c: number }> = {};
        for (const row of perRegionRows) {
          const t = typeof row.total   === "string" ? parseInt(row.total,   10) : (row.total   ?? 0);
          const c = typeof row.covered === "string" ? parseInt(row.covered, 10) : (row.covered ?? 0);
          const prev = globalRaw[row.make] ?? { t: 0, c: 0 };
          globalRaw[row.make] = { t: prev.t + t, c: prev.c + c };
        }
        const grandTotal = Object.values(globalRaw).reduce((s, v) => s + v.t, 0);
        if (grandTotal > 0) {
          for (const [brand, { t, c }] of Object.entries(globalRaw)) {
            const share   = parseFloat(((t / grandTotal) * 100).toFixed(2));
            const covRate = t > 0 ? parseFloat(((c / t) * 100).toFixed(2)) : 0;
            brandShareMap.set(brand, share);
            brandShareMap.set(normBrand(brand), share);
            brandCoverageMap.set(brand, covRate);
            brandCoverageMap.set(normBrand(brand), covRate);
          }
        }
      }
    } catch (e) {
      console.error("[data-integrations] brand share query failed:", e);
    }

    // Helpers
    const getShare = (brand: string): number =>
      brandShareMap.get(brand.toUpperCase()) ?? brandShareMap.get(normBrand(brand)) ?? 0;
    const getCoverage = (brand: string): number =>
      brandCoverageMap.get(brand.toUpperCase()) ?? brandCoverageMap.get(normBrand(brand)) ?? 0;
    const getMktShare = (m: "nz"|"uk"|"au"|"us", brand: string): number =>
      mktShareMap[m].get(brand.toUpperCase()) ?? mktShareMap[m].get(normBrand(brand)) ?? 0;
    const getMktCoverage = (m: "nz"|"uk"|"au"|"us", brand: string): number =>
      mktCoverageMap[m].get(brand.toUpperCase()) ?? mktCoverageMap[m].get(normBrand(brand)) ?? getCoverage(brand);

    // ── 3. Enrich each integration with computed values ────────────────────────
    for (const integ of integrations) {
      const brands = (integ.brands ?? []);

      // computed_total_vio_pct: sum of brand shares from sample data
      integ.computed_total_vio_pct = brands.length > 0 && brandShareMap.size > 0
        ? (parseFloat(brands.reduce((s, b) => s + getShare(b), 0).toFixed(2)) || null)
        : null;

      // computed_incremental_*: Σ(market-specific brand_share × brand_gain%)
      // Per-market values use per-market brand shares so e.g. Vauxhall appears as
      // 3% of the UK sample (not ~1% of the combined global sample).
      if (integ.brand_incremental && brandShareMap.size > 0) {
        let weightedGainSum = 0;
        let anyGain = false;
        const mktSum: Record<"nz"|"uk"|"au"|"us", number> = { nz: 0, uk: 0, au: 0, us: 0 };
        const mktAny: Record<"nz"|"uk"|"au"|"us", boolean> = { nz: false, uk: false, au: false, us: false };

        for (const [brand, markets] of Object.entries(integ.brand_incremental)) {
          const currentCov = getCoverage(brand);

          // Per-market: use market-specific brand share as weight
          for (const m of (["nz", "uk", "au", "us"] as const)) {
            const g = resolveMarketGain(markets[m], getMktCoverage(m, brand));
            if (g != null) {
              const share = getMktShare(m, brand) / 100;
              if (share > 0) { mktSum[m] += share * g; mktAny[m] = true; }
            }
          }

          // Global: use global brand share, average gain across markets with data
          const globalShare = getShare(brand) / 100;
          if (globalShare > 0) {
            const gains = (["nz", "uk", "au", "us"] as const)
              .map((m) => resolveMarketGain(markets[m], currentCov))
              .filter((v): v is number => v != null);
            if (gains.length > 0) {
              weightedGainSum += globalShare * (gains.reduce((s, v) => s + v, 0) / gains.length);
              anyGain = true;
            }
          }
        }

        integ.computed_incremental_vio_pct = anyGain ? parseFloat(weightedGainSum.toFixed(2)) : null;
        integ.computed_incremental_nz_pct  = mktAny.nz ? parseFloat(mktSum.nz.toFixed(2)) : null;
        integ.computed_incremental_uk_pct  = mktAny.uk ? parseFloat(mktSum.uk.toFixed(2)) : null;
        integ.computed_incremental_au_pct  = mktAny.au ? parseFloat(mktSum.au.toFixed(2)) : null;
        integ.computed_incremental_us_pct  = mktAny.us ? parseFloat(mktSum.us.toFixed(2)) : null;
      } else {
        integ.computed_incremental_vio_pct = null;
        integ.computed_incremental_nz_pct  = null;
        integ.computed_incremental_uk_pct  = null;
        integ.computed_incremental_au_pct  = null;
        integ.computed_incremental_us_pct  = null;
      }
    }

    return NextResponse.json(integrations, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[data-integrations GET]", err);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name, type, relationship, brands,
      total_vio_pct, incremental_vio_pct,
      incremental_nz_pct, incremental_uk_pct, incremental_au_pct, incremental_us_pct,
      brand_incremental,
      data_availability,
      annual_cost, cost_per_vin,
      integration_date,
    } = body;

    if (!name?.trim() || !type) {
      return NextResponse.json({ error: "name and type are required" }, { status: 400 });
    }
    if (!["online", "offline"].includes(type)) {
      return NextResponse.json({ error: "type must be 'online' or 'offline'" }, { status: 400 });
    }
    const rel: string = ["direct", "third-party"].includes(relationship) ? relationship : "third-party";
    const brandsArr: string[] = Array.isArray(brands) ? brands.map((b: string) => b.trim()).filter(Boolean) : [];
    const brandIncrementalVal = brand_incremental && typeof brand_incremental === "object" && Object.keys(brand_incremental).length > 0
      ? JSON.stringify(brand_incremental)
      : null;
    const dateVal: string | null = integration_date?.trim() || null;

    const availabilityVal = ["integrated", "available", "high_confidence", "low_confidence"].includes(data_availability)
      ? data_availability : null;

    const rows = await sql`
      INSERT INTO data_integrations
        (name, type, relationship, brands,
         total_vio_pct, incremental_vio_pct,
         incremental_nz_pct, incremental_uk_pct, incremental_au_pct, incremental_us_pct,
         brand_incremental,
         data_availability, annual_cost, cost_per_vin,
         integration_date)
      VALUES
        (${name.trim()}, ${type}, ${rel}, ${brandsArr},
         ${n(total_vio_pct)}, ${n(incremental_vio_pct)},
         ${n(incremental_nz_pct)}, ${n(incremental_uk_pct)}, ${n(incremental_au_pct)}, ${n(incremental_us_pct)},
         ${brandIncrementalVal}::jsonb,
         ${availabilityVal}, ${n(annual_cost)}, ${n(cost_per_vin)},
         ${dateVal})
      RETURNING
        id, name, type, relationship, brands,
        total_vio_pct::float          AS total_vio_pct,
        incremental_vio_pct::float    AS incremental_vio_pct,
        incremental_nz_pct::float     AS incremental_nz_pct,
        incremental_uk_pct::float     AS incremental_uk_pct,
        incremental_au_pct::float     AS incremental_au_pct,
        incremental_us_pct::float     AS incremental_us_pct,
        brand_incremental,
        data_availability,
        annual_cost::float            AS annual_cost,
        cost_per_vin::float           AS cost_per_vin,
        integration_date::text        AS integration_date,
        created_at, updated_at
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[data-integrations POST]", err);
    return NextResponse.json({ error: "Failed to create integration" }, { status: 500 });
  }
}
