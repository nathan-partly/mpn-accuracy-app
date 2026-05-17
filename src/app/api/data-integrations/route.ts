import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type MarketDBValue = { type: "fixed" | "target"; value: number } | number | null;
export type BrandIncrementalMap = Record<string, { nz: MarketDBValue; uk: MarketDBValue; au: MarketDBValue; us: MarketDBValue }>;

/** Extract the numeric gain value from a market cell (handles both old number and new {type,value} formats).
 *  For "target" cells we can't compute a fixed gain without knowing current coverage, so we
 *  treat them as 0 in the aggregate estimate. */
function marketGainValue(mv: MarketDBValue): number | null {
  if (mv == null) return null;
  if (typeof mv === "number") return mv;
  if (mv.type === "fixed") return mv.value;
  return null; // "target" — skip in aggregate estimate
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

    // ── 2. Fetch brand shares from latest non-baseline snapshot per region ─────
    // share = that brand's % of the combined VIN universe across all active regions.
    // Used to auto-compute total_vio_pct / incremental_vio_pct when not set manually.
    const brandShareMap = new Map<string, number>(); // UPPERCASED make → share %
    try {
      const shareRows = await sql`
        WITH latest_per_region AS (
          SELECT DISTINCT ON (region) id
          FROM coverage_sample_snapshots
          WHERE is_baseline = false
          ORDER BY region, snapshot_date DESC, created_at DESC
        ),
        all_brand_totals AS (
          SELECT
            UPPER(r.make)       AS make,
            SUM(r.total)::float AS total
          FROM coverage_sample_rows r
          JOIN latest_per_region lpr ON lpr.id = r.snapshot_id
          GROUP BY UPPER(r.make)
        ),
        grand AS (SELECT NULLIF(SUM(total), 0) AS gt FROM all_brand_totals)
        SELECT make, ROUND(100.0 * total / gt, 2)::float AS share
        FROM all_brand_totals, grand
      ` as Array<{ make: string; share: number }>;

      for (const row of shareRows) {
        brandShareMap.set(row.make, typeof row.share === "string" ? parseFloat(row.share) : (row.share ?? 0));
      }
    } catch {
      // Non-fatal — computed values will be null if snapshot data is unavailable
    }

    // ── 3. Enrich each integration with computed values ────────────────────────
    for (const integ of integrations) {
      const brands = (integ.brands ?? []).map((b) => b.toUpperCase());

      // computed_total_vio_pct: sum of brand shares (only when manual value is absent)
      if (integ.total_vio_pct == null && brands.length > 0 && brandShareMap.size > 0) {
        const total = brands.reduce((s, b) => s + (brandShareMap.get(b) ?? 0), 0);
        integ.computed_total_vio_pct = total > 0 ? parseFloat(total.toFixed(2)) : null;
      } else {
        integ.computed_total_vio_pct = null;
      }

      // computed_incremental_vio_pct: Σ(brand_share × avg_fixed_market_gain%)
      // Only meaningful when brand_incremental has fixed-type entries.
      if (integ.incremental_vio_pct == null && integ.brand_incremental && brandShareMap.size > 0) {
        let weightedGainSum = 0;
        let anyGain = false;
        for (const [brand, markets] of Object.entries(integ.brand_incremental)) {
          const share = (brandShareMap.get(brand.toUpperCase()) ?? 0) / 100; // fraction
          if (share <= 0) continue;
          const gains = (["nz", "uk", "au", "us"] as const)
            .map((m) => marketGainValue(markets[m]))
            .filter((v): v is number => v != null);
          if (gains.length === 0) continue;
          const avgGain = gains.reduce((s, v) => s + v, 0) / gains.length;
          weightedGainSum += share * avgGain; // = % of total VINs newly covered by this brand
          anyGain = true;
        }
        integ.computed_incremental_vio_pct = anyGain ? parseFloat(weightedGainSum.toFixed(2)) : null;
      } else {
        integ.computed_incremental_vio_pct = null;
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
