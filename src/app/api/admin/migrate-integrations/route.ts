import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/migrate-integrations
 * Idempotent migration — adds per-market incremental VIO % columns to data_integrations.
 * Safe to call multiple times (uses ADD COLUMN IF NOT EXISTS).
 */
export async function GET() {
  try {
    await sql`
      ALTER TABLE data_integrations
        ADD COLUMN IF NOT EXISTS incremental_nz_pct float,
        ADD COLUMN IF NOT EXISTS incremental_uk_pct float,
        ADD COLUMN IF NOT EXISTS incremental_au_pct float,
        ADD COLUMN IF NOT EXISTS incremental_us_pct float
    `;
    return NextResponse.json({ ok: true, message: "Migration applied (or already up to date)." });
  } catch (err) {
    console.error("[migrate-integrations]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
