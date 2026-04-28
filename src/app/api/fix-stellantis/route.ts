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
    const rows = await sql`
      UPDATE data_integrations
      SET
        brand_incremental = ${JSON.stringify(brandIncremental)}::jsonb,
        brands            = ARRAY['FIAT', 'ALFA ROMEO', 'JEEP'],
        updated_at        = NOW()
      WHERE id = 19
      RETURNING id, brands, brand_incremental::text AS bi, updated_at
    `;

    return NextResponse.json({ ok: true, rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
