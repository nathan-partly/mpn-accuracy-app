import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/brands/sync-coverage
 *
 * Reads the latest coverage snapshot, finds every make that has at least
 * one covered VIN (y > 0) in the ALL-regions aggregate, and inserts any
 * that are not already in the brands table as pending-benchmarking entries.
 *
 * Returns: { added: string[], skipped: string[], total_covered: number }
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Get the latest snapshot with data
  const snapshots = await sql`
    SELECT data_json
    FROM coverage_snapshots
    WHERE data_json IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (snapshots.length === 0) {
    return NextResponse.json({ error: "No coverage snapshot found" }, { status: 404 });
  }

  // 2. Parse and extract brands with y > 0 from the ALL-regions aggregate
  let coveredMakes: string[] = [];
  try {
    const data = JSON.parse(snapshots[0].data_json as string) as Record<
      string,
      Array<{ make: string; y: number; n: number; total: number }>
    >;

    // Prefer ALL region; fall back to union of individual regions
    const allRegion = data["ALL"];
    if (allRegion && allRegion.length > 0) {
      coveredMakes = allRegion
        .filter((b) => Number(b.y) > 0)
        .map((b) => b.make.trim());
    } else {
      // Union across all regions
      const seen = new Set<string>();
      for (const region of Object.values(data)) {
        for (const b of region) {
          if (Number(b.y) > 0) seen.add(b.make.trim());
        }
      }
      coveredMakes = Array.from(seen);
    }
  } catch {
    return NextResponse.json({ error: "Failed to parse coverage snapshot data" }, { status: 500 });
  }

  if (coveredMakes.length === 0) {
    return NextResponse.json({ added: [], skipped: [], total_covered: 0 });
  }

  // 3. Get existing brand names (normalised upper for comparison)
  const existingRows = await sql`SELECT name FROM brands`;
  const existingNorm = new Set(
    existingRows.map((r) => String(r.name).toUpperCase().trim())
  );

  // 4. Split into new vs already-known
  const toAdd    = coveredMakes.filter((m) => !existingNorm.has(m.toUpperCase()));
  const skipped  = coveredMakes.filter((m) =>  existingNorm.has(m.toUpperCase()));

  // 5. Insert new brands as pending
  const added: string[] = [];
  for (const make of toAdd) {
    const rows = await sql`
      INSERT INTO brands (name, status)
      VALUES (${make}, 'pending')
      ON CONFLICT (name) DO NOTHING
      RETURNING name
    `;
    if (rows.length > 0) added.push(make);
  }

  return NextResponse.json({
    added,
    skipped,
    total_covered: coveredMakes.length,
  });
}
