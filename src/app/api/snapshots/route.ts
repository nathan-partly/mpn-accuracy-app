import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createSnapshot,
  insertRecords,
  updateSnapshotStats,
} from "@/lib/queries";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    brand_id: string;
    snapshot_date: string;
    notes?: string;
    records: Array<{
      region?: string | null;
      vin: string;
      make?: string | null;
      model?: string | null;
      year?: number | null;
      upstream_provider?: string | null;
      part_type: string;
      interpreter_output?: string | null;
      epc_output?: string | null;
      epc_source?: string | null;
      is_valid: boolean | null;
      notes?: string | null;
    }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { brand_id, snapshot_date, notes, records } = body;

  if (!brand_id || !snapshot_date || !Array.isArray(records)) {
    return NextResponse.json(
      { error: "brand_id, snapshot_date and records are required" },
      { status: 400 }
    );
  }

  // Validate brand exists
  const brandRows = await sql`SELECT id FROM brands WHERE id = ${brand_id}`;
  if (brandRows.length === 0) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  // Create snapshot
  const snapshot = await createSnapshot({
    brand_id,
    snapshot_date,
    notes,
    uploaded_by: session.user?.email ?? undefined,
  });

  // Insert records
  const recordsWithIds = records.map((r) => ({
    ...r,
    snapshot_id: snapshot.id,
    brand_id,
  }));

  await insertRecords(recordsWithIds);

  // Update computed summary stats
  await updateSnapshotStats(snapshot.id);

  return NextResponse.json({ snapshot_id: snapshot.id }, { status: 201 });
}
