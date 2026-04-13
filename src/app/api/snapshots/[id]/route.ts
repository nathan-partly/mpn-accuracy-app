import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  // Verify the snapshot exists and grab its brand_id before deleting
  const rows = await sql`
    SELECT id, brand_id FROM benchmark_snapshots WHERE id = ${id}
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  }

  const brandId = rows[0].brand_id as string;

  // Delete snapshot — records are removed automatically via ON DELETE CASCADE
  await sql`DELETE FROM benchmark_snapshots WHERE id = ${id}`;

  return NextResponse.json({ ok: true, brandId });
}
