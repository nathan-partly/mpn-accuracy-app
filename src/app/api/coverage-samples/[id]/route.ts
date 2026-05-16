import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateCoverageSampleSnapshot } from "@/lib/queries";
import { sql } from "@/lib/db";

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
