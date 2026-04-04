import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { updateSnapshotStats } from "@/lib/queries";

// Manual single-record addition
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    snapshot_id: string;
    brand_id: string;
    vin: string;
    part_type: string;
    is_valid: boolean | null;
    region?: string;
    make?: string;
    model?: string;
    year?: number;
    upstream_provider?: string;
    interpreter_output?: string;
    epc_output?: string;
    notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.snapshot_id || !body.brand_id || !body.vin || !body.part_type) {
    return NextResponse.json(
      { error: "snapshot_id, brand_id, vin and part_type are required" },
      { status: 400 }
    );
  }

  const rows = await sql`
    INSERT INTO benchmark_records
      (snapshot_id, brand_id, region, vin, make, model, year,
       upstream_provider, part_type, interpreter_output, epc_output, is_valid, notes)
    VALUES
      (${body.snapshot_id}, ${body.brand_id}, ${body.region ?? null},
       ${body.vin}, ${body.make ?? null}, ${body.model ?? null},
       ${body.year ?? null}, ${body.upstream_provider ?? null},
       ${body.part_type}, ${body.interpreter_output ?? null},
       ${body.epc_output ?? null}, ${body.is_valid ?? null}, ${body.notes ?? null})
    RETURNING *
  `;

  // Recompute snapshot stats
  await updateSnapshotStats(body.snapshot_id);

  return NextResponse.json(rows[0], { status: 201 });
}
