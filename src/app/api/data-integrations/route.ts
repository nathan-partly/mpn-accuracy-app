import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export type BrandIncrementalMap = Record<string, { nz: number | null; uk: number | null; au: number | null; us: number | null }>;

export type DataAvailability = "available" | "high_confidence" | "low_confidence" | null;

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
  integration_date: string;
  created_at: string;
  updated_at: string;
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
    const rows = await sql`
      SELECT
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
      FROM data_integrations
      ORDER BY integration_date ASC, id ASC
    `;
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
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

    if (!name?.trim() || !type || !integration_date) {
      return NextResponse.json({ error: "name, type, and integration_date are required" }, { status: 400 });
    }
    if (!["online", "offline"].includes(type)) {
      return NextResponse.json({ error: "type must be 'online' or 'offline'" }, { status: 400 });
    }
    const rel: string = ["direct", "third-party"].includes(relationship) ? relationship : "third-party";
    const brandsArr: string[] = Array.isArray(brands) ? brands.map((b: string) => b.trim()).filter(Boolean) : [];
    const brandIncrementalVal = brand_incremental && typeof brand_incremental === "object" && Object.keys(brand_incremental).length > 0
      ? JSON.stringify(brand_incremental)
      : null;

    const availabilityVal = ["available", "high_confidence", "low_confidence"].includes(data_availability)
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
         ${integration_date})
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
