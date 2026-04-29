import { NextResponse } from "next/server";
import { getLatestQualitySnapshot } from "@/lib/queries";

export const dynamic = "force-dynamic";

function escapeCell(v: string | number | boolean | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  // Quote if contains comma, quote, or newline
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(escapeCell).join(",");
}

export async function GET() {
  const latest = await getLatestQualitySnapshot();

  const headers = [
    "brand",
    "classification_pct",
    "annotation_pct",
    "total_diagrams",
    "vio_rank",
    "vio_combined_pct",
    "vio_nz_pct",
    "vio_uk_pct",
    "vio_au_pct",
    "vio_us_pct",
    "req_diagram_cleanup",
    "req_titles_rephrased",
    "req_irrelevant_removed",
    "req_accuracy_verified",
    "req_part_variant_l2",
  ];

  let csv = headers.join(",") + "\n";

  if (latest) {
    for (const b of latest.brands) {
      csv += row([
        b.brand,
        b.classification_pct,
        b.annotation_pct,
        b.total_diagrams,
        b.vio_rank,
        b.vio_combined_pct,
        b.vio_nz_pct,
        b.vio_uk_pct,
        b.vio_au_pct,
        b.vio_us_pct,
        b.req_diagram_cleanup ? "TRUE" : "FALSE",
        b.req_titles_rephrased ? "TRUE" : "FALSE",
        b.req_irrelevant_removed ? "TRUE" : "FALSE",
        b.req_accuracy_verified ? "TRUE" : "FALSE",
        b.req_part_variant_l2 ? "TRUE" : "FALSE",
      ]) + "\n";
    }
  }

  const date = latest?.snapshot.snapshot_date
    ? String(latest.snapshot.snapshot_date).slice(0, 10)
    : "template";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quality-snapshot-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
