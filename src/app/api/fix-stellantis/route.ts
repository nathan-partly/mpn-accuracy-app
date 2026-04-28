import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// One-shot fix: update id=19 brand_incremental with all three Stellantis brands.
// Hit GET /api/fix-stellantis to apply, then DELETE this file.
export async function GET() {
  const brandIncremental = {
    FIAT:         { nz: 20, uk: 88,   au: null, us: null },
    "ALFA ROMEO": { nz: 20, uk: 86.7, au: null, us: null },
    JEEP:         { nz: 20, uk: 55.7, au: null, us: null },
  };

  try {
    const updateRows = await sql`
      UPDATE data_integrations
      SET
        brand_incremental = ${JSON.stringify(brandIncremental)}::jsonb,
        brands            = ARRAY['FIAT', 'ALFA ROMEO', 'JEEP'],
        updated_at        = NOW()
      WHERE id = 19
      RETURNING id, brands, brand_incremental::text AS bi, updated_at
    `;

    // Immediately re-read to verify the write is visible
    const verifyRows = await sql`
      SELECT id, brands, brand_incremental::text AS bi, updated_at
      FROM data_integrations WHERE id = 19
    `;

    // Also check pg_postmaster_start_time to fingerprint the exact server instance
    const serverInfo = await sql`
      SELECT pg_postmaster_start_time()::text AS started, inet_server_addr()::text AS addr, current_database() AS db
    `;

    return NextResponse.json(
      { ok: true, updateRows, verifyRows, serverInfo },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
