import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

function n(v: unknown): number | null {
  return v != null && v !== "" ? Number(v) : null;
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

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
      UPDATE data_integrations
      SET
        name                  = ${name.trim()},
        type                  = ${type},
        relationship          = ${rel},
        brands                = ${brandsArr},
        total_vio_pct         = ${n(total_vio_pct)},
        incremental_vio_pct   = ${n(incremental_vio_pct)},
        incremental_nz_pct    = ${n(incremental_nz_pct)},
        incremental_uk_pct    = ${n(incremental_uk_pct)},
        incremental_au_pct    = ${n(incremental_au_pct)},
        incremental_us_pct    = ${n(incremental_us_pct)},
        brand_incremental     = ${brandIncrementalVal}::jsonb,
        data_availability     = ${availabilityVal},
        annual_cost           = ${n(annual_cost)},
        cost_per_vin          = ${n(cost_per_vin)},
        integration_date      = ${dateVal},
        updated_at            = NOW()
      WHERE id = ${id}
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
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[data-integrations PUT]", err);
    return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    await sql`DELETE FROM data_integrations WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[data-integrations DELETE]", err);
    return NextResponse.json({ error: "Failed to delete integration" }, { status: 500 });
  }
}
