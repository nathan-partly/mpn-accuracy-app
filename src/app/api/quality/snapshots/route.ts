import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllQualitySnapshots, createQualitySnapshot } from "@/lib/queries";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshots = await getAllQualitySnapshots();
  return NextResponse.json(snapshots);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { snapshot_date, rows, notes } = body;

  if (!snapshot_date || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "snapshot_date and rows are required" }, { status: 400 });
  }

  // Validate rows
  const validated = rows
    .filter((r: { brand?: string }) => r.brand?.trim())
    .map((r: {
      brand: string;
      classification_pct?: string | number;
      annotation_pct?: string | number;
      total_diagrams?: string | number;
      req_diagram_style?: boolean;
      req_diagram_cleanup?: boolean;
      req_titles_rephrased?: boolean;
      req_irrelevant_removed?: boolean;
      req_accuracy_verified?: boolean;
      req_part_variant_l2?: boolean;
    }) => ({
      brand: r.brand.trim().toUpperCase(),
      classification_pct: r.classification_pct != null && r.classification_pct !== ""
        ? Math.min(100, Math.max(0, parseFloat(String(r.classification_pct))))
        : null,
      annotation_pct: r.annotation_pct != null && r.annotation_pct !== ""
        ? Math.min(100, Math.max(0, parseFloat(String(r.annotation_pct))))
        : null,
      total_diagrams: r.total_diagrams != null && r.total_diagrams !== ""
        ? parseInt(String(r.total_diagrams), 10)
        : null,
      req_diagram_style: !!r.req_diagram_style,
      req_diagram_cleanup: !!r.req_diagram_cleanup,
      req_titles_rephrased: !!r.req_titles_rephrased,
      req_irrelevant_removed: !!r.req_irrelevant_removed,
      req_accuracy_verified: !!r.req_accuracy_verified,
      req_part_variant_l2: !!r.req_part_variant_l2,
    }));

  if (validated.length === 0) {
    return NextResponse.json({ error: "No valid rows after validation" }, { status: 400 });
  }

  const snapshotId = await createQualitySnapshot(
    snapshot_date,
    validated,
    session.user?.email ?? undefined,
    notes
  );

  return NextResponse.json({ id: snapshotId, brand_count: validated.length });
}
