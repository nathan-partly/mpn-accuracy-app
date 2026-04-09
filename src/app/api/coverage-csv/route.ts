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
  const header = ["Make", "Region", "VIN", "Coverage Status"];
  const rows: string[] = [header.join(",")];

  for (const [region, makes] of Object.entries(data)) {
    for (const entry of makes as Array<{
      make: string; yv: string[]; nv: string[];
    }>) {
      for (const vin of (entry.yv ?? [])) {
        rows.push([`"${entry.make}"`, region, vin, "Yes"].join(","));
      }
      for (const vin of (entry.nv ?? [])) {
        rows.push([`"${entry.make}"`, region, vin, "No"].join(","));
      }
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
