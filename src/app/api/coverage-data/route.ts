import { NextRequest, NextResponse } from "next/server";
import { getCoverageDashboardData } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Lightweight data-only endpoint — returns the brand coverage JSON for a
 * given snapshot (or the combined latest-per-brand view if no snapshot given).
 *
 * Used by the coverage page to update the iframe via postMessage instead of
 * reloading the full HTML on every snapshot switch.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const snapshotParam = searchParams.get("snapshot");
  const snapshotId = snapshotParam ? parseInt(snapshotParam, 10) : undefined;

  const data = await getCoverageDashboardData(
    snapshotId && !isNaN(snapshotId) ? snapshotId : undefined
  );

  return NextResponse.json(data, {
    headers: {
      // Cache aggressively — the underlying snapshot data never changes
      "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
    },
  });
}
