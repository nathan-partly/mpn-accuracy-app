import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateCoverageSampleSnapshot } from "@/lib/queries";
import { sql } from "@/lib/db";

// GET /api/coverage-samples/[id] — download snapshot as CSV
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  // Fetch snapshot metadata
  const snaps = await sql`
    SELECT region, snapshot_date::text FROM coverage_sample_snapshots WHERE id = ${id}
  `;
  if (!snaps[0]) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  const { region, snapshot_date } = snaps[0] as { region: string; snapshot_date: string };

  // Fetch rows — include yv/nv if present (may be empty for older snapshots)
  type SampleRow = { make: string; y: number; n: number; yv: string[] | null; nv: string[] | null };
  const rows = await sql`
    SELECT make, y::int, n::int,
      COALESCE(yv, '{}'::text[]) AS yv,
      COALESCE(nv, '{}'::text[]) AS nv
    FROM coverage_sample_rows
    WHERE snapshot_id = ${id}
    ORDER BY make ASC
  ` as SampleRow[];

  // Build CSV content
  const lines: string[] = ["Make,Region,VIN,Coverage Status"];
  for (const row of rows) {
    const yvArr = Array.isArray(row.yv) ? row.yv : [];
    const nvArr = Array.isArray(row.nv) ? row.nv : [];
    // If individual VINs are stored, emit one row per VIN
    if (yvArr.length > 0 || nvArr.length > 0) {
      for (const vin of yvArr) lines.push(`${row.make},${region},${vin},Yes`);
      for (const vin of nvArr) lines.push(`${row.make},${region},${vin},No`);
    } else {
      // Older snapshot — no individual VINs stored. Emit placeholder rows so the
      // file at least shows the brand/region breakdown; VIN column is blank.
      for (let i = 0; i < row.y; i++) lines.push(`${row.make},${region},,Yes`);
      for (let i = 0; i < row.n; i++) lines.push(`${row.make},${region},,No`);
    }
  }

  const csv = lines.join("\n");
  const filename = `coverage-${region.toLowerCase()}-${snapshot_date}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const dynamic = "force-dynamic";

// PATCH /api/coverage-samples/[id] — update region, snapshot_date, or notes
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fields: { region?: string; snapshot_date?: string; notes?: string | null } = {};

  if (typeof body.region === "string" && body.region.trim()) {
    fields.region = body.region.trim().toUpperCase();
  }
  if (typeof body.snapshot_date === "string" && body.snapshot_date) {
    fields.snapshot_date = body.snapshot_date;
  }
  if ("notes" in body) {
    fields.notes = typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : null;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await updateCoverageSampleSnapshot(id, fields);
  return NextResponse.json({ success: true });
}

// DELETE /api/coverage-samples/[id] — delete a snapshot and its rows
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  // Prevent deleting baseline snapshots
  const rows = await sql`SELECT is_baseline FROM coverage_sample_snapshots WHERE id = ${id}`;
  if (!rows[0]) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  if (rows[0].is_baseline) {
    return NextResponse.json({ error: "Cannot delete baseline snapshots" }, { status: 403 });
  }

  // Rows are cascade-deleted by FK constraint
  await sql`DELETE FROM coverage_sample_snapshots WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
