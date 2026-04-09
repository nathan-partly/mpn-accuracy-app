import { NextResponse } from "next/server";
import { getLatestCoverageSnapshot } from "@/lib/queries";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

function extractDataFromHtml(html: string): Record<string, unknown[]> | null {
  const marker = "const DATA = ";
  const start = html.indexOf(marker);
  if (start === -1) return null;

  // Walk forward from the opening `{` counting brackets to find the matching `}`
  let jsonStart = html.indexOf("{", start + marker.length);
  if (jsonStart === -1) return null;

  let depth = 0;
  let i = jsonStart;
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }

  try {
    return JSON.parse(html.slice(jsonStart, i + 1));
  } catch {
    return null;
  }
}

function dataToCsv(data: Record<string, unknown[]>): string {
  const header = ["region", "make", "logo", "y", "n", "total", "rate", "share", "yes_vins", "no_vins"];
  const rows: string[] = [header.join(",")];

  for (const [region, makes] of Object.entries(data)) {
    for (const entry of makes as Array<{
      make: string; logo: string; y: number; n: number;
      total: number; rate: number; share: number;
      yv: string[]; nv: string[];
    }>) {
      const yesVins = (entry.yv ?? []).join("|");
      const noVins = (entry.nv ?? []).join("|");
      const row = [
        region,
        `"${entry.make}"`,
        entry.logo ?? "",
        entry.y ?? 0,
        entry.n ?? 0,
        entry.total ?? 0,
        entry.rate ?? 0,
        entry.share ?? 0,
        `"${yesVins}"`,
        `"${noVins}"`,
      ];
      rows.push(row.join(","));
    }
  }

  return rows.join("\n");
}

export async function GET() {
  let html: string | null = null;

  try {
    const latest = await getLatestCoverageSnapshot();
    if (latest?.html_content) {
      html = latest.html_content;
    }
  } catch {
    // fall through to static file
  }

  if (!html) {
    try {
      html = readFileSync(join(process.cwd(), "public", "coverage-dashboard.html"), "utf-8");
    } catch {
      return new NextResponse("Coverage data not found", { status: 404 });
    }
  }

  const data = extractDataFromHtml(html);
  if (!data) {
    return new NextResponse("Could not parse coverage data from dashboard", { status: 500 });
  }

  const csv = dataToCsv(data);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="coverage-data.csv"',
      "Cache-Control": "no-store",
    },
  });
}
